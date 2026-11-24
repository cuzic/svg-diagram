import {fitLineScale} from './layout-cause-fit.ts';
import {decorateDiagram} from './layout-decoration.ts';
import {prepareConnectorGaps} from './layout-connect-gaps.ts';
import {areasPrelayout} from './layout-areas-gaps.ts';
import {scopesOf} from './anchor-scope.ts';
import {CHILD_BANDS, childrenOf, stackWidthOf} from './band-children.ts';
import {buildInventory} from './inventory.ts';
import {resolveConnect} from './layout-connect.ts';
import {createLayoutWith} from './layout-core.ts';
import {layoutHandlerFor} from './layout-handlers.ts';

export {fitLineScale};

/** The full entry supplies layout handlers for existing band data. */
export const layoutWith = createLayoutWith({
  fitLineScale,
  decorate: decorateDiagram,
  resolve: layoutHandlerFor, resolveConnect, childrenOf, stackWidthOf, scopesOf, buildInventory,
  connectorGaps: prepareConnectorGaps,
  areasPrelayoutFor: () => areasPrelayout,
  hasChildrenHandler: band => Object.hasOwn(CHILD_BANDS, band.type),
});
