# svg-diagram serve の Worker（自分でデプロイする）

`svg-diagram serve deck.json --publish` の送り先です（ADR 0056）。発表者が**自分の Cloudflare のアカウント**にデプロイして使います。svg-diagram の運営者のサーバーは使いません。

- Worker は描画しません。手元の `svg-diagram` が描いたスライドの SVG（文字は輪郭）を受け取って配り、つないでいる全端末を発表者のスライドに合わせるだけです。
- 発表 1 つに Durable Object（SQLite）を 1 つ使います。D1・KV・R2 は要りません。Workers の無料プランでも動きます。
- 運営するのはデプロイした人で、発表の中身と聴き手への責任もデプロイした人にあります。

## デプロイ

使っている `svg-diagram` と**同じ版のタグ**でこのリポジトリを取ってきます（npm のパッケージには `worker/` は入っていません）。版が違うと、`--publish` が送る前に止まって、どちらを上げればよいかを出します。

    git clone --branch vX.Y.Z https://github.com/cuzic/svg-diagram.git
    cd svg-diagram/worker
    pnpm install --ignore-workspace
    cp wrangler.jsonc.example wrangler.jsonc     # name・routes・vars を自分のものに
    pnpm exec wrangler secret put PUBLISH_TOKEN   # 32 文字以上の乱数。--publish が使う
    pnpm exec wrangler secret put SESSION_SECRET  # 32 文字以上の乱数。Cookie の暗号化
    pnpm exec wrangler deploy

乱数は、たとえば `openssl rand -base64 32` で作ります。

送る側では次のように使います。

    export SVG_DIAGRAM_PUBLISH_ORIGIN=https://slides.example.com
    export SVG_DIAGRAM_PUBLISH_TOKEN=<PUBLISH_TOKEN と同じ値>
    svg-diagram serve deck.json --publish

端末に、聴き手の URL（と QR）と、発表者の URL（`/p/<id>/t#token=…`、人に渡さない）が出ます。保存するたびに送り直し、URL は変わりません。発表の `id` と発表者のトークンは `~/.config/svg-diagram/publish/` に、送り先とデッキごとに記録します（権限 0600）。

- `--new-presenter-token`: 発表者のトークンを足す（1 つの発表に 20 本まで。別の端末から発表するとき）
- `--revoke-presenter-tokens`: トークンを全部取り消す（そのトークンで入った接続は切れる）
- `--delete`: 発表を消す（URL は 404 になる）

## 設定（`wrangler.jsonc` の `vars`）

| 名前 | 既定 | 意味 |
|---|---|---|
| `MAX_CONNECTIONS` | 500 | 1 つの発表に同時につなげる聴き手の端末の数。超えると「満員」（発表者の接続はこれとは別に 20 まで） |
| `RETENTION_DAYS` | 30 | 最後に使ってから（送ったか、発表者がつないでから）この日数で消す |
| `MAX_SLIDES` | 300 | 1 つの発表のスライドの数（300 を超える値は設定の誤り。多くのデッキでは、先に `MAX_DECK_BYTES` に当たる） |
| `MAX_SLIDE_BYTES` | 4194304 | 1 枚の SVG の大きさ（写真の帯は大きくなりやすい） |
| `MAX_DECK_BYTES` | 16777216 | 1 つの発表の SVG の合計（24 MiB まで。1 回の送信が Durable Object に 1 度で渡る大きさの上限） |
| `PRESENTER_LOGIN` | `none` | 発表者の見分け方。`none`（トークンだけ）、`access`、`google` |
| `PRESENTER_EMAILS` | | 発表者のメールアドレス（カンマ区切り、大文字小文字は区別しない） |
| `ACCESS_TEAM_DOMAIN` | | `access` のとき。`<チーム>.cloudflareaccess.com` |
| `ACCESS_AUD` | | `access` のとき。Access のアプリの Application Audience (AUD) Tag |
| `GOOGLE_HD` | | `google` のとき。Google Workspace のドメインに限る（勧める） |
| `LOCATION_HINT` | | Durable Object を置く地域の希望（`apac` など。未設定なら Cloudflare に任せる） |

secret: `PUBLISH_TOKEN`、`SESSION_SECRET`、`google` のときは `GOOGLE_CLIENT_ID` と `GOOGLE_CLIENT_SECRET`。

設定が足りない・矛盾するとき、Worker は何にも答えません。聴き手には中身のない 503 を返し、何が足りないかは `wrangler tail` のログと、`PUBLISH_TOKEN` を持つ `--publish` にだけ出ます。

## 発表者のメールアドレスでのサインイン

トークンはいつでも使えます。そのうえで、メールアドレスでも発表者になれるようにできます。入口は `/p/<id>/login` で、確かめた後に発表者の画面に移ります。発表者の画面は、どちらの方法でも Cookie だけで決まります。

### `PRESENTER_LOGIN=access`（Cloudflare Access）

- **独自ドメイン**に Worker を置き（`routes`）、Zero Trust で**セルフホストのアプリ**を作って、パスを **`/p/*/login` だけ**にします。
- workers.dev のワンクリックの Access や、Worker 全体にかける Access は使わないでください。聴き手のページと WebSocket まで閉じてしまいます。アカウント全体で Worker を非公開にする設定にも注意してください。
- アプリの AUD を `ACCESS_AUD` に、チームのドメインを `ACCESS_TEAM_DOMAIN` に入れます。
- Worker は `Cf-Access-Jwt-Assertion` の JWT の署名・`aud`・`iss`・期限・メールアドレスを確かめます。メールアドレスのヘッダーだけでは信じません。サービストークン（メールアドレスのない JWT）は断ります。

### `PRESENTER_LOGIN=google`（Google の OpenID Connect）

- Google Cloud で「ウェブ アプリケーション」の OAuth クライアントを作り、承認済みのリダイレクト URI に `https://<自分のドメイン>/auth/google/callback` を登録します。
- クライアント ID とシークレットを `wrangler secret put GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` で入れます。
- `email_verified` が真のアドレスだけを使います。`GOOGLE_HD` を設定すると、その Workspace のドメインのアカウントに限ります。
- `GOOGLE_HD` を設定しないときは、Workspace でないドメインのアドレスが、そのメールを失った元の持ち主の Google アカウントに残っていることがあります（Google はメールアドレスを識別子に使わないよう勧めています）。発表者の一覧には、自分が管理しているアドレスだけを入れてください。

`PRESENTER_EMAILS` からアドレスを外して `wrangler deploy` すると、そのアドレスの発表者は、つないだままの接続でも次の操作から発表者でなくなります。

## 気をつけること

- **発表の最中に強制の更新（即時・期限付きのロールアウト）をしない**。通常の `wrangler deploy` では WebSocket は切れませんが、強制の更新では切れます。切れても端末はつなぎ直して今のスライドに戻ります。
- 消した発表も、Cloudflare の point-in-time recovery の期間（30 日）は、戻せる形で Durable Object に残ります。
- 聴き手のページには `X-Robots-Tag: noindex` を付けていますが、URL を知っている人は誰でも見られます。人に見せたくない発表は、終わったら `--delete` してください。
- 発表の中身（スライド・ノート・メールアドレス）とトークンはログに出しません。

## 手元で確かめる（Cloudflare のアカウントは要らない）

    pnpm install --ignore-workspace
    pnpm test

`wrangler dev`（workerd）で Worker を立ち上げ、Google と Access は偽物を手元で動かして試します（ADR 0056 D17）。手元で確かめられないのは、本番のデプロイで WebSocket が切れないかと、Cloudflare と Google の管理画面の設定そのものです。デプロイした後に、発表者の URL とサインインを一度試してください。
