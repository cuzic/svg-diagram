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

- データに座標・大きさは書かない。`layout` は `1x4`(縦)/ `2x2` / `1x3` / `1x2`(縦の列)と、横に並べる `2x1` / `3x1` / `4x1`(スライド向け。コマは 200px 以上(図の幅が足りないと `comic-band-narrow`)。コマの幅は図の幅を列で割って決まり、`canvas: 'slide'` なら 4×1 は 280px・3×1 は 380px、上限 420px。縦横比の既定は `3:4`)。ふきだしの文字は `comic(sheet, {fontSize: 24})` で大きくできる(14〜28 の整数、既定 18。行・穴・番号札・ふきだしも比例して大きくなり、値を入れても動かない)。スライドの文字の下限 24px を満たすには `fontSize` 24 以上、`numbering: false`、`blank: 'line'`(番号札と案内の字は 14 × `fontSize` / 18 で下限に届かない)。横並びのコマでは、ふきだしは文字の幅になり、2 人が話すコマは横に並べて置く(各行は半分の幅まで。長い行や穴があって並ばないと `comic-tail-crosses-bubble` が出る: 行を短くするか、ふきだしを 1 つにする)。`at` は `left` / `center` / `right`(同じコマで 1 回ずつ)。
- 台詞は `tpl` に `{穴の id}` を書き、`slots` で `{max: 字数(1〜9), prompt: 案内(2〜4 字)}` を決める。穴の id は全体で一意。波括弧そのものは `{{` `}}`。
- **ふきだしが 2 個あるコマでは、合わせて 6 行まで(既定の 6:5。1 個は 3 行まで。穴を含めて、1 行は全角 9 字)。`aspect: '7:5'` なら 4 行まで(1 個を 2 行まで)。** 穴は 1 コマに 2 個まで。穴は最大の字数で数えるので、行数は値で変わらない。
- しっぽは話し手の口へ向く。同じ話し手のふきだしが 2 個あるときは下の 1 個だけに付く。別の話し手のふきだしの後ろを通る(`comic-tail-crosses-bubble`)ときは、話す順か立ち位置を変える。
- 台詞の言い換えで直す: `comic-bubble-zone` / `comic-text-budget`(積みきれない)、`comic-orphan-line`(最後の行が 2 字以下)、`comic-follower-split`(穴の後ろの短いひらがなが切れる)。
- `bubble()` はバブルチャートの名前なので、台詞 1 つの検査は `speechBubble()`。
- 人物は `cast` に書く。内蔵の顔は `face: {hue, hair?}` で指定する。`hue` は 0〜359 の整数、`hair` は `short`(既定)か `long`。`face` を省くと `cast` の順に色が決まる。表情は `neutral` `smile` `laugh` `surprise` `worry` `angry` `think` `sad`。
- 絵師の素材は `cast` の `asset: id` で参照し、`comic(sheet, {characters: {[id]: manifest}})` で渡す。manifest は `{id, name, box, anchors: {head, mouth, hand?, top?}, bubbleSides?, expressions: {neutral: '…', …}, license: {spdx, author, url}}`。
- 素材の `box` の幅と高さは 0 より大きく 4096 以下にする。`anchors.head` の円は `box` に収め、半径は短辺の 1/50 以上、半分以下にする。
- 頭の円より上に絵がある素材では、全表情を通して絵が最も上に達する y を素材の座標で `anchors.top` に指定する。`box[1]` 以上、`head.cy - head.r` 以下の値を指定する。省略時は頭の円の上端を使う。確かめる範囲は、コマに写した絵の上端から頭の円の上端まで、箱の幅いっぱい。絵が箱より狭いと横のふきだしでも `comic-bubble-zone` が出るので、箱を絵に合わせて切る。
- 表情には図形・グループ・グラデーション・クリップパスの SVG 断片を使う。紙色とインク色は十六進表記で指定する(`currentColor` は使えない)。
- `license.spdx` と `license.author` は空でない文字列にする。`license.url` は `http://` または `https://` に続けて空白を含まない文字を 1 字以上書く。ライセンスに不備があると `comic-license-missing` で止まる。素材や表情が見つからない場合は `comic-asset-missing` を報告し、内蔵の顔を描く。

## チャット画面（`chat()`）

同じ台詞を、チャットアプリのような縦の画面にする(ADR 0074 D7)。スライドに「指示を貼る → AI の下書きが返る」のような画面を描くときは、箱とグループで真似ずに `chat()` を使う。

```ts
import {chat, diagram} from 'svg-diagram';
diagram({title: '例', width: 520, legend: false}).add(chat({
  version: 1, title: '案内文の下書き',
  cast: {me: {name: '私'}, ai: {name: 'アシスタント'}},
  dialogue: [
    {id: 'ask', who: 'me', kind: 'say', tpl: '来週の{event}の案内文を作ってください。', slots: {event: {max: 6, prompt: '行事'}}},
    {id: 'ok', who: 'ai', kind: 'say', tpl: '承知しました。下書きを作ります。'},
  ],
}, {input: '指示を入力'}));
```

- 入力は、マンガと同じ `sheet`(`panels` の台詞をコマの順につなぐ。吹き出しの id は `コマ.台詞`)か、`dialogue` の列(`cast` と台詞だけ。id は台詞の id)。座標や大きさは書かない。
- `self`(既定 `'me'`)の台詞は右、ほかは左で、左には丸い顔(素材の `asset` ならその頭の部分。`chat(sheet, {characters})`)と名前が付く。同じ人が続けて話すときは最初の吹き出しにだけ付く。`kind: 'narration'`(`who` なし)は中央に置く。
- 吹き出しの幅は、列(既定 400px)の 70% で折り返した最長の行で決まり、列を超えない(URL など列より広い語は 1 字ずつ折る)。`comic-bubble-wide`(助言)は、穴とひらがなの塊が列を超えるとき。
- `width`(480〜880、4 の倍数。既定 480)で帯の幅を広げられる。列と 70% の折り返し幅が比例して広がるので、スライドに長いやり取りを入れるときは 800 前後にすると背が低くなる。
- 台詞の `\n` は改行、`\n\n` は空行(貼り付けた指示の段落に使う)。`self` を省くと `cast` の `me` が右になる。`me` が無いと `chat-self-missing`。穴の大きさ・状態・値はマンガと同じ。穴の検査もマンガと同じ規則名(`comic-slot-*`)で、話し手が `cast` にないときは `chat-speaker-unknown`。
- 台詞の `id` と穴の `id` は同じにできない(接続の端として同じ名前になるため。投げるときに、どちらを直すか書く)。
- 名前が顔の横に残る幅より広いと `chat-name-wide`(問題)。短くするか、`fontSize` を下げるか、`width` を広げる。`canvas: 'slide'` では、チャットでいちばん小さい字はメッセージ欄の案内(16px 固定。`input` を付けたとき)で、次が名前と穴の案内(`fontSize` の 14/18 倍)。どれも 24px に届かず `slide-min-text` が出る(`accept` で許す)。デッキ(PowerPoint)ではチャットは 1 枚の絵で、小さい文字の警告は出ないので、`check` で確かめる。
- `separators: true` でコマの境に細い線(`sheet` がコマを持つとき)。`input: '案内'`(20 字まで。`true` なら「メッセージを入力」)で、下にメッセージ欄を描く。時刻や既読は出さない。
- 値を入れて描くときは `renderChat(sheet, {measure, values, ...})`(`svg-diagram/browser`。実験的)。選択入口は `svg-diagram/bands/chat`。例は `examples/chat-draft.ts`、`chat-sheet.ts`。JSON の spec ではまだ使えない。
