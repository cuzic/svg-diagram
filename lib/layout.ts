import {areasPrelayout} from './layout-areas-gaps.ts';
import {scopesOf} from './anchor-scope.ts';
import {CHILD_BANDS, childrenOf, stackWidthOf} from './band-children.ts';
import {buildInventory} from './inventory.ts';
import {resolveConnect} from './layout-connect.ts';
import {createLayoutWith} from './layout-core.ts';
import {layoutHandlerFor} from './layout-handlers.ts';

export {fitLineScale} from './layout-core.ts';

/** The full entry supplies layout handlers for existing band data. */
export const layoutWith = createLayoutWith({
  resolve: layoutHandlerFor, resolveConnect, childrenOf, stackWidthOf, scopesOf, buildInventory,
  areasPrelayoutFor: () => areasPrelayout,
  hasChildrenHandler: band => Object.hasOwn(CHILD_BANDS, band.type),
});
