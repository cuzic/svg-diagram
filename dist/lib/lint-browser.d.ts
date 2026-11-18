import type { Page } from 'playwright-chromium';
import type { RenderChecks } from './svg-lint.ts';
export declare function browserChecks(page: Page, src: string): Promise<RenderChecks | null>;
