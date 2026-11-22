# マンガ（`comic()`）

台詞に短い穴(空欄)のあるマンガを、意味が先のデータから描く(ADR 0074。いまは配置まで。穴に値を入れて描き直す `renderComic` は後の段階)。

```ts
import {comic, diagram} from 'svg-diagram';
diagram({title: '例', width: 480, legend: false}).add(comic({
  version: 1, title: '週に一度は早く帰る', layout: '1x4',
  cast: {me: {name: '私'}, col: {name: '同僚'}},
  panels: [
    {id: 'p1', stage: [{who: 'me', at: 'left', expression: 'neutral'}, {who: 'col', at: 'right', expression: 'smile'}],
      dialogue: [{id: 'd1', who: 'col', kind: 'say', tpl: '最近、{change}ね。', slots: {change: {max: 8, prompt: '変化'}}}]},
    // …layout の数(1x4 は 4)だけコマを書く
  ],
}));
```

- データに座標・大きさは書かない。`layout` は `1x4`(縦)/ `2x2` / `1x3` / `1x2`。`at` は `left` / `center` / `right`(同じコマで 1 回ずつ)。
- 台詞は `tpl` に `{穴の id}` を書き、`slots` で `{max: 字数(1〜9), prompt: 案内(2〜4 字)}` を決める。穴の id は全体で一意。波括弧そのものは `{{` `}}`。
- **ふきだしが 2 個あるコマでは、合わせて 6 行まで(既定の 6:5。1 個は 3 行まで。穴を含めて、1 行は全角 9 字)。`aspect: '7:5'` なら 4 行まで(1 個を 2 行まで)。** 穴は 1 コマに 2 個まで。穴は最大の字数で数えるので、行数は値で変わらない。
- しっぽは話し手の口へ向く。同じ話し手のふきだしが 2 個あるときは下の 1 個だけに付く。別の話し手のふきだしの後ろを通る(`comic-tail-crosses-bubble`)ときは、話す順か立ち位置を変える。
- 台詞の言い換えで直す: `comic-bubble-zone` / `comic-text-budget`(積みきれない)、`comic-orphan-line`(最後の行が 2 字以下)、`comic-follower-split`(穴の後ろの短いひらがなが切れる)。
- `bubble()` はバブルチャートの名前なので、台詞 1 つの検査は `speechBubble()`。
