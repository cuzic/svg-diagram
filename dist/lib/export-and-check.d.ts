#!/usr/bin/env node
export interface ExportAndCheckOpts {
    slidesMd?: string;
    timeoutMs?: number;
    renderTimeoutMs?: number;
    excludeLeft?: number | string;
    checkerArgs?: string[];
    exportAttempts?: number;
}
export interface ExportAndCheckResult {
    ok: boolean;
    suspects: string[];
    raw: string;
}
export declare function exportAndCheck(index: number, opts?: ExportAndCheckOpts): Promise<ExportAndCheckResult>;
