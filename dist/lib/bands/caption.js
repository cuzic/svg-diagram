import { textSvgDefs } from '../emit-box-defs.js';
import { withSourceLine, withTitleLine } from '../layout-caption-lines.js';
import { ownRunSizes } from '../band-text-sizes.js';
import { captionItems } from '../inventory-boxes.js';
import { captionRects, duplicateTitleFindings, sourceLineFindings } from '../verify-caption.js';
import { band, defOf, walkDefinedBands } from '../band-def.js';
import { caption as buildCaption } from '../dsl/caption.js';
import { captionSpotlight, renderCaption } from '../emit-caption.js';
import { layoutBoxLike, layoutBoxLikeBand } from '../layout-box-like.js';
import { styledAtoms, textRuns } from '../layout-text.js';
import { boxLikeContrastProblems } from '../verify-box-like.js';
export const captionDefinition = {
    type: 'caption',
    selfDimming: true,
    spotlight: captionSpotlight,
    textSizes: ownRunSizes,
    inventory: captionItems,
    svgDefs: textSvgDefs,
    title: data => data.text ? [0, data.text] : undefined,
    internal: true,
    layoutBoxLike,
    layout: layoutBoxLikeBand,
    decorateCaptions(data) {
        return withSourceLine(withTitleLine(data)).bands.map(item => item.type === 'caption' && (item.titleLine || item.sourceLine) && !defOf(item)
            ? band(captionDefinition, item) : item);
    },
    measure(data, { atoms, roles }) {
        for (const run of textRuns(data, roles)) {
            for (const { text, weight } of styledAtoms(run))
                atoms(text, run.size, weight, run.mono ? 'mono' : 'sans');
        }
    },
    emit: (laid, env) => renderCaption(laid, env.theme, env.tones),
    verify: {
        rects: captionRects,
        figureExtent: () => null,
        diagramFindings: diagram => duplicateTitleFindings(diagram, walkDefinedBands),
        layoutFindings: sourceLineFindings,
        contrast: (laid, { theme, tones, appearance }) => boxLikeContrastProblems(laid, null, theme, tones, appearance),
    },
};
export function caption(text, opts) {
    return band(captionDefinition, buildCaption(text, opts));
}
