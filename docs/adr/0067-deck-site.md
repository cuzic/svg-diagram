# ADR 0067: 複数のデッキを静的なサイトに書き出す(`svg-diagram site`)。デプロイは core の外で行う

- 状態: 実装済み(2026-11-17。`site-diagram.ts`・`lib/site.ts`・`lib/present/ui.ts` の `transport: 'static'`・`docs/deck-site-deploy.md`。Opus のレビューを 3 回反映。`wrangler dev`(Workers の静的アセット)と素の静的サーバーの `/slides/` の下で、Chromium で確かめた。2026-11-17 に本番の Cloudflare(Workers の静的アセット)にダミーのデッキでデプロイし、ヘッダー・転送・差分の送信・Chromium での動きを確かめ、Worker は消した。残り: CI の例の実地の確認)
- 基点: `main`(57ed92e9、ADR 0066 まで)
- 関連: ADR 0056(`serve` と自分でデプロイする Worker)、ADR 0062〜0064(発表の画面)、ADR 0055(デッキの JSON)、ADR 0013(失敗したビルドの古い出力)

## 背景

複数のデッキを Cloudflare に置き、URL を渡せばいつでも見られるようにしたい、という要望が届いた(利用者、2026-11-17)。あわせて「できる限り疎結合に」とも言われている。

今あるもので足りない点は次のとおり。

| 既存 | できること | 足りない点 |
|---|---|---|
| `serve deck.json --publish`(ADR 0056、`lib/present/publish.ts`、`worker/`) | 自分の Cloudflare の Worker に 1 つのデッキを送り、全端末を発表者のスライドに合わせる | 1 回のコマンドで 1 つのデッキしか送れない。発表は最後に使ってから `RETENTION_DAYS`(既定 30)日で消える。Worker のデプロイは、タグを `git clone` して `wrangler deploy` するまで手作業。Durable Object と secret が要る。ライブ発表のための仕組みで、置いておく用途には重い |
| `deck`(ADR 0018、`deck-diagram.ts`) | 図の並びを 1 つの HTML に | 入力は図だけで、`deck.json` の見出し・リード・枠・表紙を描かない |
| `pptx-deck`(ADR 0055) | `deck.json` を .pptx に | ブラウザでは見られない |

コードで確かめたこと:

- 発表の画面は `lib/present/ui.ts` の `viewerPage` / `printPage` と、文字列の `PRESENT_JS` / `PRESENT_CSS`。受け取る道は `transport: 'sse' | 'ws'` の 2 つだけで、`connect()` は `ws` でなければ必ず EventSource を開く。
- 聴き手の位置 `pos` は、`state` メッセージを受けたときにしか決まらない(URL の `#n` を読むのもここ、ui.ts:296-301)。`deck` メッセージの処理は `deck = m; draw()` だけで(ui.ts:309)、`pos` が決まる前の `draw()` は何もしない。**`deck` を渡すだけでは描かれない**(D4)。
- `deck` メッセージのスライドは `{url, title, text}`(serve-diagram.ts:127)。画面は `text` を代替テキストに使い、`img.src` に `url` をそのまま入れる(文書の URL から解決される)。
- スクリプトとスタイルシートの場所は `ASSET_JS = '/assets/present.js'`、`ASSET_CSS = '/assets/present.css'` で、**オリジンの根からの絶対パス**。`PRESENT_JS` / `PRESENT_CSS` の中にはほかに絶対パスはない(URL はすべて `cfg` から来る)。
- スライドの SVG は `renderDeck`(`lib/present/render-deck.ts`)が作る。文字は輪郭で、プロジェクトの設定(`.svg-diagram.json`)のフォントのファイルが要る(`serve` は描く前に確かめる、serve-diagram.ts:78-82)。`hash` は SVG の SHA-256 で、`checkSlideSvg`(`lib/present/svg-allow.ts`)の許可リストに当てられる。SVG には `<style>`・`style=""`・`data:image/png|jpeg` が入る。
- 今の SVG は、ページとは別の CSP(`sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'`)と `X-Robots-Tag: noindex` を付けて返している(guard.ts:236-246、worker/src/index.ts:16-21)。
- 設定の読み込み(`configureMeasure`)はプロセス全体に効く(render-thread.ts:172-175)。

## 決定

### 全体の形

```
deck.json ×N ──[core: svg-diagram site]──> dist/ ──[wrangler・CI・ほかの置き場所]──> 公開
              Cloudflare を知らない                  Cloudflare に依存するのはここだけ
```

core は**普通の静的ファイルを書き出すだけ**にし、ネットワークに触れない。core と置き場所のあいだの約束は「`dist/` の構成(D2)と `manifest.json` の版(D6)」だけにする。Cloudflare Pages でも Workers の静的アセットでも、Netlify・S3・社内の nginx でも同じ `dist/` を置ける。

### core

- D1. **入口**: `svg-diagram site <deck.json|site.json>... --out DIR`。
  - 引数がすべて `deck.json` なら、それらを並べたサイトを作る(手軽な使い方)。
  - `site.json`(D5)を 1 つ渡すと、slug・題・並び順をそこから取る。`deck.json` と `site.json` を混ぜて渡すのは誤り。
  - コマンドの名前は、既存の `deck`・`serve`・`pptx-deck` に合わせて短くする。`build`(図の書き出し)とは別。
  - サイトの置き場所のパス(`/slides/` など)を指定する引数は持たない。中のリンクはすべて相対パスなので要らない(D3)。
- D2. **出力の構成**:

      DIR/
        index.html              デッキの一覧(D12)
        manifest.json           D6
        _headers                D8
        assets/present.<hash>.js
        assets/present.<hash>.css
        assets/site.<hash>.css  一覧のページのスタイル
        <slug>/index.html       ビューア(D4)
        <slug>/print.html       印刷のページ(printPage)
        <slug>/slides.json      スライドの並び(D4)
        <slug>/s/<hash>.svg     スライド(renderDeck の SVG。名前は中身の SHA-256)

  - スクリプトとスタイルシートの名前にも中身のハッシュを入れる(D8 で長くキャッシュするため)。
  - **同じ入力からは同じバイト列ができる**。ここでいう入力は、デッキと図のファイル、プロジェクトの設定、フォントのファイル、svg-diagram の版、環境変数 `SVG_DIAGRAM_TODAY`(`gantt` の `today: 'auto'` が使う)。文字の幅を Chromium で測るプロジェクトでは Chromium の版も入る(`serve` と同じく警告する)。日時・手元の絶対パスは書かない。置き場所は変わったファイルだけを送ればよい。
- D3. **相対パス**: `ui.ts` の `page()`(と、それを呼ぶ `viewerPage()`)と `printPage()` に、スクリプト・スタイルシートの場所を渡す引数を足す(既定は今の `ASSET_JS` / `ASSET_CSS` で、`serve` と Worker の振る舞いは変えない)。`site` は `../assets/present.<hash>.js` のように**ページからの相対パス**を渡す。サイトをオリジンの根でなく `/slides/` などの下に置いても動く。
  - 一覧のリンクは `<slug>/` の形(末尾のスラッシュ付き)で出す。Cloudflare Pages と Workers の静的アセットは `/slug` を `/slug/` に転送するが、素の S3 や nginx は転送しないことがあり、`/slug` のまま開くと相対パスがずれるため。CSP の `base-uri 'none'`(D8)のため `<base>` には頼らない。
- D4. **ビューア**: `viewerPage` に 3 つ目の受け取り方 `transport: 'static'` を足す。
  - `PageConfig` に `slides?: string`(`slides.json` の場所)を足す。`events` は流用しない。
  - 初期化: `slidesUrl = new URL(cfg.slides, location.href)` を `fetch` で読み、各スライドの `url` を `new URL(url, slidesUrl)` で解決して `deck` に入れる。`pos` は URL の `#n` が `1 ≤ n ≤ 枚数` ならそこ、それ以外は 0。読めなければ(404・通信の失敗・形の誤り)`status()` で「スライドを読めませんでした」と出す(真っ黒な画面のままにしない)。`following` は false。そのうえで `draw()` する。`connect()` は何もしない(SSE も WebSocket も開かない)。
  - `hashchange` を見て、開いたあとに `#n` を変えても移る(範囲外の `n` は無視する。`draw()` の `history.replaceState` は `hashchange` を起こさないのでループしない。静的なサイトでは URL を人に渡すため。`serve` の聴き手にも同じ変更が効く)。
  - 発表者がいないので、次は出さない: `follow`(発表者に戻る)のボタン、つながっていないことの表示、ショートカットキーの一覧の「発表者」の節と `b` / Enter。それ以外(キー・一覧・拡大・全画面・印刷)は `serve` の聴き手の画面と同じ。
  - `slides.json` は `{version: 1, title, slides: [{url: "s/<hash>.svg", title, text}]}`。項目名は `serve` の `deck` メッセージと同じにする(画面の JS は `text` を読む)。
  - 発表者の画面は作らない。
- D5. **`site.json`**(書かなくてもよい):

      {"title": "勉強会のスライド",
       "decks": [
         {"deck": "nov27/deck.json", "slug": "2026-11-27-ai-dev", "title": "要件から受け入れテストまで"},
         {"deck": "nov18/deck.json", "slug": "2026-11-18-lounge"}
       ]}

  - `deck` は `site.json` からの相対パス。並びは書いた順。
  - `title` を書かなければ、`serve` と同じ順で決める: `deck.json` の一番上の `title` → 1 枚目の見出し → ファイル名。
- D6. **`manifest.json`**: `{"version": 1, "generator": "svg-diagram site", "title", "files": [書いたファイルの DIR からの相対パス、並べて], "decks": [{"slug", "title", "slides", "cover": "<slug>/s/<hash>.svg"}]}`。置き場所の道具や CI が読むためのもので、画面は使わない。形を変えるときは `version` を上げる。`generator` と `files` は D10 で、`site` が書いたディレクトリかどうか、利用者が足したファイルがないかを見分けるのに使う。
- D7. **slug**:
  - 書かれた slug は厳しく検査する: `[a-z0-9][a-z0-9-]{0,63}`。外れたら誤り。
  - 書かれていなければ作る。元は、デッキのファイルが `deck.json` ならそのディレクトリの名前(カレントの `deck.json` ならカレントのディレクトリの名前)、ほかの名前ならファイル名から拡張子を除いたもの。これを小文字にし、`[a-z0-9]` 以外の並びを `-` に替え、頭と末尾の `-` を除き、64 文字に切り詰めてから末尾の `-` をもう一度除く。空になれば `deck-<番号>`(1 から、並びの順)。元の名前から大きく変わったとき(空になった、元の文字の半分以上が落ちた。`勉強会` → `deck-1`、`第2回勉強会` → `2` など)は、`site.json` で slug を書くよう警告する。
  - 予約した名前(`assets`、Cloudflare が使う `cdn-cgi`、D15 で Worker とまとめる場合に備えて `p`・`api`・`auth`)と重なるもの、ほかのデッキと重なるもの(`a/talk/deck.json` と `b/talk/deck.json` など)は誤り。誤りは場所(引数か `site.json` の何番目か)とともに出し、「`site.json` で slug を書く」と案内する。
- D8. **CSP とヘッダー**: 置き場所に依らないよう、**ページの CSP は HTML の `<meta>` で持たせ**、`_headers` には外す書き方(Cloudflare だけの `!`)を使わない。
  - `site` のページ(ビューア・印刷・一覧)の `<head>` の頭(`<meta charset>` の直後、`<link>` より前。`<meta>` の CSP はそれより後の要素にしか効かないため)に次を置く: `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'">`(`serve` と Worker のページの CSP から `frame-ancestors` を除いたもの。`lib/present/ui.ts` の `PAGE_CSP_META`)。この `<meta>` は `site` のページだけに入れる(`serve` と Worker はヘッダーで CSP を送っており、`<meta>` を共通にすると 2 つが重なって効くため)。
  - `_headers`(Cloudflare Pages・Workers の静的アセット・Netlify が読む書式のただのファイル。ほかの置き場所では無視される)には、ページの CSP を書かない。1 つの規則に `*` は 1 つ。

        /*
          X-Content-Type-Options: nosniff
          Referrer-Policy: no-referrer
          X-Robots-Tag: noindex
          Content-Security-Policy: frame-ancestors 'none'
        /:slug/s/*
          Content-Security-Policy: sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'
          Cache-Control: public, max-age=31536000, immutable
        /assets/*
          Cache-Control: public, max-age=31536000, immutable

  - SVG には `/*` と `/:slug/s/*` の 2 つの CSP がコンマでつながって両方効くが、`frame-ancestors 'none'` は SVG 用の CSP と両立するので崩れない。
  - SVG 用の CSP は、今の `serve` と Worker の SVG の CSP と同じ値にする。今 guard.ts:236 と worker/src/index.ts:20 に 2 つある定義を、1 か所の定数にまとめる。
  - `_headers` を読まない置き場所では、SVG の CSP と `noindex`・長いキャッシュは付かない(ページの CSP は `<meta>` で効く)。そのことを D14 の文書に書く。
  - Cloudflare の `_headers` の上限(規則は 100 個まで、1 行 2,000 文字まで)に収まる(規則は 3 つ)。
- D9. **ノートは出さない**: `deck.json` の `notes` はどのファイルにも書かない(`slides.json` にも `manifest.json` にも)。公開するサイトに発表者のメモが漏れないため。発表者の画面が要るなら `serve` を使う。
- D10. **書き出しと失敗**:
  - どれか 1 つのデッキのどれか 1 枚でも描けない(`renderDeck` の `errors`、フォントのファイルの欠けを含む)か、`checkSlideSvg` に外れれば、**何も書かない**。半分だけ新しいサイトを作って、それをデプロイしてしまわないため。警告は出すが止めない。
  - `DIR` を置き換えてよいのは、`site` が前に書き、そのあと何も足されていないディレクトリのときだけ。`DIR` があって空でなく、次のどれかなら、何も書かずに誤りにする(ADR 0013 の「既存の出力は削除しない」と同じ考え)。
    - `DIR/manifest.json` がない、または `generator` が `"svg-diagram site"` でない。
    - `DIR` の中に、`manifest.json` の `files` にないファイルか、`files` のどれの親でもないディレクトリがある(利用者があとから足した `CNAME`・`_redirects`・`robots.txt` など)。その名前を出す。ただし OS が作るもの(`.DS_Store`・`Thumbs.db`・`desktop.ini`)は無視し、置き換えとともに消す。
    - `DIR` が OS の作るファイルだけなら、空とみなす。
    - `DIR` がシンボリックリンク(rename でリンクが実体のディレクトリに置き換わるため。リンク先を `--out` に渡すよう案内する)。
  - サイトに自分のファイルを足したいときは、`site.json` の `"extra": {"CNAME": "site-files/CNAME", ".well-known/security.txt": "site-files/security.txt"}` に書く。キーは `DIR` の中の写す先(相対パス。`..` と絶対パスは誤り)、値は `site.json` からの相対パスで、通常のファイルだけ(ディレクトリ・シンボリックリンクは誤り)。写したものも `files` に入る。D2 の名前(`index.html`・`manifest.json`・`_headers`・`assets`)や slug と重なるものは誤り。
  - 入力が `DIR` の中にあるときも誤り。入力は、デッキ・`site.json`・`extra` のほかに、描くときに読んだファイル(図の `.ts` とその import 先、写真。`serve` と同じく `recordResolved` / `recordImageReads` で集める、render-thread.ts:169-170)、プロジェクトの設定(`.svg-diagram.json`)とフォントのファイル(`outlineFontCheck` が読むので別に集める)を含む。
  - 手順: `DIR` の隣に `DIR.tmp-<乱数>` を作って全部書く → `DIR` を `DIR.old-<乱数>` に rename → `DIR.tmp-<乱数>` を `DIR` に rename → `DIR.old-<乱数>` を消す。
    - 書いている途中で落ちれば `DIR.tmp-*` が、2 つの rename のあいだで落ちれば `DIR.old-*` が残り、後者では `DIR` がない。次の実行は、残っているものを知らせる(戻し方: `DIR.old-*` を `DIR` に戻す。`DIR.tmp-*` は消してよい)。
    - `DIR` がマウントポイントのとき、親に書けないときなど、rename が失敗(`EXDEV`・`EBUSY`・`EACCES` など)すれば、何も変えずに誤りにする(1 つ目の rename の後なら戻してから)。
- D11. **描き方**: デッキごとにそのディレクトリのプロジェクトの設定を読み、フォントを確かめ(`serve` と同じ)、**1 つずつ順に描く**。設定の読み込みはプロセス全体に効くので、ディレクトリの違うデッキを並行に描くと設定が混ざるため。
  - パスで書いたアイコンの一覧(`svg-diagram.icons.json`、`lib/icon-registry.ts` の `findManifest()`)は、`serve` と同じく作業ディレクトリから探す(デッキごとには読まない)。フォルダーの違うデッキがそれぞれのアイコンの一覧を持つときは、今は 1 回の `site` にまとめられない。D2 の「入力」にもこのファイルが入る。
  - 1 つのデッキのスライドの数は core の `MAX_SLIDES` に従う。置き場所の上限は core では見ない(置き場所の知識を core に入れないため)。書き出し後に、いちばん大きいファイルとファイルの数を表示する(参考: Cloudflare Pages と Workers の静的アセットは 1 ファイル 25 MiB、ファイルの数は無料プランで 20,000、有料プランで 100,000)。
- D12. **一覧のページ**(`index.html`): `ui.ts` に `siteIndexPage(title, decks)` を足す。デッキごとに題・スライド数・表紙の縮小画像(1 枚目の SVG を `<img loading="lazy" decoding="async">` で。`alt` はデッキの題)と `<slug>/` へのリンク。スクリプトは使わない。スタイルは `assets/site.<hash>.css`(D8 の CSP が `style-src 'self'` のため)。写真の入ったデッキでは、1 枚目の SVG が数 MiB になることがある(縮小画像を別に作るのは今回はしない)。

### デプロイ(core の外)

- D13. core には**デプロイするコードを入れない**。Cloudflare の API・トークン・アカウントの名前を、core のコードにも設定にも持たない。
- D14. 代わりに `docs/deck-site-deploy.md` に、置き方を 3 つ書く。
  1. **Workers の静的アセット(主な手順)**: Worker のコードは書かず、`wrangler.jsonc` に `name`・`compatibility_date`・`"assets": {"directory": "./dist"}` を書いて、手元から `npx wrangler deploy`。`wrangler.jsonc.example` を文書に載せる。
  2. Cloudflare Pages(代わりの方法): `npx wrangler pages deploy dist --project-name <名前>`。
  3. CI(GitHub Actions): デッキのリポジトリに push すると流れる例。
     - 描くジョブと、デプロイするジョブを分ける。`site` はデッキの `.ts` の図を実行するので、`CLOUDFLARE_API_TOKEN` は描くジョブに渡さない。`dist/` は artifact で渡す。
     - フォント(Noto Sans JP など)はデッキのリポジトリ(か、CI で決まった相対の場所)に置き、`.svg-diagram.json` には設定ファイルのフォルダーからの相対パスで書く(手元と CI で同じ設定が使える)。文字の幅は Chromium で測らない設定を前提にする。
  - `_headers` を読まない置き場所(S3・nginx など)では、`frame-ancestors 'none'`(`<meta>` の CSP では効かない)・SVG の CSP・`noindex`・長いキャッシュを置き場所の設定で付けるよう書く(D8)。
  - 見られる人を絞るときは Cloudflare Access をサイトの前に掛ける(メールアドレス・Google など)。core にもサイトにも認証のコードを入れない。何もしなければ、URL を知っている人は誰でも見られる(`noindex` は付く)。
  - 写真は元のバイト列のまま SVG に埋め込まれるので、EXIF(撮った場所など)も期限なしで公開される。公開する前に EXIF を消すよう書く。
  - デプロイが切り替わると古いハッシュのスライドは 404 になり、開いたままの画面では一覧の画像が欠けることがある(読み直せば直る)。

### ライブ発表の Worker との関係

- D15. ADR 0056 の Worker とは**混ぜない**。静的サイトにライブ発表へのリンクや Worker の URL を埋め込まない。同じ `renderDeck` と `PRESENT_JS` を使うので見た目はそろう。将来 1 つのドメインにまとめたくなったら、Worker の `assets` に同じ `dist/` を指せばよい(今回は作らない。D7 で Worker の使うパスを slug から予約しておく)。

## 確かめ方

- 純粋な部分は `node --test` で確かめる: `site.json` の解釈、slug の検査と正規化と重なり、`_headers` と `manifest.json` の文字列、相対パス。
- 例のデッキ 2 つから書き出して次を確かめる。
  - 同じ入力から 2 回書き出すと、バイト列が同じ。
  - 1 枚壊したデッキでは、`DIR` が前のまま残る。
  - `site` が書いていない空でない `DIR`、`site` が書いたあとにファイルを足した `DIR`、図の `.ts` を中に含む `DIR` では拒否する。`extra` に書いたファイルは写される。
  - ディレクトリの違う、設定の違う 2 つのデッキが、それぞれの設定で描かれる。
- `wrangler dev`(Workers の静的アセット、D14 の 1.) と、`_headers` を読まない素の静的なファイルのサーバーの両方で開く。Chromium(Playwright)で、次を見る。
  - 一覧からデッキに入り、めくる・一覧・印刷・`#n` での移動・`hashchange` が動く。
  - CSP の違反がない。SVG を直接開いても崩れない。
  - 下の階層(`/slides/`)に置いても動く。`/slug`(末尾のスラッシュなし)で開いても動く。

## 今回入れないもの

- 発表者の画面とノート(D9)。
- 検索、タグ、OGP の画像、RSS、軽い縮小画像。
- `site --watch`(手元で見るのは `serve` でできる)。
- スライドごとの PDF・PNG の書き出し(印刷のページで代わりにする)。
- デッキごとの公開・非公開の切り替え(Access のパスの規則で利用者が行う)。

## 結果(見込み)

- `svg-diagram site site.json --out dist && npx wrangler deploy` の 2 行で、複数のデッキが期限なしで公開される。
- core は Cloudflare に依存しない。置き場所を変えても core を変えなくてよい。
- `serve` と Worker の振る舞いは、`hashchange` に移るようになることのほかは変わらない(D3・D4 は引数と `transport` を足すだけ)。

## 検討したほかの案

- **ADR 0056 の Worker に、置いておくデッキを持たせる**(R2 か KV に保存し、期限なしにする): 1 つのデプロイで済むが、Worker が描画結果の保存・一覧・消し方まで持つことになり、ライブの同期と置いておく用途が結び付く。デプロイする人が R2 などを用意する手間も増える。採らない。
- **`--publish` に複数のデッキを渡せるようにする**: 送るのは楽になるが、`RETENTION_DAYS` で消える、Durable Object が要る、聴き手は発表者に合わされる、という性質はそのまま。置いておく用途に合わない。
- **core に `site --deploy` を入れ、Cloudflare の API を直接呼ぶ**: 1 コマンドで済むが、core が Cloudflare のトークンと API の版に縛られる。`wrangler` を呼ぶだけでも、core が `wrangler` の有無と版を気にすることになる。D14 の 1 行で足りるので採らない。
- **デッキごとに自己完結した 1 つの HTML(SVG を埋め込む)**: 置き場所を選ばず、ファイル 1 つで渡せる。けれどもスライドを 1 枚直しても全体を送り直し、ブラウザも全体を読み直す。写真の入ったデッキでは 1 ファイルが大きくなる。将来 `site --single-file` として足せる形(D4 の `static` の初期化に、`slides.json` の代わりに埋め込んだ JSON を渡すだけ)にしておく。

## 利用者が決めたこと(2026-11-17)

1. 用途は「置いておいていつでも見られる」。ライブ発表は今までどおり `serve --publish`(ADR 0056)で行う。
2. 公開の範囲は「URL を知っている人なら誰でも」。D14 の文書の既定はこれにし、Cloudflare Access で絞る方法は任意の手順として載せる。
3. デプロイは、まず手元のコマンドで整えて確かめる。CI(GitHub Actions)の例は文書に書くが、確かめるのは後にする。
4. 置き場所は Workers の静的アセット(Worker のコードなし)。D14 では 2. を先頭に置き、主な手順として確かめる。Pages の手順は代わりの方法として残す(`dist/` は同じ)。
