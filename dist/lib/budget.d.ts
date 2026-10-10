import type { BudgetLimits, BudgetMeasure, LaidOutDiagram } from './types.ts';
export declare const BUDGET: BudgetLimits;
export declare function displayWidth(text: unknown): number;
export declare function measureBudget(d: Pick<LaidOutDiagram, 'laidOut'>): BudgetMeasure;
export declare function budgetWarnings(d: Pick<LaidOutDiagram, 'laidOut'>, limits?: BudgetLimits): string[];
