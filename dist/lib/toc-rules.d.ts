import type { Finding } from './types/verdicts.ts';
import type { CauseBand } from './types/diagrams.ts';
export type TocRule = 'toc-ude-count' | 'toc-parts' | 'toc-no-desired-result' | 'toc-source-has-cause' | 'toc-chain-only' | 'toc-orphan' | 'toc-cycle-undeclared' | 'toc-nbr-parts' | 'toc-nbr-no-tipping' | 'toc-nbr-tipping-not-and' | 'toc-nbr-trim-too-late' | 'toc-tt-unit' | 'toc-prt-bottom-not-action' | 'toc-prt-one-to-one' | 'toc-obstacle-phrase' | 'toc-mirror' | 'toc-injection-to-obstacle' | 'toc-role-indistinct';
export interface TocFinding {
    rule: TocRule;
    message: string; /** Fixed: this finding is always reported at this severity (`toc-obstacle-phrase`: a judgement on Japanese sentence endings, never a warning). */
    severity?: 'info';
}
/** The range of undesirable effects a current reality tree is built from (the guidance of the method, not a measure of the examples). */
export declare const UDE_RANGE: {
    readonly min: 5;
    readonly max: 10;
};
type TocBand = Pick<CauseBand, 'nodes' | 'links' | 'tree' | 'mirrorOf' | 'roleTags'> & {
    id?: string;
};
export declare function tocFindings(band: TocBand): TocFinding[];
export declare function tocLegendFinding(): Finding;
export declare const tocRules: Readonly<{
    readonly 'toc-ude-count': {
        readonly doc: '現状ツリー(causeTree({tree: "crt"}))の UDE が 5〜10 個の範囲の外。部分図なら accept で許容する。diagram({tocCheck: "strict"}) で warn';
        readonly scope: 'band';
    };
    readonly 'toc-no-desired-result': {
        readonly doc: '未来現実ツリー(causeTree({tree: "frt"}))に望む結果(role: de、最終のゴールなら goal)が無い。strict が求めるからと本文に無い文を作らず、本文に結果の文が無い枝(副作用の枝など)は accept で理由を書いて許容する(ADR 0037)。diagram({tocCheck: "strict"}) で warn';
        readonly scope: 'band';
    };
    readonly 'toc-parts': {
        readonly doc: 'TOC のツリーの部品が足りない・違う(crt に根本原因 root が無い、frt に施策 injection が無い、frt に root がある)。frt に望む結果 de / goal が無いのは toc-no-desired-result(ここに accept を書いた図は、そちらも許容される)。diagram({tocCheck: "strict"}) で warn';
        readonly scope: 'band';
    };
    readonly 'toc-nbr-parts': {
        readonly doc: 'ネガティブブランチ(causeTree({tree: "nbr"}))に、トリミングの施策(role: trim)か、悪い結果(role: ude)が無い。diagram({tocCheck: "strict"}) で warn';
        readonly scope: 'band';
    };
    readonly 'toc-nbr-no-tipping': {
        readonly doc: 'ネガティブブランチで、転換点(role: tipping)を通らずに、原因を持たない実体から ude へ至る因果の道が残っている(転換点の無い枝)。diagram({tocCheck: "strict"}) で warn';
        readonly scope: 'band';
    };
    readonly 'toc-nbr-tipping-not-and': {
        readonly doc: 'ネガティブブランチの転換点(role: tipping)が、AND(複数の原因が揃って越える)の結果になっていない。diagram({tocCheck: "strict"}) で warn';
        readonly scope: 'band';
    };
    readonly 'toc-nbr-trim-too-late': {
        readonly doc: 'トリミングの施策(role: trim)が断つ(kind: blocks)先が、転換点より結果側(下流)にある。転換点そのもの、またはその手前を断つ。diagram({tocCheck: "strict"}) で warn';
        readonly scope: 'band';
    };
    readonly 'toc-tt-unit': {
        readonly doc: '移行ツリー(causeTree({tree: "tt"}))の AND の結果が、ニーズ(role: need または precondition)と行動(role: action)の両方を原因に持たない(現状 + ニーズ + 行動 → 新しい現実の単位の形でない)。diagram({tocCheck: "strict"}) で warn';
        readonly scope: 'band';
    };
    readonly 'toc-prt-bottom-not-action': {
        readonly doc: '前提条件ツリー(causeTree({tree: "prt"}))の最下部の中間目標(中間目標の鎖の底)に、行動(role: action)がつながっていない(最下部は、実行できる行動)。diagram({tocCheck: "strict"}) で warn';
        readonly scope: 'band';
    };
    readonly 'toc-prt-one-to-one': {
        readonly doc: '前提条件ツリーの障害と中間目標が、全部 1 対 1 だけ(1 つの中間目標に複数の障害、または 1 つの障害が複数の中間目標を妨げる形が PRT らしい)。diagram({tocCheck: "strict"}) で warn';
        readonly scope: 'band';
    };
    readonly 'toc-obstacle-phrase': {
        readonly doc: '前提条件ツリーの障害のラベルが「ない」「無い」「不足」で終わる(障害は、無いことではなく、そこにある事実で書く指針。日本語の文末の判定なので偽陽性がある。常に info)';
        readonly scope: 'band';
    };
    readonly 'toc-injection-to-obstacle': {
        readonly doc: '未来現実ツリー(causeTree({tree: "frt"}) など)で、施策(role: injection)から障害(role: obstacle)へ通常の矢印(kind が blocks でない)が引かれている。矢印は「原因が結果を生む」と読まれるので、施策が障害を生むと逆の因果に読まれる。施策が障害を断つ・防ぐ意味なら、そのリンクに kind: "blocks" を付ける(破線と横棒の止め方になる)。diagram({tocCheck: "strict"}) で warn。';
        readonly scope: 'band';
    };
    readonly 'toc-role-indistinct': {
        readonly doc: 'tree を書いた causeTree に root / goal / start（どれも同じアクセント色の二重枠）があるのに、roleTags が無い。別々の図で同じ見た目が別の意味を持つ（現状ツリーの根本原因と、未来現実ツリーのゴール・施策）と、白黒や凡例なしでは取り違える。causeTree({roleTags: true}) で役割を文字にする。情報（check --strict は落ちない）。文書をまたぐ版は check --docs 側の後続';
        readonly scope: 'band';
    };
    readonly 'toc-legend-suggested': {
        readonly doc: "tree を書いた causeTree を含む図に、legend の指定がない。役割は色と枠でしか区別されない。diagram({legend: 'auto'}) を付けるか、causeTree({roleTags: true}) で役割を文字にする。情報。legend: false と書けば出ない";
        readonly scope: 'diagram';
    };
    readonly 'toc-mirror': {
        readonly doc: '未来現実ツリー(causeTree({tree: "frt", mirrors: crt}))の望む結果(de / goal)の mirrors が、現状ツリーの ude の id でない、ude に対応する望む結果が無い、同じ ude を複数が mirrors している(1 対 1 でない)。diagram({tocCheck: "strict"}) で warn';
        readonly scope: 'band';
    };
    readonly 'toc-source-has-cause': {
        readonly doc: '原因を持たない役割(crt の root、frt・nbr の injection、nbr の trim、precondition)の実体に、入る矢印がある。diagram({tocCheck: "strict"}) で warn';
        readonly scope: 'band';
    };
    readonly 'toc-chain-only': {
        readonly doc: 'crt / frt が分岐も合流も AND も無い 1 本鎖(途中の原因を飛ばしている可能性)。diagram({tocCheck: "strict"}) で warn';
        readonly scope: 'band';
    };
    readonly 'toc-orphan': {
        readonly doc: 'causeTree({tree}) の実体のうち、どのリンクにも出てこないものがある(graph-orphan-node は connect() の線しか見ない)。diagram({tocCheck: "strict"}) で warn';
        readonly scope: 'band';
    };
    readonly 'toc-cycle-undeclared': {
        readonly doc: 'causeTree({tree}) に循環があるのに、戻りの矢印に back: true が付いていない(配置が戻りとして扱った矢印を示す)。diagram({tocCheck: "strict"}) で warn';
        readonly scope: 'band';
    };
}>;
export {};
