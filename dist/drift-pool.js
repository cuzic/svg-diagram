// A small pool of child processes for `check --drift --rebuild`: each is this CLI started with --worker, takes one source path per line on
// stdin and answers with one result line on stdout. The parent hands a source to whichever worker is free and collects the answers by
// source, so the caller can replay them in the order the sources were given (the output does not depend on who finished first).
import { spawn } from 'node:child_process';
export const RESULT_MARK = '\u0001RESULT ';
export function runPool(cli, workerArgs, sources, jobs, onError = () => { }) {
    const results = new Map();
    let next = 0, live = 0;
    // a worker that dies loses only the source it held: the caller does that one itself
    return new Promise(resolve => {
        const finish = () => { if (!live)
            resolve(results); };
        const start = () => {
            const child = spawn(process.execPath, [...process.execArgv, cli, ...workerArgs, '--worker'], { stdio: ['pipe', 'pipe', 'pipe'] });
            live++;
            let buf = '', errBuf = '', current = null;
            const feed = () => {
                const src = sources[next++];
                if (src === undefined) {
                    child.stdin.end();
                    return;
                }
                current = src;
                child.stdin.write(`${src}\n`);
            };
            child.stdin.on('error', () => { });
            child.stdout.setEncoding('utf8').on('data', (d) => {
                buf += d;
                for (let i = buf.indexOf('\n'); i !== -1; i = buf.indexOf('\n')) {
                    const line = buf.slice(0, i);
                    buf = buf.slice(i + 1);
                    if (!line.startsWith(RESULT_MARK))
                        continue;
                    const r = JSON.parse(line.slice(RESULT_MARK.length));
                    results.set(r.src, r);
                    current = null;
                    feed();
                }
            });
            child.stderr.setEncoding('utf8').on('data', (d) => { errBuf += d; });
            child.on('close', code => {
                live--;
                if (current !== null)
                    onError(`worker for ${current} exited with ${code}: ${errBuf.trim().split('\n').slice(0, 5).join(' / ')}`);
                finish();
            });
            feed();
        };
        const n = Math.max(1, Math.min(jobs, sources.length));
        for (let i = 0; i < n; i++)
            start();
    });
}
