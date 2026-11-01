# ChatGPT の Code Interpreter で動かす

Node と Chromium だけがある環境(Python の playwright が Chromium を落としてある)で、npm パッケージも `tsc` も無しに動かす手順。

## 何が要らないか

| 要らないもの | 代わりに |
|---|---|
| `tsc` / `dist/` | `.ts` をそのまま `node` で実行する(型は Node が剥がす。22.18 以上は無指定、22.6〜22.17 は `bin/svg-diagram` が `--experimental-strip-types` を足す) |
| `playwright-chromium`(npm) | `lib/cdp-browser.ts` が Chromium を DevTools プロトコルで直接動かす |
| `harfbuzzjs`(文字幅をフォントから読む) | 文字幅は Chromium で測る(`SVG_DIAGRAM_MEASURE=chromium`。入っていなければ自動でこちらになる) |
| `@resvg/resvg-js`(SVG→PNG) | `--engine chromium`(入っていなければ自動でこちら) |
| `google-chrome` | Python playwright の Chromium(`~/.cache/ms-playwright/chromium-*/…/chrome`)、`SVG_DIAGRAM_CHROMIUM` で指した実行ファイル、PATH 上の `chromium` の順に探す |

`lint` の既定は、HarfBuzz が無ければブラウザの検査(`--engine browser`)になる。

## 使い方

リポジトリのフォルダ一式(`node_modules` は無くてよい)をアップロードして、Python から呼ぶ。

```python
import subprocess, os
env = {**os.environ, "SVG_DIAGRAM_MEASURE": "chromium"}
run = lambda *a: subprocess.run(["node", *a], cwd="svg-diagram", env=env, capture_output=True, text=True)

print(run("build-diagram.ts", "examples/bowtie.ts", "--out", "/mnt/data/bowtie.svg").stdout)
print(run("lint-svg.ts", "/mnt/data/bowtie.svg").stdout)
print(run("preview-svg.ts", "/mnt/data/bowtie.svg", "/mnt/data/bowtie.png").stdout)   # PNG(Chromium で描く)
```

図の元(`.ts`)は `import {diagram, box} from 'svg-diagram'` と書ける(読み込みの仕組みが `lib/dsl.ts` へ向ける)。

## 環境変数

- `SVG_DIAGRAM_CHROMIUM` — 使う Chromium の実行ファイル(root で動かすときは `--no-sandbox` が自動で付く)。
- `SVG_DIAGRAM_BROWSER` — `auto`(既定: playwright-chromium があればそれ、無ければ直接)/ `playwright` / `cdp`。
- `SVG_DIAGRAM_MEASURE` — `chromium` / `font`。

## 動かないもの

- `pptx`(PNG の下絵を resvg で描く)と、`show`(sixel)。どちらもそのパッケージが要る。
- `slide-budget`(Slidev の開発サーバーが要る)。
- 文字幅は Chromium で測るので、フォントを入れた手元の版(`font` 計測)と、日本語の幅が数 px ずれることがある。同じ数字で揃えたいときは、手元と同じフォントのファイルを `.svg-diagram.json` の `fonts` で指す(その場合は HarfBuzz が要る)。
