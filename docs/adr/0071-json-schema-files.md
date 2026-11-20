# ADR 0071: JSON のファイルの JSON Schema をパッケージに入れる(`schema/*.schema.json`)

- 状態: 実装済み(2026-11-20。`lib/schema-files.ts`・`scripts/schema.ts`・`schema/`・`test/schema-files.test.ts`)
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

**D1. `schema/` に 4 つのファイルを置き、パッケージに入れる。** `spec.schema.json`・`deck.schema.json`・`site.schema.json`・`config.schema.json`。draft-07(エディタの対応がいちばん広い)。`package.json` の `files` に `schema` を足し、`exports` に `"./schema/*.json"` を足す。

**D2. ファイルは CLI が検査に使うスキーマから作る。** `lib/schema-files.ts` が作り、`pnpm schema` が書く。`test/schema-files.test.ts` が、書かれたファイルが今作るものと同じかを確かめる(部品を足して作り直し忘れると落ちる)。手で書くのは `site.json` と `.svg-diagram.json` だけで、`.svg-diagram.json` のフィールドは `satisfies Record<keyof Config, …>` で型 `Config` と合わせる。規則の id・凡例のキー・トーンの名前は `RULE_DOCS`・`DEFAULT_LEGEND_LABELS`・`TONES` から取る。

**D3. エディタ向けの形にする。** 検査の意味は変えずに:
- `parts` の要素は「`type` を全部品の `enum` から選び、その部品のフィールドだけを `if` / `then` で当てる」形にし、部品は `definitions` に 1 度だけ書く。
- デッキの図(スライドと段)は「spec(`canvas` なし)か、`.ts` / `.json` で終わるパス」の `anyOf`。spec は `definitions.figure` に 1 度だけ書く。
- `accept` の各規則と `legendLabels` の各キーには、`RULE_DOCS` の説明と既定の文言を `description` に入れる(ホバーで読める)。

**D4. どのファイルも先頭に `"$schema"`(文字列)を書いてよい。** `loadDeck` はデッキと `.json` の図から読み捨て、`parseSite` は許す(文字列でなければ誤り)。`.svg-diagram.json` はもともと知らないフィールドを無視する。CLI が JSON のまま渡された spec(MCP の入力など)の `$schema` は今までどおり誤り(ファイルではないので要らない)。

**D5. スキーマは形だけを言う。** 部品ごとの規則(id の重複、表紙に書けない項目、文字数・絵文字の合計、`width` と `canvas` の併用)は書かない。文字列の長さも、JSON Schema はコードポイント、CLI は UTF-16 で数えるので、エディタの方が少し緩い。最後に決めるのは CLI。テストは、表せる誤りについては標準の検査器(ajv)と CLI が同じく拒むことを確かめる。

## 考えたが採らなかったこと

- **`svg-diagram schema <kind>` コマンドで出す**: 拡張もエディタもファイルの方が扱いやすい(`$schema` に相対パスで書ける)。必要になれば足せる。
- **公開 URL(unpkg など)に `$id` を付ける**: 版ごとに URL が変わり、ファイルが版を書き込むことになる。`node_modules` からの相対パスなら、入っている版のスキーマが使われる。
- **spec の `parts` を `oneOf` のまま出す**: 背景のとおり、補完と誤りの表示が役に立たない。

## 結果

- 手で書く JSON がエディタで補完・検査される。VS Code 拡張は、プロジェクトの `node_modules/svg-diagram/schema/` を読んで、`$schema` なしでも当てられる(拡張の側の仕事)。
- パッケージが約 0.7 MB 大きくなる(spec とデッキのスキーマが大半)。
- 部品を足す人は `pnpm schema` を回す。忘れるとテストが落ちる。
