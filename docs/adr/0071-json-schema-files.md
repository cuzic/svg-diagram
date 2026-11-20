# ADR 0071: JSON のファイルの JSON Schema をパッケージに入れる(`schema/*.schema.json`)

- 状態: 実装済み(2026-11-20。`lib/schema-files.ts`・`scripts/schema.ts`・`schema/`・`test/schema-files.test.ts`。Opus のレビュー 1 回目(`0071-opus-review-round1.md`)の Blocker 1・Minor 5 と Nit の大半を反映。2 回目(`0071-opus-review-round2.md`)で Blocker・Major なしで収束し、その Minor 2 と Nit の一部を反映)
- 基点: `main`(3fd26a2、PR #387 まで)
- 関連: ADR 0055(デッキの JSON)、ADR 0057(spec の canvas)、ADR 0067(site.json)、svg-diagram-vscode(VS Code 拡張)

## 背景

人が手で書く JSON のファイルが 4 種類ある: `.svg-diagram.json`(案件の設定)、デッキ(`pptx-deck` / `serve` / `site`)、デッキが指す図の `.json`(JSON の spec)、`site.json`。どれも誤りは CLI を走らせるまでわからず、どんなフィールドがあるかは README か型を読まないとわからない。

VS Code 拡張(svg-diagram-vscode)から補完と検査をしたい、という要望がある。拡張は core を公開された出口(CLI と exports)からだけ使う、と決めている。

コードで確かめたこと:

- spec とデッキには JSON Schema がすでにある(`specSchema`・`deckSchema`、`lib/spec.ts` / `lib/deck-spec.ts`)。CLI と MCP はこれで検査している。ただしメモリの上だけで、ファイルとしては出ていない。
- ファイルのデッキでは、図は spec のほかに `.ts` / `.json` のパスでもよい(`lib/deck-load.ts`)。`deckSchema` はパスを知らない(読み込んでから検査するため)。
- `.svg-diagram.json` と `site.json` にはスキーマがなく、`lib/config.ts` / `lib/site.ts` が手で検査している。`.svg-diagram.json` の知らないフィールドは黙って無視される。
- spec・デッキ・`site.json` は知らないフィールドを誤りにする。`"$schema"` を書くと CLI が落ちる。
- spec の `parts` は 65 種の部品の `oneOf`。VS Code の JSON の言語サービスでそのまま読むと、`type` の補完は「今いちばん合う枝」の 1 つしか出ず、別の部品の必須フィールドが足りないという誤りが出る(vscode-json-languageservice で確かめた)。

## 決定

**D1. `schema/` に 5 つのファイルを置き、パッケージに入れる。** `spec.schema.json`(単独の spec。全部品の定義を持つ)・`figure.schema.json`(デッキが指す `.json` の図: `canvas` のない spec)・`deck.schema.json`・`site.schema.json`・`config.schema.json`。図とデッキは `spec.schema.json#/definitions/parts` を相対で参照する(部品を 1 か所にだけ書き、パッケージを小さくする)。draft-07(エディタの対応がいちばん広い)。`package.json` の `files` に `schema` を足し、`exports` に `"./schema/*.json"` を足す。

**D2. ファイルは CLI が検査に使うスキーマから作る。** `lib/schema-files.ts` が作り、`pnpm schema` が書く。`test/schema-files.test.ts` が、書かれたファイルが今作るものと同じかを確かめる(部品を足して作り直し忘れると落ちる)。手で書くのは `site.json` と `.svg-diagram.json` だけで、`.svg-diagram.json` のフィールドは `satisfies Record<keyof Config, …>` で型 `Config` と合わせる。規則の id・凡例のキー・トーンの名前は `RULE_DOCS`・`DEFAULT_LEGEND_LABELS`・`TONES` から取る。

**D3. エディタ向けの形にする。** 検査の意味は変えずに:
- `parts` の要素は「`type` を全部品の `enum` から選び、その部品のフィールドだけを `if` / `then` で当てる」形にし、部品は `definitions` に 1 度だけ書く。`type` の各値には `partCatalog()` の説明を `enumDescriptions` で、部品ごとに例のひな形を `defaultSnippets` で付ける(VS Code だけが読むキーワード。標準の検査器には無視させる)。
- デッキの図(スライドと段)は「`.ts` / `.json` で終わるパスか、図(`canvas` のない spec)」の `anyOf`。パスを先に置き、`patternErrorMessage` で何が違うかを言う。
- 1 行の文字列(CLI が空白だけ・制御文字を拒むもの)には、同じことを言う `pattern` を付ける。デッキの `notes` と段の `text` は改行とタブを書けるので、それ以外の制御文字と空白だけを拒む `pattern` にする。
- `accept` の各規則と `legendLabels` の各キーには、`RULE_DOCS` の説明と既定の文言を `description` に入れる(ホバーで読める)。

**D4. どのファイルも先頭に `"$schema"`(文字列)を書いてよい。** spec の検査(`validateSpec` / `specToDiagram`、つまり `renderSpec` や `renderSpecEdge` も)とデッキの検査(`validateDeck`)は、先頭の文字列の `$schema` を読み捨てる(`withoutSchemaField`、`svg-diagram/spec` から出す)。文字列でなければ残して、知らないフィールドとして誤りにする。単独の spec のファイルを公開の API で描く使い方(`renderSpecEdge` で描く図のフォルダなど)があるため、ファイルの読み込みだけでなく検査の入口で取る。`parseSite` は許す(文字列でなければ誤り)。`.svg-diagram.json` はもともと知らないフィールドを無視する。デッキの中に書いた図の `$schema` はスキーマでは書けない(ファイルではないので要らない)。

**D5. スキーマは形だけを言う。** 部品ごとの規則(id の重複、表紙に書けない項目、文字数・絵文字の合計、`width` と `canvas` の併用)は書かない。エディタと CLI が食い違う所は次のとおりで、最後に決めるのは CLI:
- 文字列の長さは、JSON Schema はコードポイント、CLI は UTF-16 で数えるので、エディタの方が少し緩い。
- 日付(`YYYY-MM-DD` の 10 文字など)の長さは、CLI の形の検査は見ず部品の規則で見るが、エディタは長さで言う(メッセージが「最短の長さ」になる)。
- `640.0` は CLI では整数(`JSON.parse` の後は 640)だが、VS Code は字面で整数でないと言う。
- CLI は孤立したサロゲートと U+FFFE / U+FFFF も拒むが、スキーマは拒まない(書くことはまずない)。`minLength` のない 5 つほどの文字列(`site.json` の `title` など)も空白だけを拒まない。
- スキーマの間の参照(`spec.schema.json#/definitions/parts`)は相対の URI で、5 つのファイルを同じ場所から読むときに解ける。VS Code 拡張がファイルを別の URI で配るなら、5 つとも同じ並びで配る(拡張の側の仕事)。テストは、表せる誤りについては標準の検査器(ajv)と CLI が同じく拒むことを確かめる。

## 考えたが採らなかったこと

- **`svg-diagram schema <kind>` コマンドで出す**: 拡張もエディタもファイルの方が扱いやすい(`$schema` に相対パスで書ける)。必要になれば足せる。
- **公開 URL(unpkg など)に `$id` を付ける**: 版ごとに URL が変わり、ファイルが版を書き込むことになる。`node_modules` からの相対パスなら、入っている版のスキーマが使われる。
- **spec の `parts` を `oneOf` のまま出す**: 背景のとおり、補完と誤りの表示が役に立たない。

## 結果

- 手で書く JSON がエディタで補完・検査される。VS Code 拡張は、プロジェクトの `node_modules/svg-diagram/schema/` を読んで、`$schema` なしでも当てられる(拡張の側の仕事)。
- パッケージが約 0.6 MB 大きくなる(大半は全部品を持つ `spec.schema.json`)。
- 部品を足す人は `pnpm schema` を回す。忘れるとテストが落ちる。
