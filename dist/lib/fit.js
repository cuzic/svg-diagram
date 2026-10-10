// Slide-fit estimate for a laid-out diagram: how large will it really be on
// the slide, and is the text still readable when projected?
//
// The slide shows the SVG via <img style="max-height:Npx">, so the on-slide
// scale is min(N / canvasHeight, SLIDE_USABLE_WIDTH / canvasWidth, 1). Text
// that is 14px in the SVG is 14 * scale px on the slide — the 14px floor in
// tokens.ts is only meaningful at scale 1. This turns that into numbers
// before any export: a recommended max-height, and warnings when the
// diagram (banner included) can't fit its height budget without shrinking
// text below `minEffectiveFont`.
//
// When the diagram names its slide (diagram({slide:{page,heading}})), build()
// fills maxDisplayHeight/usableWidth from slide-budget.ts's measurement and
// the defaults below are not used.
//
// `maxDisplayHeight` is the room the slide leaves for the image under its
// badge/breadcrumb/text. The five day2 prototypes needed 270-300px, so 300
// is the default; override per diagram when the slide has less body text.
export const SLIDE_USABLE_WIDTH = 860; // docs/diagram-tone-and-manner.md section 5
export function analyzeFit(d) {
    const maxH = d.maxDisplayHeight ?? 300;
    const minEff = d.minEffectiveFont ?? 12;
    const w = d.width, h = d.canvasHeight;
    const widthScale = Math.min(1, (d.usableWidth ?? SLIDE_USABLE_WIDTH) / w);
    const scaleAt = (hh) => Math.min(widthScale, maxH / hh);
    const scale = scaleAt(h);
    let minSize = Infinity;
    const note = (band) => { for (const r of 'wrappedRuns' in band ? band.wrappedRuns : [])
        minSize = Math.min(minSize, r.size); };
    let bannerH = 0;
    for (const band of d.laidOut) {
        if (band.type === 'row' || band.type === 'grid')
            band.children.forEach(note);
        else
            note(band);
        if (band.type === 'banner')
            bannerH += band.h + d.gap;
    }
    if (!Number.isFinite(minSize))
        minSize = 14;
    if (d.connects.some(c => c.label))
        minSize = Math.min(minSize, 14);
    const recommendedMaxHeight = Math.floor(Math.min(maxH, h * widthScale));
    const effectiveFont = Math.round(minSize * scale * 10) / 10;
    const warnings = [];
    if (d.medium === 'doc')
        return { scale: 1, effectiveFont: minSize, recommendedMaxHeight: h, imgStyle: '', bannerHeight: bannerH, warnings, doc: true };
    if (effectiveFont < minEff) {
        let msg = `on-slide text is ~${effectiveFont}px (< ${minEff}px): the ${w}x${h} canvas must shrink to ${recommendedMaxHeight}px high`;
        if (bannerH > 0) {
            const eff2 = Math.round(minSize * scaleAt(h - bannerH) * 10) / 10;
            msg += `; the banner costs ${Math.round(bannerH)}px of that (without it: ~${eff2}px)`;
        }
        msg += '. Cut text/rows, widen boxes, or raise maxDisplayHeight if the slide has room.';
        warnings.push(msg);
    }
    else if (h * widthScale > maxH) {
        warnings.push(`canvas is ${h}px high but the slide budget is ${maxH}px — the image will be scaled to ${Math.round(scale * 100)}% (text ~${effectiveFont}px).`);
    }
    return { scale, effectiveFont, recommendedMaxHeight, imgStyle: `max-height:${recommendedMaxHeight}px`, bannerHeight: bannerH, warnings };
}
