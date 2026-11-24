import {createLayoutWith} from './layout-core.ts';
import {layoutHandlerFor} from './layout-handlers.ts';

export {fitLineScale} from './layout-core.ts';

/** The full entry supplies layout handlers for existing band data. */
export const layoutWith = createLayoutWith(layoutHandlerFor);
