# PR #496 レビュー(Opus、第 1 回)

対象: fix/serve-touch-zoom @ 31708244b40a1685d0820584cabeba604e8b5324

## 結論
縦画面のピンチ・2 本指の移動・帯の外でのピンチは、Chromium で直っている。発表者のページとデスクトップの操作(ホイール・Ctrl+ホイール・ダブルクリック・ドラッグ・`+`/`-`)は変わらない。ただし Major が 2 つある。拡大中に `overflow:visible` にしたので、閲覧者のレーザーが違う所に見えるようになり、スポットライトの暗くする範囲がスライドの一部にしかかからない(M1)。また、PR が直したと書いている「見えないボタンを押してしまう」が、実際のタップでは直っていない(M2)。converged: no。

## 前の回
初回。

## 確かめたこと(問題なし)
- `test/present-touch.test.ts` と、`present-*`・`serve-cli`・`site*`・`deck-browser` のテスト(70)はすべて通る。
- **発表者のページ**: `$('slide').parentNode === $('stage')`(`.curwrap.zbox`)なので、`frame()` は main の `$('stage').getBoundingClientRect()` と同じ枠を返す。`body.zoomed .stage .zbox` は `.stage` クラスが無いので当たらず、拡大中も `overflow:hidden` のまま(試した: computed `hidden`)。390×844 の発表者のページでピンチしても `pnav` は隠れない。
- **デスクトップ(発表者のページ 1280×800)**: ダブルクリックと Ctrl+ホイールで、指した点が (0.299, 0.599) と (0.3, 0.6) のまま残る。ドラッグで (50, 20) 動く。`+` でスライドの中心が枠の中心から動かない(0, 0)。
- **拡大の同期**: `zoom.x / zoom.y` は、どちらのページでも「スライドの幅・高さに対する 0..1」のまま。`offsetWidth` を枠の `getBoundingClientRect` にしても、違うのは丸めだけで、発表者 → 閲覧者のメッセージの意味は変わらない。
- **横向きのスマホ(844×390)**: 枠は 693×390 で左右が黒。ピンチの中心が (0.250, 0.250) のまま残る。左の黒の帯でピンチしても、ページは拡大されず(scale 1)スライドが拡大する。
- **操作バー**: キーボードの Tab で `:focus-within` が効き、`pointer-events:auto`・opacity 1 になる。マウスは `mousemove` → `showNav` で出て押せる。隠れたバーの位置をタップするとバーが出る。拡大中も、バー(z-index 6)・status/hint(7)は、拡大した画像の上に出る(`.stage` は fixed で、z-index の無い自分の重なりの中に収まる)。
- **ピンチの後のスワイプ**: 合成した TouchEvent で確かめた。拡大してから 100% まで戻し、1 本を離して残りで 180px 動かしても、スライドは変わらない(`sx` が null のまま)。300% で 1 本を離すと、残りの 1 本で +50px 動く。
- **iOS**: `gesturestart` は touch でも wheel でもないので、既定で passive にならない。`preventDefault` は効く。touch のリスナーが passive のままなのは正しい(ページの拡大を止めるのは `touch-action` の役目で、passive を外すとスクロールの遅延になるだけ)。

## 指摘

### M1 (Major): 拡大中の閲覧者のページで、レーザーが違う所に見え、スポットライトがスライドの一部しか暗くしない
- 場所: `lib/present/ui.ts:144`(`body.zoomed .stage .zbox{overflow:visible}`)、`lib/present/ui.ts:298`(`showLaser` の `box = $('stage')`)、`lib/present/ui.ts:70`(`#spot` と `#laser` が `.zbox` の中にある)。
- 問題: 閲覧者のページでは `#laser` と `#spot` の位置の基準は `.zbox`(position:relative)なのに、`showLaser` は `$('stage')`(画面全体の `main.stage`)からの位置で置いている。縦画面では枠の上端(312px)のぶん、下にずれる。これは main からある誤りだが、main では `overflow:hidden` がずれた点を切っていたので、ほぼ見えなかった。この PR で拡大中は `overflow:visible` になったので、ずれた点がそのまま見える。
  - 試した(390×844、SSE の閲覧者のページ。発表者から zoom と pointer (0.5, 0.5) を送る):
    - レーザー: 狙いは (195, 422)。出た所は (195, 734)。z=3 では切られずに見える。
    - スポットライト z=3: スライドは y 93..751 に広がるのに、`#spot` は枠(y 312..531)だけを覆う。帯の外に出た画像は暗くならない。円の中心も同じだけずれる。
  - 発表者が拡大してからレーザーやスポットライトを使うと、縦にしたスマホの聴き手には、違う所を指しているように見える。
- 直し方: 閲覧者のページでは `#spot` と `#laser` を `.zbox` の外、`main.stage` の直下に移す(`viewerPage` の 1 行)。`showLaser` の `box = $('stage')` は、そのままで基準と合う(発表者のページは `#stage` が枠なので変わらない)。試した: レーザーは z=1 でも z=3 でも (195, 422) に出る。`#spot` は画面全体(390×844)を覆う。
- テスト: `present-touch.test.ts` に、SSE(か `onMessage` に渡す)で zoom と pointer を与え、縦画面で `#laser` の中心が狙いの点に来ること、z>1 で `#spot` がスライドの画像全体を覆うことを足す。

### M2 (Major): 隠れたバーの位置をタップすると、まだその下のボタンが押される(PR の 5 の後半が直っていない)
- 場所: `lib/present/ui.ts:158`(`.nav.show{…pointer-events:auto}`)、`lib/present/ui.ts:545`(`showNav`)、`test/present-touch.test.ts:104-108`。
- 問題: タップは、`touchend` の後に、合成された `click` が来る。`touchend` の処理の中で `showNav()` がすぐに `.show` を付けるので、`click` の当たり判定の時には、バーはもう `pointer-events:auto` になっている。そのため、見えないボタンに当たる。
  - 試した(CDP の本物のタップを、隠れた `＋` の位置に 1 回): click の target は `zin`、拡大率は 125%。直す前の main と同じ結果。
  - PR のテストは `elementFromPoint` で「今はバーに当たらない」ことしか見ていないので、これを見逃す。
- 直し方: 押せるようになるのを、見えるようになるより少し遅らせる。例えば `.nav.show` は opacity だけにし、`.nav.live,.nav:focus-within{pointer-events:auto}` を足す。`showNav` で `live` を 400ms 後に付け、隠すときに `show` と一緒に外す(タッチからの表示だけを遅らせてもよい)。試した: 同じタップで click の target は `stage`、拡大率は 100% のまま。その後のタップで「次」は押せる。Tab の `:focus-within` もそのまま効く。
- テスト: `elementFromPoint` ではなく、CDP の `touchStart`/`touchEnd` で隠れた `＋` の位置をタップし、拡大率が 100% のままで、どのボタンも押されないことを確かめる。

### m1 (Minor): 指の間の点を動かしながらピンチすると、最初に指の間にあった点が指からずれる
- 場所: `lib/present/ui.ts:495`
- 問題: 今の指の間 `m` を中心に拡大してから、`m - pinch.m` だけ動かしている。正しいのは、前の指の間 `pinch.m` を中心に拡大してから動かすこと。今のやり方では、1 回ごとに (倍率 − 1) × 移動量 の誤差が出る。
  - 試した(指の間を (195, 422) → (255, 452)、倍率 3): 4 回に分けて動かすと、30px と 15px ずれる。24 回では 5px と 2.5px。実機はイベントが細かいので小さいが、0 にはならない。
- 直し方: `zoomBy(d / pinch.d, pinch.m.x, pinch.m.y)` にする。試した: 4 回でも (255, 452) にぴったり来る。テストに「ピンチしながら動かす」場合を足す。

### m2 (Minor): 3 本指から 2 本に戻ると、拡大率が飛ぶ
- 場所: `lib/present/ui.ts:488`、`lib/present/ui.ts:504`
- 問題: 3 本目が触れても `pinch` は前の 2 本の `d`・`m` のまま。どれか 1 本が離れて 2 本に戻ると、別の組の距離を前の `d` と比べる。試した(合成した TouchEvent): 1px 動かしただけで 117% → 318%。main にもある誤りだが、この PR の差分 1 つ分で直せる。
- 直し方: `touchstart` で `e.touches.length > 2` のときは `pinch = null` にして何もしない。`touchend` で `e.touches.length === 2` になったら `pinch = {d: dist(e.touches), m: mid(e.touches)}` に取り直す。

### m3 (Minor): バーが見えている間や、hint・進み具合の帯から始めたピンチは、まだ効かない
- 場所: `lib/present/ui.ts:139`、`lib/present/ui.ts:521`
- 問題: `touch-action:none` と `gesturestart` の処理は `#stage` にしか無い。`.nav`(タップの後と開いた直後に 2.5 秒見える)、`.hint`(縦画面の初回に 6 秒)、`.progress` は `#stage` の外。試した: バーが見えている間に 2 本目の指をバーに置くと、ピンチで拡大されない(100% のまま)。Chromium ではページも拡大されなかったが、iOS では `gesturestart` が `#stage` に来ないので、ページの拡大を止められない見込み。
- 直し方: `body.viewer{touch-action:none}` にして、スクロールが要る `.overview` と `.helpbox` だけ `touch-action:pan-y` にする。`gesturestart` は `document` で止める。touchstart/move/end も `document` で受けて、`#overview`・`#help` が開いている間は何もしない、という形にすると、バーの上から始めたピンチも拾える。

### m4 (Minor): テストが閲覧者の縦画面しか見ていない
- 場所: `test/present-touch.test.ts`
- 問題: `frame()` は発表者のページと横画面でも使う。上の「確かめたこと」の、発表者のページ(ダブルクリック・Ctrl+ホイールの中心、拡大中も `overflow:hidden`)と、横向きのスマホ(844×390 の左右の黒の帯でのピンチ)は、どのテストも見ていない。
- 直し方: 同じ CDP のやり方で、横向きのスマホ 1 つと発表者のページ 1 つを足す(`presenterPage` は SSE の `/events` を `page.route` で返せば、サーバー無しで開ける)。

### n1 (nit): 16:9 でないデスクトップの閲覧者の窓でも、拡大した画像が上下(左右)の黒にはみ出す
- 場所: `lib/present/ui.ts:144`
- 問題: `body.zoomed .stage .zbox{overflow:visible}` はスマホに限らない。16:10 の窓やプロジェクターでは、発表者のページ(枠で切る)より聴き手の方が広く見える。害は小さいが、意図なら PR 本文に一言書く。

## 判定
Major 2 件(M1・M2)。直して、もう 1 回レビューする。M1 は `viewerPage` で `#spot`/`#laser` を `.zbox` の外に出す 1 行、M2 はバーを押せるようになるのを遅らせる数行で直る(どちらも手元で試した)。m1〜m3 は同じ PR で直すことを勧める(m1 は 1 語)。

converged: no
