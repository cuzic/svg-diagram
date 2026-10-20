# ADR 0037: 診断の読みやすさ(凡例・accept・望む結果・CJK の折り返し)と、NBR の向き

- 状態: 実装済み(本 PR)
- 日付: 2026-10-20
- 基点: `main`(PR #309 まで)
- 関連: ADR 0015(TOC の因果ツリーと `tocCheck`)、ADR 0020(NBR・PRT・mirror)、ADR 0019(`maxNodeW`・`dir: 'auto'`)、ADR 0010(幅に収める)
- 由来: 書籍シリーズ「ai-employees」の約 1,500 図を作った 2 つのセッションの報告

## D1. `legend-missing` / `legend-incomplete` は「どの記法が、どこで使われているか」を言う

以前は `凡例にない記法: tone:accent（例: 強調）` だけで、どの箱が原因か分からなかった。今は、トーンなら使っている箱の数と先頭 3 枚の見出し、線・矢印なら該当の本数を添え、直し方(凡例に足す、`legend: 'auto'`、凡例が要らないなら `legend: false`)を書く。キー(`tone:accent` など)は残す。

## D2. どの警告にも、許容するための書き方を付ける

`accept` を知らない利用者が、許容できる警告を残したまま納品した。警告の**表示**に次を付ける: `→ 許容するなら diagram({accept: {'規則名': '理由'}}) か .svg-diagram.json の …`。対象は `RULE_DOCS` にある全規則(= `accept` に書ける規則と同じ集合。`config.ts` が検査に使う表)。
- **出し場所**: `verify.ts` の warnings(`build` が出す)と `check` の本文表示。`Finding.message` 自体は変えない(`--baseline` の指紋が message なので、変えると既存の基準が全部外れる)。
- `check --help` に accept の節を追加。`check --explain RULE` は元からある。
- `toc-ude-count` の message に、部分図(第 1 章だけ等)向けの具体的な書き方を入れた。`accept` が効くことはテストで確かめた(D5)。

## D3. 望む結果が本文に無いとき: `toc-no-desired-result` を別の規則にする

### 緊張
`tocCheck: 'strict'` は、未来現実ツリーに望む結果(`de` / `goal`)を求める(`toc-parts`)。しかし本文に結果の文が無い枝(副作用の枝など)では、満たすために**本文に無い文を作る**誘惑が生じる(実例: biz-tools の ch15-nbr-combine)。検査を通すために図が事実から離れるのは、検査の目的に反する。

### 決定
- 「望む結果が無い」を `toc-parts` から切り離し、独立の規則 `toc-no-desired-result` にする。`toc-parts` は、施策が無い・frt に root がある、だけを担う。
- `accept: {'toc-no-desired-result': '理由'}` で、理由つきで許容できる。message も「本文に無い文を足して満たさない」と言う。
- 互換: 以前 `accept: {'toc-parts': …}` で許容していた図が警告に戻らないよう、`toc-no-desired-result` は `toc-parts` の許容も受ける(`lintDiagram` の `reasonOf`)。
- 却下した案: (a) 検査をやめる — 本当に書き忘れた図を逃す。(b) `de` を空の文字列で置く — 図に空の箱が出る。(c) 既定を info にする — `strict` の意味(望む結果を求める)が弱まる。理由つきの許容なら、**意識して外した**ことが残る。
- NBR(`tree: 'nbr'`)は `de` を求めない(`toc-nbr-parts` は `ude` と `trim`)。副作用の枝を NBR で描けば、そもそも当たらない。

## D4. NBR の枝が 4 本以上で並走・交差が出る件: 向きは自動で切り替えない

### 測定
枝の数 n(施策 1 つから、原因 + 前提 → AND の転換点 → 悪い結果、転換点を断つ施策、を n 本)の合成 NBR を、`diagram` 既定の幅 900px で作った。
- 幅が十分(2400px)だと、既定の向き(下から上)でも `dir: 'right'` でも、`cause-crossing` / `cause-parallel` は出ない(n=2〜6)。**交差・並走は NBR の形そのものでなく、幅に収めるための縮小・折り返しで生じる**(n=3 の既定は maxNodeW を 110 に縮めて層を折り返した結果、2 本交差)。
- 幅に収めたときの最小の幅(`fitLayout` が試した最後の案)。上向きの折り返し付き / `dir: 'right'`: n=4: 1232 / 1317px、n=5: 1686 / 1443px、n=6: 1601 / 1569px。n=3 は 898(収まる、2 本交差) / 1191px。つまり `right` が狭いとは限らない(n=4 は広い、n=5 は狭い)。高さはほぼ同じ。
- 実例(tax-ai の ch12-nbr-patterns)は `dir: 'right'` で 1576px。同じ傾向。

### 決定
- 自動で `dir: 'right'` に切り替えない。切り替えると、幅が増える図(n=3,4)と、幅が減る図(n=5)が混ざり、「ほかは何も変わらない」と言えない。`dir: 'auto'` が因果ツリーで軸を変えないのは ADR 0010 の決定のまま。
- 代わりに、NBR の図(上向き)で `cause-crossing` / `cause-parallel` が出たとき、message に「`{tree: 'nbr', dir: 'right'}` で解消することがある。ただし横に長くなる」を足す(`LaidOutCause.nbr.vertical` で判定。NBR 以外の図、`dir: 'right'` の NBR の message は変わらない)。
- 文書(`skills/svg-diagram/references/toc.md`)に、幅の代償を書いた。

## D5. CJK の折り返し

- 折り返しは既に、仮名・漢字・カタカナの連なりと禁則を守る(`wrap: 'phrase'` が既定、`'bunsetsu'` / `'bunsetsu-soft'` で助詞の手前も避ける。`keepWords: true` で箱を最長の語より狭くしない)。語の途中での割れは、箱が最長の語より狭いときだけ起きる。だから、折り返しの規則を自動で変える余地は無い。
- 診断を具体的にした: `text-mid-word-break` は割れた**語全体**と、その語が必要とする幅(全角の字数)を言う。`source-wraps` は、いまの長さ(全角換算)と、1 行に入る長さ(行の実測)と、縮め先を言う。フォントの幅は推定せず、実際に折り返した行から測る(CI とフォントが違っても、閾値でなく**同じ図の測定値**なので矛盾しない)。

## D6. 読む向きの言い回し

図の種類ごとの読む向き(`causeTree` の既定は下から上、など)と、`sourceLine` の言い回しの表を `skills/svg-diagram/references/toc.md` に書いた。AI が「左が原因、右が結果」と書いてしまう誤りの予防。

## 後回し
- 実在の NBR 図(tax-ai ch12 など)での向きの測定は、手元に図が無く、合成の図だけで測った。
- `accept` の→行は text 表示のみ。`--format json` / `sarif` の finding には付けていない(機械向けには規則名で十分)。
