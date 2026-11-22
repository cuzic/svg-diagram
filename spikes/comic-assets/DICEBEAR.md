# DiceBear のスタイル別調査

公式の静的スタイル定義 `src/*.json` 63 件を集計した。定義ごとのライセンスはリンク先の `meta.license` にある。SVG はスタイル定義から生成できる。固定の完成品点数は定義されていないため、点数は `components.*.variants` の登録数を合計した。表情欄の「目・口」は部品の点数で、組み合わせ数ではない。「—」は `eyes`、`mouth`、`expression`、`mood` の部品登録がないことを示す。利用条件と判定の理由は [README](README.md#人物) を参照。 [対象の定義一覧][tree] · [ライセンス一覧][licenses] · [公式の見本](https://www.dicebear.com/styles/) · [SVG の出力形式](https://www.dicebear.com/integrations/http-api/)

| スタイル定義 | 画風 | 部品点数 | 表情・顔部品 | ライセンス | 判定 |
| --- | --- | ---: | --- | --- | --- |
| [adventurer-neutral][adventurer-neutral-def] | 冒険者風のバストアップ（簡略版） | 76 | 目 26、口 30 | [CC BY 4.0][cc-by] | 参照のみ |
| [adventurer][adventurer-def] | 冒険者風のバストアップ | 132 | 目 26、口 30 | [CC BY 4.0][cc-by] | 参照のみ |
| [avataaars-neutral][avataaars-neutral-def] | フラットなアバター（簡略版） | 38 | 目 12、口 12 | [個人・商用利用可（独自表記）][avataaars] | 不可 |
| [avataaars][avataaars-def] | フラットなアバター | 103 | 目 12、口 12 | [個人・商用利用可（独自表記）][avataaars] | 不可 |
| [big-ears-neutral][big-ears-neutral-def] | 耳を強調したカートゥーン（簡略版） | 88 | 目 32、口 38 | [CC BY 4.0][cc-by] | 参照のみ |
| [big-ears][big-ears-def] | 耳を強調したカートゥーン | 165 | 目 32、口 38 | [CC BY 4.0][cc-by] | 参照のみ |
| [big-smile][big-smile-def] | 笑顔を強調した似顔絵 | 38 | 目 8、口 8 | [CC BY 4.0][cc-by] | 参照のみ |
| [blobs][blobs-def] | 有機的な色面 | 9 | — | [CC0 1.0][cc0] | 同梱可 |
| [bottts-neutral][bottts-neutral-def] | ロボット（簡略版） | 31 | 目 14、口 9 | [個人・商用利用可（独自表記）][bottts] | 不可 |
| [bottts][bottts-def] | ロボット | 53 | 目 14、口 9 | [個人・商用利用可（独自表記）][bottts] | 不可 |
| [cameo][cameo-def] | 横顔のシルエット | 22 | 口 5 | [CC0 1.0][cc0] | 同梱可 |
| [cats][cats-def] | デフォルメした猫 | 52 | 目 12、口 7 | [CC0 1.0][cc0] | 同梱可 |
| [clay][clay-def] | 粘土風の顔 | 72 | 目 15、口 20 | [CC0 1.0][cc0] | 同梱可 |
| [constellation][constellation-def] | 星座 | 24 | — | [CC0 1.0][cc0] | 同梱可 |
| [critters][critters-def] | 丸みのある動物風キャラクター | 80 | 目 19、口 19 | [CC0 1.0][cc0] | 同梱可 |
| [croodles-neutral][croodles-neutral-def] | 手描きの線画（簡略版） | 43 | 目 16、口 18 | [CC BY 4.0][cc-by] | 参照のみ |
| [croodles][croodles-def] | 手描きの線画 | 89 | 目 16、口 18 | [CC BY 4.0][cc-by] | 参照のみ |
| [cutouts][cutouts-def] | 切り絵風の顔 | 38 | 目 7、口 7 | [CC0 1.0][cc0] | 同梱可 |
| [disco][disco-def] | 円や四角などの幾何図形 | 6 | — | [CC0 1.0][cc0] | 同梱可 |
| [dogs][dogs-def] | デフォルメした犬 | 72 | 目 10、口 8 | [CC0 1.0][cc0] | 同梱可 |
| [dylan][dylan-def] | フラットな顔 | 20 | 表情 7 | [CC BY 4.0][cc-by] | 参照のみ |
| [fun-emoji][fun-emoji-def] | 絵文字風の丸い顔 | 30 | 目 15、口 15 | [CC BY 4.0][cc-by] | 参照のみ |
| [gaze][gaze-def] | 目を中心にした図形 | 27 | 目 11 | [CC0 1.0][cc0] | 同梱可 |
| [glass][glass-def] | ガラス風の図形 | 8 | — | [CC0 1.0][cc0] | 同梱可 |
| [glyphs][glyphs-def] | 線画の記号 | 35 | — | [CC BY 4.0][cc-by] | 参照のみ |
| [icons][icons-def] | Bootstrap Icons の記号 | 146 | — | [MIT][mit] | 同梱可 |
| [identicon][identicon-def] | 格子パターン | 7 | — | [CC0 1.0][cc0] | 同梱可 |
| [initial-face][initial-face-def] | 文字を組み込んだ顔 | 12 | 目 8、口 1 | [CC0 1.0][cc0] | 同梱可 |
| [initials][initials-def] | 頭文字 | 4 | — | [CC0 1.0][cc0] | 同梱可 |
| [landscape][landscape-def] | 風景 | 35 | — | [CC0 1.0][cc0] | 同梱可 |
| [line-face][line-face-def] | シンプルな線の顔 | 22 | 目 8、口 8 | [CC0 1.0][cc0] | 同梱可 |
| [loops][loops-def] | 反復模様 | 3 | — | [CC0 1.0][cc0] | 同梱可 |
| [lorelei-neutral][lorelei-neutral-def] | 細い線の似顔絵（簡略版） | 76 | 目 24、口 27 | [CC0 1.0][cc0] | 同梱可 |
| [lorelei][lorelei-def] | 細い線の似顔絵 | 134 | 目 24、口 27 | [CC0 1.0][cc0] | 同梱可 |
| [marbles][marbles-def] | 丸い色面の顔 | 48 | 目 9、口 11 | [CC0 1.0][cc0] | 同梱可 |
| [micah][micah-def] | フラットなバストアップ | 40 | 目 5、口 8 | [CC BY 4.0][cc-by] | 参照のみ |
| [miniavs][miniavs-def] | 小さな似顔絵 | 25 | 目 3、口 2 | [CC BY 4.0][cc-by] | 参照のみ |
| [moods][moods-def] | 表情を強調した顔 | 41 | 目 16、口 15 | [CC0 1.0][cc0] | 同梱可 |
| [notionists-neutral][notionists-neutral-def] | 太い線の人物（簡略版） | 79 | 目 5、口 30 | [CC0 1.0][cc0] | 同梱可 |
| [notionists][notionists-def] | 太い線の人物 | 194 | 目 5、口 30 | [CC0 1.0][cc0] | 同梱可 |
| [open-peeps][open-peeps-def] | 手描き線のバストアップ | 104 | 表情 30 | [CC0 1.0][cc0] | 同梱可 |
| [patchwork][patchwork-def] | パッチワーク模様 | 18 | — | [CC0 1.0][cc0] | 同梱可 |
| [personas][personas-def] | 色面を使った似顔絵 | 46 | 目 6、口 7 | [CC BY 4.0][cc-by] | 参照のみ |
| [pixel-art-neutral][pixel-art-neutral-def] | ピクセル風の似顔絵（簡略版） | 49 | 目 12、口 23 | [CC0 1.0][cc0] | 同梱可 |
| [pixel-art][pixel-art-def] | ピクセル風の似顔絵 | 139 | 目 12、口 23 | [CC0 1.0][cc0] | 同梱可 |
| [pixelbot][pixelbot-def] | ピクセル風のロボット | 12 | 目 7、口 5 | [CC0 1.0][cc0] | 同梱可 |
| [planets][planets-def] | 惑星 | 24 | — | [CC0 1.0][cc0] | 同梱可 |
| [rings][rings-def] | 同心円 | 21 | — | [CC0 1.0][cc0] | 同梱可 |
| [shadows][shadows-def] | 影のある人物シルエット | 25 | — | [CC0 1.0][cc0] | 同梱可 |
| [shape-grid][shape-grid-def] | 幾何図形の格子 | 9 | — | [CC0 1.0][cc0] | 同梱可 |
| [shapes][shapes-def] | 幾何図形 | 21 | — | [CC0 1.0][cc0] | 同梱可 |
| [slice][slice-def] | 切り分けた色面 | 26 | — | [CC0 1.0][cc0] | 同梱可 |
| [sprouts][sprouts-def] | 顔のある鉢植え | 50 | 目 11、口 11 | [CC0 1.0][cc0] | 同梱可 |
| [squircles][squircles-def] | 丸みのある四角形 | 9 | — | [CC0 1.0][cc0] | 同梱可 |
| [stack][stack-def] | 積み石風の図形 | 24 | — | [CC0 1.0][cc0] | 同梱可 |
| [stripes][stripes-def] | 縞模様 | 7 | — | [CC0 1.0][cc0] | 同梱可 |
| [thumbs][thumbs-def] | 親指風のキャラクター | 15 | 目 8、口 5 | [CC0 1.0][cc0] | 同梱可 |
| [toon-head][toon-head-def] | カートゥーン風のバストアップ | 35 | 目 5、口 5 | [CC BY 4.0][cc-by] | 参照のみ |
| [triangles][triangles-def] | 三角形のパターン | 2 | — | [CC0 1.0][cc0] | 同梱可 |
| [voxel-art][voxel-art-def] | ボクセル風の顔 | 69 | 目 8、口 10 | [CC0 1.0][cc0] | 同梱可 |
| [voxel-bot][voxel-bot-def] | ボクセル風のロボット | 25 | 目 7、口 5 | [CC0 1.0][cc0] | 同梱可 |
| [waves][waves-def] | 波模様 | 14 | — | [CC0 1.0][cc0] | 同梱可 |
| [weave][weave-def] | 織り模様 | 25 | — | [CC0 1.0][cc0] | 同梱可 |

参照のみのスタイルは出典を自動で入れることを前提とする。MIT の Icons は配布先にも著作権と許諾文を含める。個人・商用利用可と表記された 4 スタイルは素材ファイルの再配布条件が未確認のため、今回の採用対象から外す。

[tree]: https://github.com/dicebear/styles/tree/09d9885d2313aec633a21dcf414857103053169f/src
[licenses]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/LICENSE.md
[cc0]: https://creativecommons.org/publicdomain/zero/1.0/
[cc-by]: https://creativecommons.org/licenses/by/4.0/
[mit]: https://github.com/twbs/icons/blob/main/LICENSE
[avataaars]: https://www.avataaars.com/
[bottts]: https://bottts.com/
[adventurer-neutral-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/adventurer-neutral.json
[adventurer-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/adventurer.json
[avataaars-neutral-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/avataaars-neutral.json
[avataaars-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/avataaars.json
[big-ears-neutral-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/big-ears-neutral.json
[big-ears-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/big-ears.json
[big-smile-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/big-smile.json
[blobs-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/blobs.json
[bottts-neutral-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/bottts-neutral.json
[bottts-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/bottts.json
[cameo-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/cameo.json
[cats-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/cats.json
[clay-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/clay.json
[constellation-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/constellation.json
[critters-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/critters.json
[croodles-neutral-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/croodles-neutral.json
[croodles-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/croodles.json
[cutouts-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/cutouts.json
[disco-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/disco.json
[dogs-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/dogs.json
[dylan-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/dylan.json
[fun-emoji-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/fun-emoji.json
[gaze-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/gaze.json
[glass-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/glass.json
[glyphs-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/glyphs.json
[icons-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/icons.json
[identicon-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/identicon.json
[initial-face-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/initial-face.json
[initials-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/initials.json
[landscape-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/landscape.json
[line-face-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/line-face.json
[loops-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/loops.json
[lorelei-neutral-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/lorelei-neutral.json
[lorelei-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/lorelei.json
[marbles-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/marbles.json
[micah-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/micah.json
[miniavs-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/miniavs.json
[moods-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/moods.json
[notionists-neutral-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/notionists-neutral.json
[notionists-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/notionists.json
[open-peeps-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/open-peeps.json
[patchwork-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/patchwork.json
[personas-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/personas.json
[pixel-art-neutral-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/pixel-art-neutral.json
[pixel-art-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/pixel-art.json
[pixelbot-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/pixelbot.json
[planets-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/planets.json
[rings-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/rings.json
[shadows-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/shadows.json
[shape-grid-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/shape-grid.json
[shapes-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/shapes.json
[slice-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/slice.json
[sprouts-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/sprouts.json
[squircles-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/squircles.json
[stack-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/stack.json
[stripes-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/stripes.json
[thumbs-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/thumbs.json
[toon-head-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/toon-head.json
[triangles-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/triangles.json
[voxel-art-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/voxel-art.json
[voxel-bot-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/voxel-bot.json
[waves-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/waves.json
[weave-def]: https://github.com/dicebear/styles/blob/09d9885d2313aec633a21dcf414857103053169f/src/weave.json
