import { type ChildProcess } from 'node:child_process';
/**
 * The Chromium to drive, or null: SVG_DIAGRAM_CHROMIUM (or PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) if set, else one that playwright downloaded
 * (PLAYWRIGHT_BROWSERS_PATH, ~/.cache/ms-playwright, and the places a container puts it), else a chromium / chrome on the PATH.
 */
export declare function findChromium(env?: NodeJS.ProcessEnv): string | null;
type Json = Record<string, unknown>;
declare class Connection {
    private id;
    private pending;
    private buffer;
    private out;
    constructor(child: ChildProcess, out: NodeJS.WritableStream, input: NodeJS.ReadableStream);
    private sockets;
    settle(): void;
    private idle;
    send(method: string, params?: Json, sessionId?: string): Promise<Json>;
}
export declare class CdpPage {
    private conn;
    private targetId;
    private sessionId;
    constructor(conn: Connection, targetId: string, sessionId: string);
    private call;
    /** Run `fn(arg)` in the page and return its (JSON) result, waiting for a promise it returns — as Playwright's page.evaluate does. */
    evaluate<R, A = undefined>(fn: string | ((arg: A) => R | Promise<R>), arg?: A): Promise<R>;
    /** Replace the document with `html` and wait until it has loaded. */
    setContent(html: string, _opts?: {
        waitUntil?: string;
    }): Promise<void>;
    goto(url: string): Promise<void>;
    waitForTimeout(ms: number): Promise<void>;
    waitForSelector(selector: string, opts?: {
        timeout?: number;
    }): Promise<void>;
    locator(selector: string): {
        count(): Promise<number>;
    };
    close(): Promise<void>;
}
export declare class CdpBrowser {
    private child;
    private conn;
    private profile;
    constructor(child: ChildProcess, conn: Connection, profile: string);
    newPage(opts?: {
        viewport?: {
            width: number;
            height: number;
        };
    }): Promise<CdpPage>;
    close(): Promise<void>;
}
export interface CdpLaunch {
    executablePath?: string;
    args?: string[];
}
export declare function launchCdp(options?: CdpLaunch): Promise<CdpBrowser>;
/** Whether `exe` starts at all (a missing shared library shows here), for a clear message before the first page. */
export declare function chromiumRuns(exe: string): boolean;
export {};
