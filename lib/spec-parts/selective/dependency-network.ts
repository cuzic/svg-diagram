import {defineDependencyNetworkPart} from '../dependency-network.ts';
import {dependencyNetwork} from '../../bands/dependency.ts';

export const dependencyNetworkPart = /* @__PURE__ */ defineDependencyNetworkPart<ReturnType<typeof dependencyNetwork>>(dependencyNetwork);
