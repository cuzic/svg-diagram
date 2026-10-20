import test from 'node:test';
import assert from 'node:assert/strict';
import {layeredAttempt, simplify} from '../lib/layered-route.ts';
import type {Pt} from '../lib/graph-layout.ts';

// How many corners the auto-laid-out figures have, on the structures of the examples with FIXED box sizes: nothing here depends on a font
// (the figure tests measure real text, whose width differs from machine to machine). Two kinds of limit:
//  - the principled ones (ADR 0016 D6): no arrow of 5 corners or more (a return in an outer lane may have 4), and fewer than 3 corners
//    per arrow on average over the figure;
//  - a budget per figure: the corners and crossings it has today. A change that adds corners or crossings to one of them has to say so here.

const box = (id: string) => ({id, size: {w: 120, h: 40}});
const GAP = 28, LEVEL = 64, PORT = 22;
interface Case {nodes: string[]; edges: [string, string][]; back?: [string, string][]; returns?: 'all' | 'declared'; start?: string[]; budget: {crossings: number; bends: number}}

const cases: Record<string, Case> = {
  // qc-relation: 9 factors, 13 arrows that go back and cross
  relation: {
    nodes: ['late', 'rush', 'multi', 'sw', 'plan', 'est', 'skill', 'over', 'tired'],
    edges: [['rush', 'multi'], ['multi', 'sw'], ['sw', 'late'], ['est', 'plan'], ['plan', 'rush'], ['est', 'over'], ['est', 'multi'], ['skill', 'sw'], ['skill', 'late'], ['over', 'tired'], ['tired', 'late'], ['tired', 'plan'], ['plan', 'late']],
    budget: {crossings: 3, bends: 34},
  },
  // qc-pdpc: the way, two risks, two measures; the measure that goes back to the way runs in an outer lane
  pdpc: {
    nodes: ['start', 'proto', 'test', 'line', 'goal', 'r1', 'm1', 'r2', 'm2'],
    edges: [['start', 'proto'], ['proto', 'test'], ['test', 'line'], ['line', 'goal'], ['test', 'r1'], ['r1', 'm1'], ['m1', 'proto'], ['line', 'r2'], ['r2', 'm2'], ['m2', 'goal']],
    returns: 'all',
    budget: {crossings: 0, bends: 20},
  },
  // a current reality tree with a vicious circle declared with back
  crtLoop: {
    nodes: ['late', 'cost', 'switch', 'rush', 'wip', 'start', 'kpi'],
    edges: [['kpi', 'start'], ['start', 'wip'], ['wip', 'switch'], ['wip', 'rush'], ['switch', 'late'], ['switch', 'cost'], ['rush', 'cost'], ['late', 'kpi']],
    back: [['late', 'kpi']], returns: 'declared',
    budget: {crossings: 2, bends: 16},
  },
  // state-diagram
  states: {
    nodes: ['new', 'paid', 'ship', 'done', 'cancel'],
    edges: [['new', 'paid'], ['paid', 'ship'], ['ship', 'done'], ['new', 'cancel'], ['paid', 'new']],
    start: ['new'],
    budget: {crossings: 0, bends: 6},
  },
  // a class diagram: parents above children
  classes: {
    nodes: ['Animal', 'Dog', 'Cat', 'Owner', 'Leash', 'Vet'],
    edges: [['Animal', 'Dog'], ['Animal', 'Cat'], ['Owner', 'Dog'], ['Owner', 'Cat'], ['Dog', 'Leash'], ['Vet', 'Dog'], ['Vet', 'Cat']],
    budget: {crossings: 7, bends: 12},
  },
};

const measure = (c: Case, straighten = true) => {
  const nodes = c.nodes.map(box), edges = c.edges.map(([from, to]) => ({from, to}));
  const back = c.back?.map(([f, t]) => c.edges.findIndex(([a, b]) => a === f && b === t));
  const a = layeredAttempt(nodes, edges, {dir: 'right', gap: GAP, levelGap: LEVEL, ...(back ? {back} : {}), ...(c.start ? {start: c.start} : {})},
    {portStep: PORT, place: () => (p: Pt) => p, straighten, tighten: !c.back, ...(c.returns ? {returns: c.returns} : {})});
  const per = [...a.routes.values()].map(r => Math.max(0, simplify(r).length - 2));
  return {...a.score, edges: per.length, max: Math.max(0, ...per), outerMax: Math.max(0, ...[...a.routes].filter(([i]) => a.lay.edges[i]!.outer).map(([, r]) => simplify(r).length - 2))};
};

for (const [name, c] of Object.entries(cases)) {
  test(`bends budget: ${name} has no arrow of 5 corners or more (an outer return 4), under 3 corners per arrow, and stays within its budget`, () => {
    const m = measure(c);
    assert.ok(m.max <= 4, `an arrow has ${m.max} corners`);
    assert.ok(m.bends / m.edges <= 3, `${m.bends} corners over ${m.edges} arrows`);
    assert.ok(m.crossings <= c.budget.crossings, `${m.crossings} crossings (budget ${c.budget.crossings})`);
    assert.ok(m.bends <= c.budget.bends, `${m.bends} corners (budget ${c.budget.bends})`);
  });
  test(`bends budget: ${name} with straighten false is never better than the default (crossings, then corners)`, () => {
    const on = measure(c), off = measure(c, false);
    if (name === 'relation') assert.ok(on.crossings < off.crossings || on.bends < off.bends, 'the relation diagram is the case straightening exists for');
    assert.ok(on.crossings < off.crossings || (on.crossings === off.crossings && on.bends <= off.bends), `${JSON.stringify(on)} vs ${JSON.stringify(off)}`);
  });
}
