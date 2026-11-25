import { band } from '../band-def.js';
import { spacer as buildSpacer } from '../dsl/spacer.js';
export const spacerDefinition = {
    type: 'spacer',
    internal: true,
    layout(data, ctx) { ctx.y += data.h; },
    emit: () => '',
};
export function spacer(height) {
    return band(spacerDefinition, buildSpacer(height));
}
