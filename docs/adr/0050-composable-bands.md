# ADR 0050: 部品を組み合わせる層(xmonad 風の合成)

- 状態: 設計のみ(未実装、Opus レビュー前)
- 日付: 2026-10-31
- 基点: `main`(PR #351 まで)
- 関連: ADR 0031(FCIS)、ADR 0049(`tree()` のノードに band)、`lib/dsl/defaults.ts`(`connectDefaults`)、`lib/dsl/shared.ts`(`mapBands`)
- 範囲外: レイアウト(配置のパス)を値にして `|||` で切り替えること(D6)、DSL の外の言語(JSON/YAML)での合成

## 背景
ユーザーの依頼は、「全体に monad 合成のような感じで、部品を組み合わせて高度なことができるようにしたい。xmonad みたいな」。

いまの DSL には、合成の半分がある。
- `diagram().add(...)` は連結で、モノイドになっている(単位元は空の `add()`、結合的)。
- `row` / `group` / `grid` / `tree` は入れ子にできる(ADR 0049 で `tree` のノードにも任意の band が置ける)。
- `Declares` / `Refers` の型で、部品が宣言した id が `connect()` の端点として型検査される。
- 「帯 → 帯」の変換は `mapBands`(コンテナの中を辿る)と `applyConnectDefaults` / `applyWireframeDefaults` にあるが、**内部専用で、利用者が自分の変換を書いて重ねる道がない**。`connectDefaults` と `wireframeDefaults` はそれぞれ別の作りで、3 つ目の既定が要るたびに `diagram()` の中身を触ることになる。

xmonad との対応は次のとおり。

| xmonad | ここ | 状態 |
|---|---|---|
| `Layout` を `\|\|\|` で選ぶ | 配置のパス | **範囲外**(D6) |
| `LayoutModifier`(`smartBorders` など) | 帯 → 帯の変換 | なし → D1 |
| `X` モナド(状態・id を持ち回る) | 部品が帯と id(ハンドル)を返す | 型はある、関数の形がない → D2 |
| `ManageHook`(条件で振り分け) | 条件つきの変換 | なし → D3 |
| 設定 = 値の合成(`<+>`) | `diagram({...})` の既定 | 別々 → D4 |

## 決定
### D1: 変換 `Mod` は帯 → 帯の純関数
```ts
type Mod = <B extends Band>(b: B) => B;          // 種類(type)と宣言する id は変えない
pipe(withTone('accent'), spacing(8))             // 左から右へ合成。pipe() は恒等
at(isType('box'), withTone('muted'))             // 条件に合う帯だけ変える Mod
deep(mod)                                        // mapBands で入れ子の中(group・row・grid・tree のノード)まで
```
- **型 `B → B`**: 変換は帯の種類も、宣言する id も変えない。これで `Declares` / `Refers` が合成を通っても崩れない(`const m: Mod` が `IdsOf` を保つ)。種類を変える変換(`row` → `group` など)は Mod ではなく、普通の関数で書く。
- **不変**: 入力を書き換えず `cloneBand` で写す(非列挙の `GIVEN` / ハンドルを保つ。`mapBands` と同じ約束)。同じ band を別の図に置いても変わらない。
- **法則**(テストで固定する): `pipe()` は恒等、`pipe(pipe(a, b), c)` = `pipe(a, pipe(b, c))`、`deep(pipe(a, b))` = `pipe(deep(a), deep(b))`。
- 最初に公開する Mod は少なくする: `withTone`、`withOpts(patch)`(任意の既存オプションを足す)、`mirror`(`row` の `dir` などを反転できる帯だけ。できない帯は throw ではなくそのまま返す)。ほかは使われ方を見て足す。

### D2: 部品は「帯 + ハンドル」を返す関数。`build` で繋ぐ
```ts
const stage = (name: string) => part(p => { const n = p.node({id: name, ...}); return {n} })
const f = build(p => { const a = p.use(stage('a')); const b = p.use(stage('b')); p.connect(a.n, b.n); return {a, b} })
d.add(...f.bands)    // f.value = {a, b}。ハンドルは外の connect にも使える
```
- `build` は帯の列を書き出し(Writer)、部品の戻り値(ハンドル)を後続に渡す(Reader/State)。モナドの `bind` に当たる `p.use(part)` が、部品の帯を書き出しに足してその値を返す。クラスとしての Monad は作らない(TypeScript では `bind` の連鎖より、手続きの書き方のほうが型が通りやすい)。
- 部品が宣言する id は `Declares` として `build` の戻り値の型に出す。**型の検証が要る**(「未決 1」): 配列を `Declares` の和に畳めるか。畳めなければ `build` は `Diagram.add` を直接受ける形(`build(d, p => ...)`)にする。
- 結合法則: `use(use(a) の結果を使う b)` の順序は書き出しの順序と同じ(`build` は逐次実行、副作用は書き出しだけ)。

### D3: `manage` — 条件で振り分ける(ManageHook)
```ts
diagram({theme: 'teal', manage: [
  [isType('connect'), withOpts({weight: 'strong'})],
  [and(isType('box'), inside('group')), withTone('muted')],
]})
```
- 規則は **上から全部を順に適用**(xmonad の `<+>` と同じ。最初の一致で止める `first` も別に用意する)。
- 述語は純関数 `(b: Band, path: Band[]) => boolean`。`isType`、`hasTone`、`inside(type)`、`and` / `or` / `not`。
- 適用は `add()` の時点で、`connectDefaults` → `wireframeDefaults` → `manage` の順(利用者の規則が最後)。`mapBands` で入れ子の中まで届く(ADR 0049 の tree のノードも)。
- **自分で書いたオプションを優先する** ことは、`GIVEN` と同じ作りで守る(`withOpts` は「書かれていないオプションだけ」を足す。上書きは `force: true` で明示)。

### D4: 既存の既定を `manage` の特別な場合に寄せる(第 3 段)
`connectDefaults` / `wireframeDefaults` の中身を、`manage` の規則へ書き直す。公開の形(`diagram({connectDefaults})`)は変えない。**出力は 1 バイトも変えない**(golden で確かめる)。ここで内部の重複が減る(ライブラリ側の利用者)。

### D5: 置き場所と規則
- 純粋なコード: `lib/dsl/compose.ts`(Mod・pipe・at・述語・manage)と `lib/dsl/build.ts`(part・build)。FCIS の SHELL には入れない(`lib/` の純粋側。ratchet は増やさない)。
- `lib/dsl-exports` と ブラウザ入口(`lib/web.ts`)の両方から出す。docs のコード例は `docs-check` を通す。
- 描画のパス・golden は変えない(新しい API を使わない図の出力は同一)。

### D6: レイアウトを値にする案は採らない(今回)
xmonad の核の `|||`(配置の切り替え)は、配置のパスが帯ごとの closed な `switch` なので、開くには全帯の配置に手を入れる大工事になる。D1〜D3 で「包んで調整する」「条件で振り分ける」ことができれば、利用者の依頼の大半は足りる見込み。**開く条件**: D1〜D3 を使っても、「同じ子の並びを、あとから行 ↔ 列に切り替えたい」類の依頼が 2 例以上出たとき。そのときは先に実測(配置のパスで帯の種類が何か所で分岐しているか)から始める。

## 段取り
1. 第 1 段: D1(Mod・pipe・at・deep・述語・`withTone` / `withOpts`)と D3(`manage`)。テストは法則と「入れ子の中まで届く」「入力を変えない」。
2. 第 2 段: D2(`part` / `build`)。型の検証(未決 1)を先に小さく試す。
3. 第 3 段: D4(既存の既定を書き直す。golden が不変)と、既存の帯 1 つを部品で書き直す例。
各段を別 PR にし、段ごとに Opus のレビューを受ける。

## 未決(レビューで聞くこと)
1. 帯の配列と `Declares` の型の畳み込みが TypeScript で成り立つか(D2)。
2. `Mod` を `B → B` に絞ったことで、実際に欲しい変換(`spacing` など)が書けるか。種類を変える変換の居場所が要るか。
3. `manage` の規則を `add()` の時点で適用すると、あとから足した帯(`.add().add()`)にも効くのは正しいか。`diagram()` の作成時にだけ見るべきか。
4. 公開する名前(`pipe` / `at` / `deep` / `build` / `part`)が既存の識別子と衝突しないか(`dsl-exports` の fixture を見る)。
