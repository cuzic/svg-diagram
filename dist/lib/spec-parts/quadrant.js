import { BOX_TONE, QUADRANT_GRID, axis, items, list, object, oneOf, pair, text, withoutType } from '../spec-kit.js';
import { quadrantDefaults } from '../quadrant.js';
export function defineQuadrantPart(builder) {
    return {
        type: 'quadrant',
        description: "A matrix between two axes: 2x2 (or up to 4x4) cells, with items placed in a cell or at a coordinate, optionally as bubbles sized by a value. `preset` fills the axes and cells of a known framework: bcg (growth-share), ge (GE-McKinsey nine box), ansoff, nineBox (talent), impactEffort, risk (likelihood x impact), stakeholder (power x interest), positioning, eisenhower (urgent x important), actMatrix (ACT Matrix: five senses / inside x away / toward, with 気づいている自分 at the centre). The presets write their axes and cells in Japanese: with lang en, give x, y and cells (and centre) instead.",
        schema: object({
            type: { const: 'quadrant' },
            preset: oneOf('bcg', 'ge', 'ansoff', 'nineBox', 'impactEffort', 'risk', 'stakeholder', 'positioning', 'eisenhower', 'actMatrix'),
            x: axis('The horizontal axis.'),
            y: axis('The vertical axis.'),
            grid: pair({ type: 'integer', minimum: 1, maximum: QUADRANT_GRID }, 'Columns and rows (default 2 x 2, or the preset).'),
            cells: list(list(object({ title: text('The caption of the cell.', 30), note: text('A note under it.', 60), tone: BOX_TONE }, []), QUADRANT_GRID), QUADRANT_GRID),
            items: list(object({
                label: text('The item.', 40),
                cell: pair({ type: 'integer', minimum: 0, maximum: QUADRANT_GRID - 1 }, '[column, row] from the top-left as drawn.'),
                at: pair({ type: 'number', minimum: 0, maximum: 1 }, '[x, y] from 0 to 1, 1 being high, instead of a cell.'),
                size: { type: 'number', minimum: 0, maximum: 1e12, description: 'A bubble whose area is proportional to it.' },
                tone: oneOf('accent', 'text', 'muted', 'danger'),
                group: text('Items of one group share a marker and are listed in a legend.', 20),
            }, ['label']), 40),
            crosshair: { type: 'boolean', description: 'true: no gaps between the cells, read as one plot.' },
            centre: { type: 'string', maxLength: 24, description: "A word where the crosshair lines meet (2 x 2 with crosshair only), such as the ACT Matrix's 気づいている自分; '' leaves out the preset's." },
        }, ['type']),
        example: { type: 'quadrant', preset: 'eisenhower', items: [{ label: '障害の一次対応', cell: [0, 0] }, { label: '新人の育成計画', cell: [1, 0] }, { label: '定例会議の出席', cell: [0, 1] }, { label: 'ニュースの巡回', cell: [1, 1] }] },
        check(part, at, issues) {
            if (part['preset'] === undefined)
                for (const k of ['x', 'y'])
                    if (part[k] === undefined)
                        issues.push({ path: `${at}.${k}`, message: 'is required without a preset: {title, low, high}' });
            // centre: where the crosshair lines meet, so a 2 x 2 grid with crosshair (actMatrix has both, and a centre of its own)
            // (the grid and the crosshair as quadrant() takes them: given, else the preset's, else the cells')
            const { grid, crosshair, presetCentre } = quadrantDefaults(part), fromPreset = part['centre'] === undefined && presetCentre !== undefined;
            const centre = typeof part['centre'] === 'string' ? part['centre'].trim() : presetCentre ?? '';
            if (centre && !(grid[0] === 2 && grid[1] === 2 && crosshair))
                issues.push(fromPreset
                    ? { path: `${at}.preset`, message: `${String(part['preset'])} writes ${presetCentre} where the crosshair lines meet: keep a 2 x 2 grid with crosshair, or write centre: ''` }
                    : { path: `${at}.centre`, message: `is written where the crosshair lines meet: it needs a 2 x 2 grid with crosshair: true (this one is ${grid[0]} x ${grid[1]}${crosshair ? '' : ' without crosshair'})` });
            const sized = items(part, 'items').map(it => it['size'] !== undefined);
            if (sized.includes(true))
                sized.forEach((has, i) => { if (!has)
                    issues.push({ path: `${at}.items[${i}].size`, message: 'is required: give every item a size, or none (a bubble without one would read as a small value)' }); });
            items(part, 'items').forEach((it, i) => {
                if (it['cell'] === undefined && it['at'] === undefined)
                    issues.push({ path: `${at}.items[${i}]`, message: 'needs a cell ([column, row]) or a place (at: [x, y])' });
                if (it['cell'] !== undefined && it['at'] !== undefined)
                    issues.push({ path: `${at}.items[${i}].at`, message: 'give a cell or a place, not both' });
            });
        },
        build(part) {
            return builder(withoutType(part));
        },
    };
}
