import {defineValueChainPart} from '../value-chain.ts';
import {valueChain} from '../../bands/value-chain.ts';

export const valueChainPart = /* @__PURE__ */ defineValueChainPart<ReturnType<typeof valueChain>>(valueChain);
