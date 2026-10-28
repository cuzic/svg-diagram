// Pass 1 of the layout: every atom a diagram needs measured, collected into one request map for the single batched measureAll call.
// What each band type needs is one entry of MEASURE_HANDLERS (a typed table: a band type without one fails to compile).
import { splitAtoms } from './atoms.js';
import { must } from './must.js';
import { styledAtoms, textRuns } from './layout-text.js';
import { TAG_SIZE, CONNECT_LABEL_SIZE } from './tokens.js';
import { groupTitleBand, withSourceLine, withTitleLine } from './layout-util.js';
import { childrenOf } from './band-children.js';
import { planeTexts } from './plane.js';
import { imageTexts } from './image.js';
import { barsTexts } from './bars.js';
import { dotsTexts, peopleTexts } from './people.js';
import { timelineTexts } from './timeline.js';
import { quadrantTexts } from './quadrant.js';
import { flowShapeTexts } from './flow-shapes.js';
import { wordArtTexts } from './wordart.js';
import { treeTexts } from './tree.js';
import { statesTexts } from './states.js';
import { causeTexts, cloudTexts } from './toc.js';
import { ganttTexts } from './gantt.js';
import { statusTexts, withStatus } from './status.js';
import { classesTexts } from './classes.js';
import { bpmnTexts } from './bpmn.js';
import { ftaTexts } from './fta.js';
import { bowtieMeasure } from './bowtie.js';
import { chartTexts } from './charts.js';
import { collectTextRequests } from './seq-table.js';
import { collectTextRequests as wfTextRequests } from './wireframe.js';
function registerAtoms(requests, text, size, weight, font = 'sans') {
    for (const atom of splitAtoms(text)) {
        const key = `${atom} ${size} ${weight} ${font}`;
        if (!requests.has(key))
            requests.set(key, { text: atom, size, weight, font });
    }
}
function registerRequests(requests, band, roles) {
    if ('tag' in band && band.tag)
        registerAtoms(requests, band.tag, (roles.tag ?? TAG_SIZE), 700);
    if ('stamp' in band && band.stamp)
        registerAtoms(requests, band.stamp, roles.note, 400);
    for (const run of textRuns(band, roles)) {
        const font = run.mono ? 'mono' : 'sans';
        // a value that may shrink (ADR 0024) is measured at every whole size it may be drawn at: a width is only looked up, never scaled
        for (let size = run.fit && run.nowrap ? run.fit.min : run.size; size <= run.size; size++) {
            for (const { text, weight } of styledAtoms(run)) {
                const key = `${text} ${size} ${weight} ${font}`;
                if (!requests.has(key))
                    requests.set(key, { text, size, weight, font });
            }
        }
    }
}
/** A band whose own module lists its text as [text, size, weight, font] tuples. */
const fromTuples = (texts) => (band, m) => { for (const [text, size, weight, font] of texts(band, m.roles))
    m.atoms(text, size, weight, font); };
const own = (band, m) => m.own(band);
const children = (band, m) => { for (const child of childrenOf(band))
    m.band(child); };
/** row / grid children are box-like: their own text only. */
const childrenOwn = (band, m) => { for (const child of childrenOf(band))
    m.own(child); };
export const MEASURE_HANDLERS = {
    caption: own, box: own, banner: own, spacer: own, raw: own,
    status: fromTuples(statusTexts),
    group: (band, m) => {
        if (band.stamp)
            m.atoms(band.stamp, m.roles.note, 400);
        if (band.title)
            m.own(groupTitleBand(band));
        children(band, m);
    },
    grouprow: children,
    row: childrenOwn,
    grid: (band, m) => {
        if (band.canvas?.title)
            m.own({ type: 'caption', text: band.canvas.title, align: 'left', role: 'title', bold: true, tone: 'text', mono: false });
        childrenOwn(band, m);
    },
    swimlane: (band, m) => {
        for (const l of band.lanes)
            m.atoms(l.label, m.roles.title, 700);
        for (const p of band.phases ?? [])
            m.atoms(p.label, m.roles.note, 700);
        for (const st of band.steps)
            m.own(st);
    },
    legend: (band, m) => { for (const item of band.items)
        m.atoms(item.label, m.roles.note, 400); },
    // connect() labels are single-line, always the 'note' role at plain weight (see emit.ts's renderConnect) — registered here so their
    // real width is known before layoutDiagram resolves the connect, instead of guessed at draw time.
    connect: (band, m) => { if (band.label)
        m.atoms(band.label, (m.roles.connectLabel ?? CONNECT_LABEL_SIZE), 400); },
    pyramid: (band, m) => { for (const layer of band.layers)
        m.atoms(layer.text, m.roles.title, 700); },
    curve: (band, m) => { for (const label of [band.yTopLabel, band.yBottomLabel, band.xLabel])
        if (label)
            m.atoms(label, m.roles.note, 400); },
    image: (band, m) => { fromTuples(imageTexts)(band, m); children(band, m); },
    sequence: fromTuples(collectTextRequests),
    table: fromTuples(collectTextRequests),
    wireframe: fromTuples((band, _roles) => wfTextRequests(band)),
    screens: fromTuples((band, _roles) => wfTextRequests(band)),
    plane: fromTuples(planeTexts),
    quadrant: fromTuples(quadrantTexts),
    chevron: fromTuples(flowShapeTexts),
    wordart: fromTuples(wordArtTexts),
    funnel: fromTuples(flowShapeTexts),
    cycle: fromTuples(flowShapeTexts),
    venn: fromTuples(flowShapeTexts),
    concentric: fromTuples(flowShapeTexts),
    emblem: fromTuples(flowShapeTexts),
    bars: fromTuples(barsTexts),
    chart: fromTuples(chartTexts),
    people: fromTuples(peopleTexts),
    dots: fromTuples(dotsTexts),
    math: () => undefined,
    timeline: fromTuples(timelineTexts),
    bpmn: fromTuples(bpmnTexts),
    fta: fromTuples(ftaTexts),
    bowtie: fromTuples(bowtieMeasure),
    classes: fromTuples(classesTexts),
    gantt: fromTuples(ganttTexts),
    cause: fromTuples(causeTexts),
    cloud: fromTuples(cloudTexts),
    states: fromTuples(statesTexts),
    tree: fromTuples(treeTexts),
};
/** Pass 1: every atom this diagram needs measured, at the font sizes of `roles`. Pure: no measuring happens here. */
export function collectMeasures(data, roles) {
    const d = withStatus(withSourceLine(withTitleLine(data)));
    const requests = new Map();
    const m = {
        roles,
        atoms: (text, size, weight, font) => registerAtoms(requests, text, size, weight, font),
        own: band => registerRequests(requests, band, roles),
        band: band => must(MEASURE_HANDLERS[band.type])(band, m),
    };
    for (const band of d.bands)
        m.band(band);
    return requests;
}
/**
 * The width lookup over what measureAll(collectMeasures(...)) returned. An atom that was never registered measures 0 wide,
 * silently (a line then overflows its box); with `strict` that is an error. The caller reads SVG_DIAGRAM_STRICT_WIDTH
 * (layout itself touches no environment).
 */
export function widthOfMeasured(measured, strict) {
    return (atom, size, weight, font) => {
        const m = measured.get(`${atom} ${size} ${weight} ${font}`);
        if (m)
            return m.w;
        if (strict)
            throw new Error(`layout: "${atom}" (${size}px, ${weight}, ${font}) was not registered for measuring, so its width would be 0 (SVG_DIAGRAM_STRICT_WIDTH is set)`);
        return 0;
    };
}
