import { valueChainBand } from '../flow-value-chain.js';
import { withHandle } from './shared.js';
/**
 * Porter's value chain (価値連鎖 / バリューチェーン): support activities (支援活動) as bars over the primary activities (主活動) as chevrons, with the
 * margin (マージン) as an arrow at the right end. Items are labels or `{label, sub, id, tone}`; ids are anchors for connect() and spotlight.
 *   valueChain({support: ['全般管理', '人事・労務管理', '技術開発', '調達活動'], primary: ['購買物流', '製造', '出荷物流', '販売・マーケティング', 'サービス']})
 * `margin: false` leaves the arrow out (a chain of activities only); `titles: false` leaves out the two captions.
 */
export function valueChain(parts, opts) { return withHandle(valueChainBand(parts, opts), opts?.id); }
