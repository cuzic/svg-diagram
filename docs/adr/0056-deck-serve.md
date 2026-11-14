# ADR 0056: デッキをサーバーで表示し、全端末を発表者のスライドに合わせる(`svg-diagram serve` と、自分でデプロイする Worker)

- 状態: 提案(実装は未着手。Opus のレビューを 1 回反映)
- 日付: 2026-11-14
- 基点: `main`(837df96、PR #364 まで)
- 関連: ADR 0018(deck viewer)、ADR 0055(デッキの JSON と PowerPoint 書き出し)、ADR 0007(結果が入力だけで決まること)、ADR 0012(id の衝突)、ADR 0013(失敗したビルドの古い出力)

## 背景

ADR 0055 で、デッキ(`deck.json`: 見出し・リード・図・強調の枠・出典・ノート)を PowerPoint にできるようになった。けれども、書いたデッキを**その場で発表する**手段がない。

- 確かめるには、毎回 `pptx-deck` で .pptx を作り、PowerPoint などで開き直す。図を 1 つ直すたびに、この往復になる。
- `svg-diagram deck`(ADR 0018)はブラウザで前へ・次へができるが、入力は図(`.ts` / `.svg`)の並びで、デッキの見出し・リード・枠・ノートを描かない。出力は 1 つの HTML ファイルで、書き換えても再読み込みされない。発表者の画面もない。

Slidev(`slidev slides.md`)のように、**デッキのファイルを渡すとサーバーが立ち上がり、ブラウザで発表でき、保存すると表示が変わり、発表者の画面(ノート・次のスライド・時間)が出る**ものがほしい、という要望が届いた。あわせて、次が決まった(2026-11-14、利用者の決定)。

- コマンドの名前は `serve`。
- 別の端末と表示を同期する。**接続しているすべての端末に、発表者と同じスライドを強制的に表示する**(聴き手は自分でページを動かせない)。
- Cloudflare Workers にデプロイして、会場の外の端末からも見られるようにする。ただし**発表者がそれぞれ自分の Cloudflare にデプロイし、設定値も自分で決める**。運営者の Cloudflare(svg-diagram.app)をみんなで使う形にはしない。
- 発表者は、メールアドレスかトークンで見分ける。メールアドレスは **Cloudflare Access と Google の OAuth の両方**に対応し、デプロイする人が設定で選ぶ。
- 聴き手は URL だけで見られる(サインインなし)。聴き手の URL は **QR コード**でも出す。
- 同時接続数・期限・大きさの上限は、デプロイする人が設定値で決める(こちらは既定値を示す)。
- Worker は core の `worker/` に置き、`serve --publish` と同じ版で配る。

### 現状(コードで確かめたこと)

| 既存 | できること | 足りない点 |
|---|---|---|
| `deck`(`deck-diagram.ts`、`lib/deck-html.ts`、`lib/deck-viewer/`) | 図の並びを 1 つの自己完結した HTML に。矢印キー、一覧、拡大、URL のハッシュ、印刷 | 入力が図だけ(`lib/deck-args.ts`)。見出しやノートがない。サーバーも監視もない |
| `pptx-deck`(`pptx-deck-diagram.ts`、`lib/pptx/deck.ts`) | `deck.json` を 16:9 の .pptx に。見出しなどは実測した幅で折り返し(`wrapped`)、残りの領域に図を置く(`planDeckSlide`) | 出力は .pptx だけ。配置の結果は PowerPoint の XML で、HTML や SVG には使えない |
| `load-source.ts` の `importDefine(abs, {fresh: true})` | 編集した `.ts` と、その中で import した手元のファイルを読み直す(`lib/resolve-hook.ts` が URL に印を付けて回す) | 読み込んだファイルを記録しない(監視する先が分からない)。`fresh` の読み込みごとにモジュールが増え、Node は解放しない |
| `lib/svg-outline.ts`(`outlineText`) | SVG の文字をグリフの輪郭(path)にする。絵文字は文字のまま残せる(`liveEmoji`) | 手元の CLI からは使っていない。harfbuzzjs は core の依存にすでにある |
| `.svg-diagram.json` の `measure` / `fonts`(`lib/types/project.ts`) | 既定(`'font'`)はフォントのファイルで測る | `'chromium'` のときは測ったフォントのファイルが手元に特定できない |

## 関連プロジェクトの調査(2026-11-14)

発表用のツールが「サーバーとして表示する」ときに持つ機能を、公式の文書で確かめた。

### Slidev(`slidev [entry]`)

- **開発サーバー**: `--port`(既定 3030)、`--open`、`--remote [password]`(公開のアドレスで待ち受け、パスワードを付けると発表者の画面だけ守られる。スライド自体は守られない)、`--bind`(既定 0.0.0.0)、`--tunnel`(Cloudflare Quick Tunnel で外に出す)。
- **操作**: →・space(次のアニメーションかスライド)、←、↓↑(スライド単位)、`f` 全画面、`o` 一覧、`d` ダーク、`g` 番号へ移動。
- **画面の URL**: `/<n>`(発表)、`/presenter`(発表者)、`/overview`(全スライドとノートの一覧)、`/notes-edit`(ノートの編集)。
- **発表者の画面**: 今のスライド、次のスライド、ノート、タイマー(経過・残り)、クリック数。配置は 3 種類。別の画面の映し込み。
- **窓の同期**: 発表者の画面で進めると、開いているほかの画面がすべて追従する(既定で有効、設定で切れる)。通信の仕組みは文書に書かれていない。**聴き手が自分で動くことは止めない**。
- **そのほか**: 描き込み、録画、カメラ、CSS フィルタ、カーソルを隠す、Fit / 1:1、Wake Lock。
- **書き出し**: `slidev build`(静的な SPA、`--without-notes`)、`slidev export --format pdf|png|pptx|pptx-editable|md`。

### Marp CLI(`marp`)

- **サーバーモード**(`--server`): ディレクトリを配信し、HTTP の要求ごとに変換する。URL のクエリで形式を選ぶ(`deck.md?pdf`、`?pptx`、`?png`)。
- **監視**(`--watch`): Markdown とテーマの CSS が変わると変換し直し、開いている HTML を再読み込みする。
- **bespoke テンプレート**: キーボードとスワイプ、`f` 全画面、画面上の操作バー、リストの段階表示、`p` で別窓の発表者の画面(同じブラウザの中だけ)、`o` で一覧、進み具合のバー、View Transition API の切り替え効果。
- **書き出し**: PDF(ノートを注釈に)、PPTX(スライドは画像)、画像、ノートのテキスト。

### reveal.js

- **発表者の画面**(`s`): ノート、次のスライド、経過時間、時計、ペース配分(`defaultTiming` / `totalTime`、色で早い遅いを示す)。
- 別の端末でノートを見るための Node のサーバー(notes server)がある。

### 比べた結果と、ここで採るもの

| 機能 | Slidev | Marp | reveal.js | 本 ADR |
|---|---|---|---|---|
| サーバー、ポート指定、ブラウザを開く | ○ | ○ | (外部) | **採る**(D1) |
| 保存すると表示が変わる | ○ | ○ | − | **採る**(D5) |
| キー操作・一覧・全画面・番号へ移動 | ○ | ○ | ○ | **採る**(D8。聴き手には全画面だけ) |
| 発表者の画面(今・次・ノート・時間) | ○ | ○ | ○ | **採る**(D7) |
| 発表者に全端末が追従 | ○(任意で離れられる) | 同じブラウザだけ | ○ | **採る、強制**(D6) |
| 発表者の見分け | パスワード | − | − | **トークン、メールアドレス(Access か Google)**(D9、D13) |
| インターネットへの公開 | トンネル | − | − | **自分の Cloudflare に Worker をデプロイ**(D11〜D16) |
| QR コード | − | − | − | **採る**(D10) |
| 印刷して PDF | ○ | `--pdf` | `?print-pdf` | **印刷用 CSS だけ**(D4) |
| 段階表示・切り替え効果・描き込み・録画・ノート編集 | ○ | 一部 | 一部 | 見送り(D18) |

## 決定

### 共通: スライドの形

- D1. **入口**: `svg-diagram serve <deck.json> [--port N] [--host ADDR] [--allow-host NAME]... [--open] [--publish [ORIGIN]]`。
  - 入力は ADR 0055 のデッキそのもの。`figure` に spec のほか `.ts` / `.json` へのパス(デッキのファイルからの相対)を書けるのも `pptx-deck` と同じ。読み込みとパスの解決は `pptx-deck-diagram.ts` から `lib/deck-load.ts` に移し、両方から使う。
  - ポートの既定は 3030。使われていれば次の空きを探し、実際の URL を出す。`--host` の既定は `127.0.0.1`。
  - 図だけの並び(`deck a.ts b.ts`)は対象にしない。
- D2. **スライドは 1 枚の SVG**(手元と Worker で同じもの)。1280 × 720 の SVG に、見出し・リード・図・強調の枠・出典を描き、**文字はすべて輪郭(path)にする**。
  - 配置は `planDeckSlide` と同じ計算: 見出しなどは実測した幅で折り返し、残った領域に図を収まる倍率(上限 1.25)で置く。寸法・色・行の高さ・折り返しの計算は `lib/pptx/deck.ts` から `lib/deck-layout.ts` に移し、PowerPoint と SVG の両方が使う(`planDeckLayout` が行と矩形の位置を返し、XML と SVG はその後で作る)。小さい文字の警告(9pt 未満)と、領域が残らない誤りも同じ条件で出る。
  - 輪郭にするフォントは、測ったのと**同じフォントのファイル**(`.svg-diagram.json` の `fonts`、なければ fontconfig で見つけたもの。`pptx` の PNG と同じ `fontFilesOf`)。端末にどのフォントがあっても、行の数も幅も変わらない。`measure: 'chromium'` のプロジェクトでは、輪郭のフォントと測ったフォントが違いうるので、起動時に 1 度警告する。
  - フォントにないグリフは、そのスライドの誤り(場所付き)。絵文字は `liveEmoji` で文字のまま残す(端末の絵文字のフォントで描かれる)。
  - スライドの文字は `<title>` と `aria-label` にも入れる(読み上げのため。輪郭だけだと読めない)。
  - 図の `<metadata>` は取り除き、id はスライドごとに付け替える(ADR 0012。1 枚の SVG に図が 1 つなので衝突しない)。
- D3. **SVG の許可リスト**: スライドの SVG に出てよい要素と属性の一覧を core に 1 つ置く(`lib/present/svg-allow.ts`)。輪郭にした後の SVG を、**手元で保存したとき**(D5)と、**Worker が受け取ったとき**(D12)の両方でこの一覧に当て、外れたものがあればそのスライドの誤りにする(直して通すのでなく、断って場所を返す)。
  - 一覧には、描画が出しうるもの(グラデーション、クリップ、画像の帯の `<image href="data:image/png|jpeg…">`、絵文字の `<text>`)を入れ、`<script>`・`<foreignObject>`・`on*` 属性・`#` と `data:image/(png|jpeg)` 以外の `href`・`<style>` の `@import` と外部の `url()` は入れない。
  - core の全部の example をスライドにしてこの一覧を通るテストを置く(描画が新しい要素を出すようになると落ちる)。
  - 画面では、スライドを `<img>` で読む。`<img>` の中の SVG はスクリプトを動かさない。
- D4. **画面**(`svg-diagram/present` の出口から、手元と Worker で同じ JS・CSS を配る):
  - 聴き手の画面: 今のスライドを窓いっぱいに 1 枚。URL は 1 つ(`/` または `/p/<id>`)で、スライドの番号は URL に持たない(強制の追従なので意味がない)。隅に接続の状態(「再接続中」)。全画面のボタン。
  - 発表者の画面: 今のスライド、次のスライド、ノート(改行・空行・字下げを保つ)、経過時間(押すと 0 に)、時計、`n / 全体`、接続している聴き手の数、聴き手の URL の QR(D10)、描き直しの誤り(D5)。一覧(`o`)は発表者の画面の中だけ。
  - 印刷(`/print`、発表者だけ): 全スライドを 1280 × 720 のページに。ノートは入れない。

### 共通: 保存すると変わる

- D5. **監視と描き直し**(手元の CLI):
  - 監視するのは、デッキのファイル、パスで書いた図、`.ts` が import した手元のファイル、`.ts` がファイルとして読むもの(`image()` の画像)、`.svg-diagram.json`、フォントのファイル。import したファイルは、`lib/resolve-hook.ts` に**解決したファイルを記録する**働きを足して集める。ファイルではなく**入っているディレクトリ**を監視する(名前を付け替えて保存するエディタでも外れない)。
  - 変わったら 100ms 待ってまとめて描き直す。描き直しは 1 つずつで、描いている間に変わったら終わってからもう一度描く。スライドごとの結果は入力の中身のハッシュで覚え、変わったスライドだけ描き直す。
  - `.ts` の読み直し(`fresh`)はモジュールを増やし続けるので、描き直しは `worker_threads` の中で行い、50 回ごとに作り直す。
  - 描き直しで誤りが出たら、**前の正しいスライドを残し**、発表者の画面にだけ誤りを場所付き(`slides[2].figure.parts[0]` など)で重ねる。端末にも同じものを出す。聴き手には見せない。
  - スライドが減って、今の番号がなくなったら最後のスライドに移す。

### 共通: 同期

- D6. **全端末の強制的な追従**:
  - 端末の役割は 2 つ: **発表者**(スライドを動かせる、ノートが見える)と**聴き手**(見るだけ)。
  - サーバーは今の状態 `{epoch, seq, index, version}` を 1 つ持つ。`epoch` はサーバー(手元の起動、Worker の発表)ごとの乱数、`seq` は番号を変えるたびに増える通し番号、`version` はスライドの写しの版。
  - 発表者から `{type: 'go', index}`。サーバーは範囲に収めて `seq` を増やし、**接続しているすべての端末**(発表者のほかの窓も)へ `{type: 'state', epoch, seq, index, version, slides}` を送る(`slides` はスライドの SVG の URL の一覧。版が変わったときだけ付ける)。
  - 端末は、`epoch` が変わったら持っているものを捨てて受け取ったものにし、同じ `epoch` では `seq` が今より大きいものだけ採る(古い知らせで戻らない。サーバーを立ち上げ直しても止まらない)。
  - 聴き手の画面は、キー・クリック・スワイプでは動かない。聴き手から来た `go` は、サーバーが捨てる。
  - つなぎ直すと、まず今の状態を受け取る。つなぎ直しは、待ち時間を倍にしていく(上限 30 秒)うえに乱数でずらす(会場の Wi-Fi が戻ったとき全員が同時につながらない)。
  - 発表者の `go` は 1 接続あたり 1 秒に 10 回まで(超えたものは捨てる)。
  - スライドの SVG の URL は中身のハッシュ(`/s/<hash>.svg`)。版が変わってもブラウザのキャッシュで古いものが出ない。
  - ノートは発表者にだけ、別の要求(`Cache-Control: private, no-store`)で渡す。
  - この決まり(型と状態の計算)は `svg-diagram/present` に純粋な関数として置き、テストする。運ぶ手段は分ける: 手元は Server-Sent Events と `POST`(`node:http` だけで書ける)、Worker は WebSocket(D14)。ブラウザ側は小さなアダプタ 2 つで違いを吸収する。同じブラウザの複数の窓は、BroadcastChannel で 1 本の接続を分け合う(HTTP/1.1 の 1 オリジン 6 接続の上限で、手元の発表者の窓が詰まらないように)。
- D7. **発表者の画面の操作**(D4 の画面): → / space / PageDown / ↓(次)、← / PageUp / ↑(前)、Home / End、`o`(一覧)、`f`(全画面)、`g`(番号へ移動)、`p`(発表者の画面を別窓で)。スワイプでも動く。カーソルは 2 秒で隠す。

### 手元のサーバー(`svg-diagram serve deck.json`)

- D8. **URL**: `/`(聴き手)、`/presenter`(発表者)、`/print`(発表者)、`/api/events`(SSE)、`/api/go`(`POST`、発表者)、`/api/notes`(発表者)、`/s/<hash>.svg`(スライド)、`/deck.pptx`(その時点のデッキを `pptx-deck` と同じ処理で .pptx に。発表者)、`/claim`(`POST`、D9)。これら以外は 404。手元のファイルを名前で配らない。
- D9. **発表者の見分けと安全**:
  - 立ち上げるたびに発表者のトークン(128 ビットの乱数)を作り、端末に**発表者の URL**(`/presenter#token=…`)を出す。ブラウザはハッシュのトークンを `POST /claim` で渡して Cookie に替え、すぐに `history.replaceState` でアドレス欄からハッシュを消す(映した画面に出ない)。
  - Cookie は `HttpOnly; SameSite=Strict; Path=/`、名前にポートを入れる(`sd-presenter-3030`。Cookie はポートで分かれないので、2 つの `serve` が上書きし合わない)。
  - `Host` が `localhost`・`127.0.0.1`・待ち受けているアドレス(`--host 0.0.0.0` のときは全部のインターフェイスのアドレス)と `--allow-host` の名前(`.local` など)に、ポートを付けたもの以外なら断る(DNS の付け替えで別のサイトから読まれるのを防ぐ)。`POST` と SSE は `Origin` が自分のときだけ受ける。
  - 同じ LAN の端末に見せるには `--host 0.0.0.0` で立ち上げる。LAN では HTTP なので Cookie とトークンは同じネットワークの人に盗み見られうる、と起動時に表示する(会場の Wi-Fi で発表するなら `--publish` を勧める)。
  - サーバーが実行するのは、デッキのファイルに書かれた `.ts` だけで、`build` と同じ信頼(書き手の手元のコード)。ブラウザから受け取るのはスライドの番号だけ。
- D10. **QR コード**: 聴き手の URL(手元なら LAN のアドレスの `/`、`--publish` なら Worker の `/p/<id>`)を、起動時に端末へ(Unicode の半角ブロックで)、発表者の画面にも(SVG で)出す。**発表者の URL は QR にしない**。QR の符号化は依存を増やさず core に純粋な関数として持ち(バイトモード、誤り訂正 M、URL が入る版まで)、既知の値と読み取りの往復でテストする。

### 自分でデプロイする Worker(`worker/` と `svg-diagram serve --publish`)

- D11. **配り方**: core のリポジトリの `worker/` に、Cloudflare Workers のプロジェクト一式(`src/`、`wrangler.jsonc.example`、README のデプロイ手順)を置く。発表者は自分の Cloudflare のアカウントで `wrangler deploy` する。運営者のサーバーは使わない。Worker のコードは core の `svg-diagram/present`(画面、同期の決まり、SVG の許可リスト)を使い、core の版と一緒に版を切る。
  - Worker は描画しない(`.ts` も spec も受け取らない)。手元で描いた SVG を受け取って配るだけなので、フォントも harfbuzz も載せず、小さく保つ。
  - 1 つの Worker に発表をいくつも置ける。発表 1 つに Durable Object(SQLite を持つ型)を 1 つ使う。D1・KV・R2 は使わない(デプロイする人が用意するものを減らす)。
- D12. **送る**(`svg-diagram serve deck.json --publish [ORIGIN]`):
  - `ORIGIN` は引数か環境変数 `SVG_DIAGRAM_PUBLISH_ORIGIN`(core のコードに送り先の名前を書かない)。送るための鍵は環境変数 `SVG_DIAGRAM_PUBLISH_TOKEN`(Worker の secret `PUBLISH_TOKEN` と同じ値。デプロイする人が決める)。
  - 初めて送るとき `POST /api/p` で発表を作り、Worker が返す `id` と発表者のトークンを**デッキの隣の `<deck>.publish.json`** に書く(README で `.gitignore` に入れるよう書き、ファイルの権限は 0600)。2 回目からは同じ発表を `PUT /api/p/<id>` で差し替える(送るたびに URL が変わらない)。
  - 差し替えは、まずスライドのハッシュの一覧(と文字・ノート)を送り、Worker がまだ持っていないハッシュの SVG だけを送る。版は Worker が決める。
  - `--publish` のときは手元のサーバーを立ち上げない。監視して送り、端末に聴き手の URL(と QR)と発表者の URL を出す(手元の発表者の画面で動かしても、Worker の聴き手には届かないため)。
  - `id` は 128 ビットの乱数に、Worker の secret による署名を付けたもの。署名の合わない `id` への要求は、Durable Object を起こす前に 404 にする(知らない `id` で空の Durable Object が増えない)。
  - Worker は受け取った SVG を D3 の一覧に当て、外れたら 422 と場所を返す。上限(D16)を超えたら 413 と場所。
- D13. **Worker での発表者の見分け**: 次のどれか。それ以外は聴き手。
  1. **発表者のトークン**(いつでも使える): `--publish` が作り、`<deck>.publish.json` に持つ。発表者の URL は `/p/<id>/presenter#token=…`。手元と同じく `POST /p/<id>/claim` で Cookie に替え、ハッシュを消す。トークンは 1 つの発表に 20 本まで、`svg-diagram serve deck.json --publish --new-presenter-token` で足し、`--revoke-presenter-tokens` で全部取り消す。Durable Object にはハッシュだけを置く。
  2. **メールアドレス**(設定 `PRESENTER_LOGIN` で `access` か `google` を選ぶ。`none` ならトークンだけ): 確かめたメールアドレスが、設定 `PRESENTER_EMAILS`(カンマ区切り)にあれば発表者。
     - `access`: 発表者の URL(`/p/*/presenter`、`/p/*/claim`、`/p/*/print`)を、デプロイする人が Cloudflare Access(Zero Trust)のアプリにする。Worker は要求の `Cf-Access-Jwt-Assertion` を、設定 `ACCESS_TEAM_DOMAIN` の公開鍵と `ACCESS_AUD` で検証し、その中のメールアドレスを使う(ヘッダーのメールアドレスをそのまま信じない)。
     - `google`: Worker が Google の OpenID Connect(PKCE、`state`、`nonce`)を持つ。デプロイする人が Google Cloud で作ったクライアントの `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` を secret に入れる。`email_verified` が真のときだけ使う。Google は `email` を識別子に使わないよう勧めている(持ち主が変わりうる)ので、設定 `GOOGLE_HD` があれば `hd` の一致も求める。設定しないときの弱さ(Workspace でないドメインのアドレスは、そのメールを失った元の持ち主の Google アカウントに残りうる)を README に書く。サインインの後は、元の発表者の URL に戻る(戻り先は `/p/<id>/presenter` の形だけ許す)。
  - Cookie(`__Host-p-<id>`、`HttpOnly; Secure; SameSite=Strict`、8 時間)には `{id, 種類, トークンの id かメールアドレス, 期限}` を Worker の secret `SESSION_SECRET` で署名して入れる。発表者の要求と WebSocket の接続のたびに、トークンの id が取り消されていないか、メールアドレスがまだ `PRESENTER_EMAILS` にあるかを確かめる(取り消してから期限まで使えてしまわない)。
- D14. **Worker での同期**:
  - 発表 1 つに 1 つの Durable Object が、WebSocket(ハイバネーション API)で全端末とつながる。WebSocket の接続(`/p/<id>/ws`)は `Origin` が自分のオリジンのときだけ受ける。
  - 役割は Worker が D13 で決め、Durable Object へは Worker が付けるヘッダーで渡す(端末から来た同じ名前のヘッダーは先に消す)。Durable Object は接続にタグ(`role:presenter`、`tok:<id>`、`email:<hash>`)と attachment を付け、ハイバネーションから戻っても役割を失わない。トークンを取り消すと、そのタグの接続を切る。
  - 今の状態(D6)は Durable Object の SQLite に書く(Durable Object が退いても戻る)。
  - 聴き手の接続数を IP ごとには数えない(会場の Wi-Fi では全員が同じ IP になる)。1 つの発表の同時接続数の上限(D16)で守り、超えたら「満員」を返す。
  - Worker を新しくデプロイすると、つながっている WebSocket は切れうる。端末は D6 のつなぎ直しで戻るが、発表中はデプロイしないよう README に書く。
- D15. **期限と消し方**: 発表は、最後に使った日時(差し替えか、発表者の接続)から設定 `RETENTION_DAYS` 日で、Durable Object の alarm が `deleteAll()` で消す。`svg-diagram serve deck.json --publish --delete` でいつでも消せる(`<deck>.publish.json` も消す)。消した発表の URL は 404。Durable Object の中身は、Cloudflare の point-in-time recovery の期間(30 日)は戻せる形で残ることを README に書く。
- D16. **設定値**(`wrangler.jsonc` の `vars`。既定値はここに書いたもの): `MAX_CONNECTIONS`(500)、`RETENTION_DAYS`(30)、`MAX_SLIDES`(30、core の `MAX_SLIDES` が上限)、`MAX_SLIDE_BYTES`(1 MiB)、`MAX_DECK_BYTES`(8 MiB)、`PRESENTER_LOGIN`(`none`)、`PRESENTER_EMAILS`、`ACCESS_TEAM_DOMAIN`、`ACCESS_AUD`、`GOOGLE_HD`、`LOCATION_HINT`(Durable Object の置き場所の希望。未設定なら Cloudflare に任せる)。secret は `PUBLISH_TOKEN`、`SESSION_SECRET`(`id` の署名と Cookie)、`google` のときの `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`。値が足りない・矛盾するとき(`google` なのに client がない、`access` なのに AUD がない)は、Worker は要求に答えず設定の誤りを返す。
  - 聴き手のページには `X-Robots-Tag: noindex` を付ける。発表の中身(スライド・ノート・メールアドレス)とトークンと `id` はログに出さない。
  - 運営するのはデプロイした人で、その発表の中身と聴き手への責任もデプロイした人にある、と README に書く。

### 確かめ方と、今回入れないもの

- D17. **純粋な部分と外側**: 引数の解釈、URL の振り分け、レイアウトの数値、スライドの SVG、許可リスト、状態と同期の計算、QR の符号化は I/O を持たない関数にし、`node --test` で確かめる。手元のサーバーは空いているポートで実際に立ち上げてテストする(SSE、追従、聴き手が動けないこと、描き直し、誤りが発表者にだけ出ること、トークン、Host と Origin)。Worker は workerd(`wrangler dev` 相当)でテストする(聴き手の `go` が捨てられる、発表者の `go` が全端末に届く、ノートが聴き手に届かない、許可リストにない SVG を断る、取り消したトークンの接続が切れる、署名の合わない `id` で Durable Object を起こさない、期限、設定の誤り)。Chromium(Playwright)で 2 つの窓の追従を見る。
- D18. **今回入れないもの**: 段階表示(デッキの JSON に段階がない)、切り替え効果、描き込み、録画、カメラ、ノートの編集、テーマ、聴き手のサインイン、聴き手が一時的に離れて前のスライドを見る機能、ペース配分のタイマー、Worker からの .pptx(手元の `/deck.pptx` か `pptx-deck` を使う)、運営者が用意する共有のサーバー。

## 結果(見込み)

- `deck.json` を書きながら `svg-diagram serve deck.json` を立ち上げておけば、保存するたびにブラウザの表示が変わり、そのまま発表できる。同じ LAN の端末は聴き手の URL(QR)で、発表者と同じスライドを見る。
- 自分の Cloudflare に `worker/` をデプロイしておけば、`--publish` で会場の外の端末も同じスライドを見る。保存した変更もそのまま届く。手元のパソコンや回線が切れても、聴き手の表示は最後のスライドのまま残り、発表者は別の端末(トークンかメールアドレス)で続けられる。
- スライドは文字まで輪郭にした SVG なので、どの端末でも同じ見た目になり、PowerPoint の書き出しとも同じ配置になる。

## 検討したほかの案

- **運営者の Worker(svg-diagram.app)に載せ、Google のサインインと保存したデッキを使う**: 利用者の手間は少ないが、運営者の Cloudflare をみんなで使うことになり、他人の発表の中身・費用・悪用への対応を運営者が持つ。利用者の決定で、各自がデプロイする形にした。
- **新しいリポジトリに Worker を置く**: core と版を合わせる手間が増え、送る側と受ける側の決まりがずれうる。
- **メールアドレスを Access だけ、または Google だけにする**: 利用者の決定で両方にした。Access は Worker に OAuth を持たずに済み、Google は Zero Trust を使わない人でも使える。
- **見出しなどを HTML の文字で描く**: 端末のフォントで行の数が変わり、図と重なる。測ったフォントで輪郭にすれば、どの端末でも同じになる。
- **聴き手も自分で動けて、発表者が動くと引き戻す(Slidev 型)**: 利用者の決定で、強制の追従にした。
- **自己完結の HTML を `--watch` で書き直す(Marp 型)**: サーバーなしで済むが、別の端末の同期ができない。
- **手元でも WebSocket**: Node には WebSocket のサーバーが入っておらず、依存が増える。
- **`.ts` や spec を Worker に送り、Worker で描く**: `.ts` は公開のサーバーでの任意のコードの実行になる。spec だけならできるが、Worker にフォントと harfbuzz を載せることになり、手元と違うフォントで描かれる。
- **Slidev のようにトンネルで手元を外に出す**: 手元のパソコンと回線が止まると全員が止まる。
- **QR の符号化に既存のパッケージを使う**: 小さいものはあるが、core の依存を増やさない方針(D6 で WebSocket を避けたのと同じ)に合わせ、URL が入る大きさまでを自前で持つ。

## Opus のレビュー(2026-11-14)で直したこと

最初の案(svg-diagram.app に載せる plugin の ADR 0003 と、この ADR の前の版)に対する 19 件の指摘のうち、自分でデプロイする形でも残るものを、次のとおり直した。

- 聴き手の接続を IP ごとに 1 分 30 回までにしていた。会場の Wi-Fi(全員が同じ IP)で大半が断られる → IP で数えず、発表ごとの同時接続数で守る。つなぎ直しは待ち時間を倍にし乱数でずらす(D6、D14)。
- トークンを取り消しても、Cookie の期限まで発表者のままだった → Cookie にトークンの id を入れ、要求と接続のたびに確かめる。接続にタグを付け、取り消したら切る。トークンは 20 本まで(D13、D14)。
- WebSocket の接続と `claim` で `Origin` を確かめていなかった。役割のヘッダーを端末が偽れた → `Origin` を確かめ、`SameSite=Strict`、端末から来た役割のヘッダーは消す(D9、D13、D14)。
- Google の `email` を識別子として信じていた → `email_verified`、`GOOGLE_HD` による `hd` の確認、設定しないときの弱さを README に。Access のときは JWT を検証する(D13)。
- ウィジェットの許可リストを流用すると、絵文字や `.ts` の図が送るときに断られ、ADR の中でも一覧が食い違っていた → core に一覧を 1 つ置き、手元の保存のときにも当てる。全 example が通るテスト(D3)。
- 見出しなどを端末のフォント任せで折り返し、図と重なりえた。「ブラウザで収まれば .pptx でも収まる」も成り立たなかった → スライドを 1 枚の SVG にし、測ったフォントで文字まで輪郭にする。配置の計算は PowerPoint と共有(D2)。
- Node で輪郭にする手段と、測ったフォントとの一致がなかった → 測ったのと同じフォントのファイルで輪郭にする。`chromium` で測るプロジェクトには警告(D2)。harfbuzzjs はすでに core の依存にある。
- 手元のサーバーを立ち上げ直すと通し番号が戻り、端末が新しい知らせを無視した。`?v=` の版がキャッシュとぶつかった。送るたびに新しい発表ができた → `epoch`、中身のハッシュの URL、`<deck>.publish.json` と `PUT`、変わったスライドだけ送る(D6、D12)。
- ノートが聴き手に漏れる道(キャッシュ、印刷、アドレス欄のトークン) → ノートは `no-store` の別の要求、印刷は発表者だけでノートなし、`claim` の後にハッシュを消す、発表者の URL は QR にしない(D4、D6、D9、D10)。
- 手元の Cookie がポートで分かれない、LAN では HTTP、`.local` の名前が断られる → Cookie の名前にポート、起動時の注意、`--allow-host`(D9)。
- 監視: import の記録がない、ファイルとして読むものが漏れる、名前の付け替えで外れる、`fresh` の読み込みでメモリが増える → 記録する働き、監視の対象を列挙、ディレクトリを監視、`worker_threads` を 50 回ごとに作り直す(D5)。
- 同じブラウザの窓が HTTP/1.1 の接続の上限で詰まる → BroadcastChannel で 1 本を分け合う(D6)。
- 知らない `id` への要求で空の Durable Object が増える → 署名付きの `id`(D12)。
- デプロイで WebSocket が切れる → つなぎ直しと、発表中はデプロイしない注意(D14)。
- point-in-time recovery で消したものが 30 日残る → README に書く(D15)。
- 強制の追従なのに聴き手の URL に番号があった。`--publish` のときに手元の発表者の画面が誰にも届かなかった → 聴き手の URL は 1 つ、`--publish` のときは手元のサーバーを立ち上げない(D4、D12)。
- 自分でデプロイする形にしたことで、運営者の側の論点(Google のサインインを `/account` と共有すること、運営者のプライバシーポリシー、悪用への対応、保存したデッキの 5 枚の上限)はなくなった。運営者がいない代わりに、デプロイした人の責任を README に書く(D16)。

確かめたこと(Cloudflare の文書、2026-11-14、レビューで): Durable Object の SQLite は 1 行・1 値 8 MB まで、1 つの SQL 文は 100 KB まで、point-in-time recovery は 30 日。WebSocket のハイバネーションは 1 つの Durable Object に 32,768 接続まで、接続ごとのタグは 10 個まで、attachment は 16 KiB まで、ハイバネーションでメモリの状態は消える。Rate Limiting のバインディングは場所ごとの概算で、IP を鍵にしないよう勧めている。Google は `email` を識別子に使わないよう勧め、組織に限るには `hd` を確かめるよう書いている。

確かめていないこと(実装の前に確かめる): デプロイで WebSocket が切れるか、Durable Object(SQLite)が Workers の無料プランでどこまで使えるか、Access の JWT の検証に要る値の名前、`locationHint` の効き方。

## 実装計画(承認後)

1. `lib/deck-load.ts`(`pptx-deck` からデッキの読み込みを移す)と `lib/deck-layout.ts`(配置の計算を共有。PowerPoint の出力のバイト列が変わらないことを既存のテストで確かめる)。
2. `svg-diagram/present`: スライドの SVG(輪郭)、許可リスト、同期の決まりと状態の計算、QR、画面(聴き手・発表者・印刷、アダプタ 2 つ)。
3. 手元のサーバー: 配信、SSE と `go`、トークン、Host と Origin、`/deck.pptx`。
4. 監視と描き直し(記録する働き、ディレクトリの監視、`worker_threads`)。
5. `worker/`: Durable Object、受け口、トークン、Access と Google、同期、期限、設定の確かめ。README のデプロイ手順。
6. `--publish` の送り手と `<deck>.publish.json`。
7. Chromium での確認: 発表者と聴き手の 2 つの窓で、聴き手が追従し自分では動けないこと、保存して変わること、誤りが発表者にだけ出ること。

## 未決事項

- 既定値(500 接続、30 日、8 MiB)は、デプロイする人が変えられる前提で、この値でよいか。
