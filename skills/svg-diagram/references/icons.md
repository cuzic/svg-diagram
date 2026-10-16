# 絵記号（アイコン）
（svg-diagram の入口は `../SKILL.md`）


`box({icon})` / `iconRow()` のアイコンは本体に入っていない。**プロジェクトごとに入れる**（`svg-diagram.icons.json`）。「鍵のアイコンが欲しい」と言われたら、次の順で進める。

1. **英語に直す**: Iconify の検索は英語。「鍵」→ `key`、「橋」→ `bridge`、「人」→ `person`、「承認」→ `approval`, `check-circle` など、似た語を 2〜3 個。
2. **候補を出す**: `svg-diagram icons find key bridge --png sheet.png`。ライセンスが許すセットだけが並び、**主セット**（最初に入れたセット）が先頭に出る。`--style fill|line` で塗り／線画を絞れる。
3. **目で選ぶ**: `sheet.png` を見る（枠が色つきのものが主セット）。図の中のアイコンは見た目を揃える（塗りと線画を混ぜない・太さが違うセットを混ぜない）。迷ったら主セットのものを選ぶ。主セットに無い時だけ他のセットから選び、揃わないことを伝える。
4. **入れる**: 候補の下に出る行をそのまま実行する（`svg-diagram icons add mdi:key-variant=key`）。1 回で複数入れられる。名前は図のソースで使う短い名前。
   セットに無い名前が混じるときは `--skip-missing`（あるものだけ入れて、無い名前を一覧する）。無いまま既定で実行すると、無い名前を全部まとめて報告して何も入れない。
   経理・業務の図なら、まず `svg-diagram icons add-set accounting`（`icons sets` で `office` / `infra` も）で用途別のセットを一括で入れられる。個別の `find` はその後の不足分だけ。
5. **使う**: `box({icon: 'key', title: '鍵の管理'})`。`icon` は box のほか、swimlane の step、`cell('鍵', {icon: 'key'})`（table のセル）、stateDiagram の状態 `{id, label, icon}`、sankey のノード `{id, icon}`、bpmn のタスク `{id, lane, label, icon, iconTone?}`（イベント・ゲートウェイは不可）、sequence の参加者 `{id, label, icon, iconTone?}` にも付く（bpmn / sequence はラベルの上に 20px）。`step`（丸番号）とも併用できる（アイコン→番号→タイトルの順）。入っていない名前は、入れ方つきのエラーで教えてくれる。

注意:
- CC BY などのライセンスのセットは既定で除外される。使うかはユーザーに確認し、了承されたら `--allow-license CC-BY-4.0`。
- 多色（固定色）のアイコンは `--color` が要る。トーンにもダークテーマにも従わず検査の外になるので、色そのものに意味がある 1〜2 枚だけにする。
- 入れたアイコンの出典は `svg-diagram icons notice` で出せる（クレジットが要る文書に貼る）。
- 絵記号は図の核心の数枚だけ。全部の箱には付けない。
