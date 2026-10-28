import type { LaidOutDiagram } from './types/index.ts';
import type { BudgetLimits, BudgetMeasure } from './types/verdicts.ts';
export declare const BUDGET: BudgetLimits;
export declare function displayWidth(text: unknown): number;
export declare function measureBudget(d: Pick<LaidOutDiagram, 'laidOut'>): BudgetMeasure;
export declare function budgetWarnings(d: Pick<LaidOutDiagram, 'laidOut'>, limits?: BudgetLimits): string[];
