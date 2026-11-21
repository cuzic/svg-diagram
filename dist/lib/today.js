// The date a gantt({today: 'auto'}) draws. The library never reads the clock: the caller says which day it is, in this order:
// `--today` (build / check), the SVG_DIAGRAM_TODAY environment variable, `"today"` in .svg-diagram.json (ADR 0022 D1).
import { checkToday } from './today-auto.js';
export { checkToday };
/** The day for `today: 'auto'`: the CLI's, else the environment's, else the project's (an empty variable counts as unset). */
export function resolveToday(cli, cfgToday, env = process.env) {
    if (cli !== undefined)
        return checkToday(cli, '--today');
    if (env['SVG_DIAGRAM_TODAY'])
        return checkToday(env['SVG_DIAGRAM_TODAY'], 'SVG_DIAGRAM_TODAY');
    return cfgToday;
}
