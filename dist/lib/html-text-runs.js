import { escapeHtmlText as esc, px } from './html-adapter.js';
import { must } from './must.js';
import { PALETTE, runColorOf } from './tokens.js';
function spans(sp, run, color, day, tones, dim) {
    return sp.map(s => {
        const fill = !dim && s.tone ? runColorOf(tones, s.tone, undefined, day) : color;
        const style = `${s.bold && run.weight !== 700 ? 'font-weight:700;' : ''}${fill !== color ? `color:${fill};` : ''}`;
        return style ? `<span style="${style}">${esc(s.text)}</span>` : esc(s.text);
    }).join('');
}
export function textRuns(runs, o) {
    const out = [];
    for (const run of runs) {
        const color = o.dim ? PALETTE.muted : runColorOf(o.tones, run.tone, o.boxTone, o.day);
        const indent = run.indent ?? 0;
        const { ascent, descent } = o.fb(run.size, run.weight, run.mono);
        run.lines.forEach((line, i) => {
            const top = o.originY + must(run.lineYs[i]) - ascent; // one y per line
            const lineSpans = run.lineSpans?.[i];
            const content = lineSpans ? spans(lineSpans, run, color, o.day, o.tones, o.dim) : esc(line).trim();
            out.push(`<div class="sd-t${run.mono ? ' sd-m' : ''}" style="left:${px(o.originX + indent)};top:${px(top)};width:${px(o.w - indent)};text-align:${o.align};font-size:${run.size}px;font-weight:${run.weight};line-height:${ascent + descent}px;color:${color}">${content}</div>`);
        });
    }
    return out.join('');
}
