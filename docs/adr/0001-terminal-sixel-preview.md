# ADR 0001: SVG と図ソース(.ts)を sixel でターミナルに直接表示する

- 状態: 実装済み(改訂 3。Opus レビュー 2 回分を反映。実機確認の表は未実施)
- 日付: 2026-10-10

## 背景

- 確認の現状は `svg-diagram preview in.svg out.png` で PNG を書き出し、別のビューアで開く手順で、反復が遅い。`preview_svg.sh` は外部の Chrome と ImageMagick `convert` に依存し、ウィンドウ高さの補正と切り抜きという回避策も抱える。
- 利用環境は Windows Terminal(WSL / SSH 越しの Linux を含む)。1.22 以降は sixel 表示に対応している。
- 表示したい対象は完成済みの `.svg` と、図を生成する `.ts`(`default export function define()` が `diagram()` を返す)の 2 種類。
- この図の「正」は Chromium の描画である。レイアウトは `lib/measure.ts` が Chromium の `getBBox()` で測った幅で組まれ、lint(`lint-svg.ts`)も Chromium で描いて検査する。プレビューが別エンジンの描画だと、「プレビューではあふれているのに lint は通る」といった検査結果との食い違いが起きる。
- 実測(Opus レビュー、同一マシン): `playwright-chromium` の `launch()` は約 210ms、`examples/out` の 2 ファイルを `setContent` + `screenshot` で描いて合計約 979ms。`@resvg/resvg-js` 2.6.2 は `loadSystemFonts` で 1.1〜3.7 秒。**速度面で resvg に利点は実証されていない。**
- ImageMagick 6 が `<text>` を落とすのは、`policy.xml` ではなく、`delegates.xml` が指す `rsvg-convert` が未インストールのため内蔵 MSVG にフォールバックするから(訂正)。いずれにせよ ImageMagick は使わない。

## 決定

1. **サブコマンド `svg-diagram show <file.svg|file.ts>...` を追加する**(`bin/svg-diagram` に `show)`、実体は `show-diagram.ts`)。
2. **描画は既存依存の Playwright(Chromium)で行い、ブラウザ内で RGBA を取り出して npm `sixel` に渡す。** resvg、ImageMagick、システムの Chrome、PNG デコーダ(`pngjs` 等)は使わない。
   - npm `sixel` の `image2sixel(data, w, h, maxColors)` は PNG ではなく **RGBA の生ピクセル**を受け取る。そこで、SVG を `<img src="data:image/svg+xml;base64,…">` で読み込み、`canvas.drawImage(img, 0, 0, w*s, h*s)` → `getImageData()` → base64 で Node に戻す。拡大縮小(`--scale` / `--width`)もこの canvas の寸法で行う。
   - **この経路は本番(`<img src="….svg">`)と同じ XML パースになる。** HTML へのインライン描画は不正な XML(値なし属性など)を黙って表示してしまい、`show` が不具合を覆い隠すため使わない。`img.onerror` または `naturalWidth === 0` なら「XML として不正」とエラーにする。
   - `--png out.png` は同じ canvas の `toDataURL('image/png')` から書く(`deviceScaleFactor` は 1 のまま、寸法は canvas で決める)。
   - 新規依存は純 JS の `sixel` のみ(`pnpm add sixel`)。ESM からの import 形と型(`types` 欠如)は実装時に検証する。`maxColors` は 256(既定)とし、`--colors N` で上げられる。
   - `.ts` 入力は測定用に起動済みのブラウザを再利用し、`.svg` と `.ts` が混在してもブラウザは 1 つを共有する(`lib/measure.ts` に `getBrowser()` / `renderRgba(svg, scale)` を足す)。**`closeMeasurer()` はすべてのファイルの描画が終わった後に `try/finally` で呼ぶ。**
3. **`.ts` から SVG を得る経路を 2 段に分け、`build()` の外から見た挙動は変えない。**
   - `lib/load-source.ts`(新規): `loadDiagram(abs): Promise<Diagram>` — `import(abs)` → `define()` → `applyConfig`。`register(resolve-hook)` は従来どおり CLI のエントリ(build / check / notes / show)で行う。`lib/dsl.ts` は図のソースが `import 'svg-diagram'` で読む公開エントリなので、ローダや `register()` を置かない。
   - `lib/dsl.ts`: `renderDiagram(d, {name, budget: 'measure' | 'cacheOnly'}): Promise<RenderResult>(`svg, laidOut, verdict, xml, notes, fit, budget, budgetSource: 'measured' | 'cache' | 'default' | null, fontScale, width, height`)` — `applyAutoLegend`、budget、fill / fontScale の二分探索、レイアウト、`verifyDiagram`、`emitSvg`、**SVG の整形式検査**まで行い、**throw せず、ファイルも書かない**。
   - `build(d, outPath, opts)` は `renderDiagram(d, {budget: 'measure'})`(キャッシュが外れたら従来どおり実測)を呼び、`!verdict.ok` なら従来どおり throw して何も書かず、書いたあと lint を走らせる(回帰テストで固定する)。
   - `build-diagram.ts` は `loadDiagram` → `d.source` / `--fit` / `--stale` の処理 → `build`、`show` は `loadDiagram` → `renderDiagram` の順に呼ぶ。`check-diagram.ts`(3 か所)と `notes-diagram.ts` の同じ読み込み手順も `loadDiagram` に置き換える(コピーを 5 か所に増やさない)。
   - **範囲**: 「検証失敗でも画像を出す」のは `verifyDiagram` の不合格に限る。`define()`、DSL コンストラクタ、レイアウトの例外は、エラーとして表示して終了する。
   - **`d.slide` の budget は引数で切り替える**: `show` は `budget: 'cacheOnly'`、`build` は `'measure'`。`getSlideBudget` に `cacheOnly: true` を足し、`budgetSource` で出所を返す(`default` なら `show` が警告する)。キャッシュキーには本来の `<name>.svg` を使う(`check --drift --rebuild` が一時ファイル名でキャッシュを外している既存の問題も同時に直る)。キャッシュが外れたら dev サーバを起動せず、キャッシュにも書かず、既定値で描いて「`build` で一度実測すると正確になる」と警告する(`fill: true` の図も既定幅で描いて警告)。
   - 複数ファイルは**逐次**処理する(`ROLES` のグローバル変更のため)。cwd 依存(`loadConfig`、`slides.md` / `pages/`)は `build` と同じ規則とし、プロジェクト外からの実行時は警告する。lint の別プロセスは起動しない。
4. **サイズ**: 既定は端末ピクセル幅に収まる縮小のみ(拡大しない)。幅は `CSI 16 t`(セルのピクセル寸法)× 列数(`/dev/tty` から作った `tty.WriteStream` の `columns`)を第一候補、`CSI 14 t` を第二、どちらも得られなければ 1200px。高さは画面高さ(同じ問い合わせから、取れなければ 1200px)の 3 倍を上限とし、超える場合は縮小して警告する。`--scale N` / `--width PX` で上書き(`preview` の `scale` 既定 2 との互換も保つ)。複数ファイルは順に縦に並べ、ファイル名を見出しとして出す。
5. **出力と TTY**: sixel は stdout が TTY のとき、または `--force` のときのみ出す。`--png out.png` 指定時は PNG を書き、TTY の有無によらず sixel は出さない(エラーにもしない)。エージェント(非 TTY)向けには `--png` + Read を案内する。対象は POSIX(Linux / WSL / macOS)。
6. **端末能力の問い合わせ**: stdin ではなく `/dev/tty` を開き(`ENXIO` なら非 TTY として扱う)、raw モードで `CSI 16 t` / `CSI 14 t` / `CSI > 0 q`(XTVERSION)/ `CSI c`(DA1)を**まとめて送り、DA1 の応答を番兵にする**。DA1 の応答(`CSI ? … c`)が来た時点で読み取りを打ち切り、終端より後のバイトは捨てる。タイムアウトは 500ms で、**タイムアウトは sixel 非対応として扱う**。raw モードは `finally` と SIGINT で必ず戻す。DA1 の属性 `4` があれば sixel 対応。
7. **tmux**: DA1 には tmux 自身が答えるため、tmux 3.3a では属性 4 が返らず「非対応」と判定される(sixel 対応は 3.4 以降かつ `--enable-sixel` ビルド)。`$TMUX` は**手元の tmux から SSH した構成では未設定**なので、判定には XTVERSION(tmux は `tmux 3.3a` と答える)を併用する。
   - tmux を検出して sixel 非対応なら、既定では出さず、`--png` と `--passthrough` を案内する。**tmux 内で `--force` 単独は案内しない**(生の DCS が捨てられるか、ゴミが出る)。
   - `--passthrough` は DCS を `\ePtmux;` … `\e\\` で包む(内部の ESC を二重化)。`allow-passthrough` が `off`(3.3 の既定)だと tmux は**黙って捨てる**ので、`$TMUX` があれば `tmux show -gv allow-passthrough` で事前確認して設定方法を示し、確認できない構成では「表示されなければ allow-passthrough を確認」と出す。画像は再描画で消え、位置もずれる既知の制約がある。
   - パススルー時は 16t / 14t に答えるのが tmux なので幅が取れず、隣のペインに描き込む恐れがある。幅は `tmux display -p '#{pane_width}'`(列数)× セル幅から決める。`#{client_cell_width}` は 3.3a で 0 を返す(実測)ため使えない場合があり、その場合は保守的なセル幅 8px を仮定し、「セル幅を推定したため `--width PX` で調整できる」と案内する。`$TMUX` がなく列数も取れない構成(手元の tmux + SSH)では、幅を推定せず `--width` の指定を促す。
8. **`--watch` と resvg の高速モード**は範囲外。速度に不満が出た時点で、「Playwright 常駐」または「resvg を `--fast` として追加」を別 ADR で検討する。
9. **`preview` の書き直し(任意・別コミット)**: 同じ `renderPng` を使えば `preview_svg.sh` の外部 Chrome / `convert` 依存を外せる。コマンドの互換は維持する。

## 検討した代替案

| 案 | 判断 |
|---|---|
| `@resvg/resvg-js` を既定にする(改訂前の案) | 速度の利点が実測で出ない。描画が lint・測定と別エンジンになり、可変フォント(Noto Sans JP VF)の太さ、絵文字(CBDT)、フォント解決で食い違う恐れがある。ネイティブ依存が全利用者に増える(入れるなら `optionalDependencies` + 動的 `import()` が必要)。保守も 2024-03 の 2.6.2 以降 alpha のみ。不採用 |
| ImageMagick で SVG を直接 sixel 化 | `rsvg-convert` 未導入で MSVG が `<text>` を落とす。`librsvg2-bin` を入れれば描けるが、システム依存が増える。不採用 |
| `sharp`(librsvg) | フォント解決が fontconfig 依存で CJK の再現性が環境次第。不採用 |
| kitty graphics / iTerm2 inline images | Windows Terminal が非対応 |
| `img2sixel` / `chafa` の外部コマンド必須化 | 環境依存が増える。npm `sixel` で足りる |
| Playwright 常駐 | 現状 1 秒前後で足りる見込み。別 ADR |

## 影響

- 良い点: 新しいネイティブ依存がなく、純 JS の `sixel` だけが増える。描画が lint・測定と同じエンジンなので、検査結果とプレビューが食い違わない。`.ts` では追加の起動コストがない。`build` と `show` が同じ経路を共有する。
- リスク:
  - `.svg` 単体の表示は Chromium 起動を含み 1 秒前後かかる(許容)。
  - sixel は減色され、細線や淡色の確認は粗くなる(厳密確認は `--png`)。
  - tmux < 3.4、SSH、ConPTY 経由では sixel が落ちる、または検出が外れる。WSL の ConPTY 経由で DA1 応答に属性 4 が含まれるか、Windows Terminal が `CSI 14 t` / `16 t` に応答するかは未検証。実機(WT 単体・WSL・SSH・tmux)での確認を受け入れ条件にする。
  - `.ts` の実行は `build` と同じく信頼できるソース前提。
- 受け入れ条件:
  1. コーパスは `test/` のフィクスチャとして新規に作る(swimlane / sequence / table / plane / wireframe、絵文字・等幅・太字を含む)。`examples/` の `.ts` は 3 本のみで種類が足りないため。
  2. `--png` の出力が、lint 用のインライン描画と同じ `deviceScaleFactor` でピクセル一致、またはごく小さな差に収まること。
  3. 値なし属性などの不正 XML の `.svg` を渡すと、エラーになること。
  4. 検証失敗(`verifyDiagram` 不合格)の図で警告つきの画像が出ること。`build()` は従来どおり throw して何も書かないこと(回帰テスト)。
  5. `.svg` のみ / `.ts` のみ / 混在の 3 通りで、プロセスが一定時間内に終了すること(measurer の閉じ忘れ・早閉じの検出)。
  6. 速度の目安: `.svg` 1 枚で 2 秒以内(Opus の実測は約 1.2 秒、node 起動込みで 2.2 秒)。超える場合に別 ADR(常駐 / `--fast`)を起こす基準とする。
  7. 実機確認(下表)。14px の本文が読めること。
- 実機確認の期待結果:

  | 環境 | 期待 |
  |---|---|
  | Windows Terminal 単体 / WSL(ConPTY) | 表示される(DA1 に属性 4。ConPTY 経由の応答は要確認) |
  | SSH(tmux なし) | 表示される |
  | tmux 3.3a + `--passthrough`(`allow-passthrough on`) | 表示される(再描画で消える制約あり) |
  | tmux 3.3a、`--passthrough` なし | 非対応の案内と `--png` / `--passthrough` が出る |
  | tmux ≥ 3.4(sixel ビルド) | 表示される |
  | 手元の tmux + SSH | XTVERSION で tmux を検出し、案内が出る |
- テスト: 拡張子の振り分け、`--png` と非 TTY の優先順位、DA1 / XTWINOPS / XTVERSION の解析とタイムアウト経路、サイズ計算、`renderDiagram` の「throw せず書かない」、`cacheOnly`、整形式検査。
- ドキュメント: README のコマンド一覧に `show` を追記。`skills/svg-diagram/SKILL.md` には「人間向け。エージェントは `--png` で書き出して Read で見る」と明記する。`preview_svg.sh` の冒頭コメントの誤り(policy ではなく `rsvg-convert` 未導入)も直す。

## 前提となる別件(本 ADR の範囲外・先に直す)

作業ツリー(未コミット)の `lib/badge.ts:60` は値なし属性 `data-badge` を出力しており、`examples/out/inventory-{component-spec,wireframe}.svg` は XML として不正である(`xmllint` で失敗)。`<img src>` では naturalWidth=0 の壊れた画像になり、直接開くと parsererror になる。インライン HTML で読み込む lint と `preview_svg.sh` では検出できない。出荷前に直す不具合として、次を別 Issue / 修正コミットで扱う。

1. `lib/badge.ts:60` を `data-badge="1"`(または `""`)にする。`lint-svg.ts:259` の `g[data-badge]` はどちらでも一致する。
2. `test/ergonomics.test.ts:201` が不正な形を固定しているので直す。
3. 再発防止として、`renderDiagram`(または `emitSvg` 自体)で整形式を検査する(`build` と `show` の両方に効く)。lint-svg には `.svg` を直接検査する経路として別に持つ。**`show` の実装はこの修正の後に行う**(修正前は golden の 2 枚が `show` で表示できない)。
4. golden(`examples/out`)を再生成する。
