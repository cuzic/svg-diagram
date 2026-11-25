import { textSvgDefs } from '../emit-box-defs.js';
import { ownRunSizes } from '../band-text-sizes.js';
import { boxItems } from '../inventory-boxes.js';
import { band } from '../band-def.js';
import { banner as buildBanner } from '../dsl/banner.js';
import { renderBanner } from '../emit-banner.js';
import { layoutBoxLike, layoutBoxLikeBand } from '../layout-box-like.js';
import { styledAtoms, textRuns } from '../layout-text.js';
import { fillTextSize } from '../slide-fill-text.js';
import { boxLikeContrastProblems } from '../verify-box-like.js';
export const bannerDefinition = {
    type: 'banner',
    selfDimming: true,
    textSizes: ownRunSizes,
    fillTextSize: (data, roles) => fillTextSize(roles, data.headlineRole),
    inventory: boxItems,
    svgDefs: textSvgDefs,
    title: data => data.headline ? [0, data.headline] : undefined,
    internal: true,
    layoutBoxLike,
    layout: layoutBoxLikeBand,
    measure(data, { atoms, roles }) {
        if (data.stamp)
            atoms(data.stamp, roles.note, 400);
        for (const run of textRuns(data, roles)) {
            for (const { text, weight } of styledAtoms(run))
                atoms(text, run.size, weight, run.mono ? 'mono' : 'sans');
        }
    },
    emit: (laid, env) => renderBanner(laid, env.theme, env.tones, env.roles),
    locations: { drawsFrame: () => true },
    verify: { contrast: (laid, { theme, tones, appearance }) => boxLikeContrastProblems(laid, laid.tone ?? 'accent', theme, tones, appearance) },
};
export function banner(opts) {
    const data = buildBanner(opts);
    return band(bannerDefinition, data);
}
