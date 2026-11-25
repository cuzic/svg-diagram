export declare const RESULT_MARK = "\u0001RESULT ";
export interface WorkerResult {
    src: string;
    /** what the serial run would have printed to stdout / stderr for this source, in order */
    out: string[];
    err: string[];
    /** the findings it added (the same shape as the CLI's own) */
    findings: unknown[];
}
export declare function runPool(cli: string, workerArgs: string[], sources: string[], jobs: number, onError?: (msg: string) => void): Promise<Map<string, WorkerResult>>;
