import { ceil4, connectRoom, hidesArrow, labelCover } from './connect-rules.js';
import { at } from './finding-rules.js';
import { must } from './must.js';
export function labelCoverFindings(d) {
    // the room each hidden label needs (labelRoom(), the basis the layout widens gaps by: ADR 0069 D1), on straight connects
    const hidden = (d.connects ?? []).filter(c => { const cover = c.label ? labelCover(c) : undefined; return !!cover && hidesArrow(cover); });
    const hits = hidden.map(c => { const cover = must(labelCover(c)), need = connectRoom(c); return `「${c.label}」(${c.fromId}→${c.toId}、見える部分 ${Math.round(cover.visible)}px${need !== undefined && Number.isFinite(need) ? `、要る間隔 ${ceil4(need)}px` : ''})`; });
    const needs = hidden.map(c => connectRoom(c)).filter((n) => n !== undefined && Number.isFinite(n));
    const widen = needs.length === 1 && hidden.length === 1 ? `箱の間隔を ${ceil4(must(needs[0]))}px 以上に広げる` : needs.length ? '箱の間隔を、それぞれの要る間隔以上に広げる' : '箱の間隔を広げる';
    return hits.length ? [{ ...at(hidden[0], ...hidden.slice(1)), rule: 'connect-label-covers-arrow', severity: 'warn', message: `矢印のラベルが矢印のほとんどを覆っていて、向きが読めない: ${hits.slice(0, 4).join('、')}${hits.length > 4 ? ` ほか ${hits.length - 4} 件` : ''}。直し方: ${widen}、ラベルを短くする、ラベルを箱の中に書く` }] : [];
}
