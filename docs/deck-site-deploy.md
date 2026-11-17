# デッキのサイトを置く(`svg-diagram site` の出力のデプロイ)

`svg-diagram site` は、複数のデッキを**普通の静的ファイル**(`dist/`)に書き出すだけです(ADR 0067)。置く作業は svg-diagram の外で、自分の道具とアカウントで行います。ここでは Cloudflare の Workers の静的アセットに置く手順を主に書きます。同じ `dist/` を Cloudflare Pages・Netlify・S3・nginx にも置けます。

## 1. 書き出す

デッキを並べるだけなら、引数に渡します。

    svg-diagram site nov18/deck.json nov27/deck.json --out dist

slug(URL のパス)・題・並び順を決めたいときや、`CNAME` などのファイルを足したいときは `site.json` を書きます。

    {"title": "勉強会のスライド",
     "decks": [
       {"deck": "nov27/deck.json", "slug": "2026-11-27-ai-dev", "title": "要件から受け入れテストまで"},
       {"deck": "nov18/deck.json", "slug": "2026-11-18-lounge"}
     ],
     "extra": {"robots.txt": "site-files/robots.txt"}}

    svg-diagram site site.json --out dist

- slug を書かなければ、`deck.json` ならそのフォルダーの名前、ほかの名前ならファイル名から作ります(小文字、英数字と `-`)。日本語のフォルダー名からは作れないので、`site.json` に書いてください。
- 発表者のノートは書き出しません。
- どれか 1 枚でも描けなければ、何も書きません(`dist/` は前のまま)。
- `dist/` は丸ごと置き換えます。`site` が書いていないファイルが `dist/` にあると止まります。足したいファイルは `extra` に書いてください。
- スライドの文字は輪郭にするので、`.svg-diagram.json` の `"fonts"` にフォントのファイルが要ります(`serve` と同じ)。
- 設定(`.svg-diagram.json`)はデッキごとにそのフォルダーから読みます。ただしパスで書いたアイコンの一覧(`svg-diagram.icons.json`)は、コマンドを流したフォルダーのものを使います。
- 手元で見るときは、静的なファイルのサーバーで開いてください(`npx wrangler dev`、`python3 -m http.server -d dist` など)。`file://` で開くと `slides.json` を読めず、スライドが出ません。

## 2. Cloudflare の Workers の静的アセットに置く(主な手順)

Worker のコードは書きません。`dist/` の隣に `wrangler.jsonc` を置きます。

    {
      "name": "my-slides",
      "compatibility_date": "2026-11-01",
      "assets": {"directory": "./dist"}
    }

手元からデプロイします(初回は `npx wrangler login`)。

    npx wrangler deploy

`https://my-slides.<アカウント>.workers.dev/` に一覧が出ます。自分のドメインに置くときは、`wrangler.jsonc` に `"routes"` を足すか、ダッシュボードでカスタムドメインを付けます。

- デッキを直したら、`svg-diagram site` と `npx wrangler deploy` をもう一度流します。名前が中身のハッシュなので、変わったスライドだけが送られます。
- `dist/_headers` を Cloudflare が読み、スライドの SVG の CSP・`noindex`・長いキャッシュ・`frame-ancestors 'none'` を付けます。
- `/slug` は `/slug/` に、`print.html` は `print` に自動で転送されます。
- 上限: 1 ファイル 25 MiB、ファイルの数は無料プランで 20,000(有料プランで 100,000)。`site` は最後に、いちばん大きいファイルとファイルの数を出します。
- デプロイが切り替わると古いスライドは 404 になるので、開いたままの画面では画像が欠けることがあります(読み直せば直ります)。

### Cloudflare Pages に置く(代わりの方法)

    npx wrangler pages deploy dist --project-name my-slides

`_headers` も転送も Workers の静的アセットと同じに働きます。

## 3. 見られる人

何もしなければ、**URL を知っている人なら誰でも見られます**。検索に載らないよう `noindex` は付けていますが、URL が漏れれば見られます。

絞りたいときは、Cloudflare Zero Trust の **Access** でアプリケーションを作り、サイトのドメインにポリシー(メールアドレス・Google のドメインなど)を掛けます。svg-diagram 側の設定はありません。

一部のデッキだけを絞りたいときは、**別のサイトとして書き出して**、そちらに Access を掛けてください。`/<slug>/*` のパスだけを絞っても、根の一覧(`index.html`)と `manifest.json` に、そのデッキの題・枚数・slug が残って公開されます。

公開する前に確かめること:

- 写真は元のファイルのまま SVG に埋め込まれます。EXIF(撮った場所・日時など)も公開されるので、消してから使ってください(例: `exiftool -all= photo.jpg`)。
- ノートは書き出しませんが、スライドに書いた文字はすべて見えます。

## 4. Cloudflare 以外に置く

`dist/` をそのまま置けます。ページの CSP は HTML の `<meta>` に入っているので、どこでも効きます。`_headers` を読まない置き場所(S3・nginx など)では、次を置き場所の設定で付けてください。

- すべて: `X-Frame-Options: DENY`(または `Content-Security-Policy: frame-ancestors 'none'`)、`X-Content-Type-Options: nosniff`、`X-Robots-Tag: noindex`
- `/<slug>/s/*.svg`: `Content-Security-Policy: sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'`
- `/assets/*` と `/<slug>/s/*`: `Cache-Control: public, max-age=31536000, immutable`

## 5. CI から置く(GitHub Actions の例)

デッキのリポジトリに push すると書き出してデプロイする例です。`site` はデッキの `.ts` の図を実行するので、**Cloudflare のトークンは描くジョブに渡さず**、デプロイするジョブだけに渡します。

フォントはリポジトリ(たとえば `fonts/`)に置き、`.svg-diagram.json` には設定ファイルからの相対パスで書きます。こうすると、手元と CI で同じ設定が使えます。文字の幅は `"measure": "font"` で測る設定にしてください(Chromium で測ると、その版で結果が変わります)。

    {"measure": "font", "fonts": {"sans": {"regular": "fonts/NotoSansJP-Regular.otf", "bold": "fonts/NotoSansJP-Bold.otf"}}}

`.github/workflows/slides.yml`:

    name: slides
    on: {push: {branches: [main]}}
    jobs:
      build:
        runs-on: ubuntu-latest
        permissions: {contents: read}
        steps:
          - uses: actions/checkout@v4
          - uses: actions/setup-node@v4
            with: {node-version: 24}
          - run: npx -y svg-diagram@<版> site site.json --out dist
          - uses: actions/upload-artifact@v4
            with: {name: site, path: dist, include-hidden-files: true}
      deploy:
        needs: build
        runs-on: ubuntu-latest
        permissions: {contents: read}
        steps:
          - uses: actions/checkout@v4
            with: {sparse-checkout: wrangler.jsonc, sparse-checkout-cone-mode: false}
          - uses: actions/download-artifact@v4
            with: {name: site, path: dist}
          - run: npx -y wrangler@4 deploy
            env:
              CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
              CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

`CLOUDFLARE_API_TOKEN` は、ダッシュボードの「Edit Cloudflare Workers」のテンプレートから作り(`routes` やカスタムドメインを使うときにも足ります)、対象のアカウントとゾーンだけに絞って、リポジトリの secret に入れます。
