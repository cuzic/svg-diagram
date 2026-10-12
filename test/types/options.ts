// Type-level tests: option shapes that are discriminated unions, tuples and literal unions. Never executed (see ids.ts).
import {diagram, box, banner, bars, caption, connect, branch, grid, row, pyramid, curve, raw, screens, stat, people, dots, wireframe, wf} from '../../lib/dsl.ts';

export function optionCases(): void {
  // ---- diagram(): theme | day is required; fill needs slide ----
  diagram({theme: 'blue'});
  diagram({theme: 'amber', title: 't', width: 800, legend: 'auto'});
  diagram({day: 2});
  diagram({theme: 1});
  diagram({theme: 'teal', fill: true, slide: {page: 'p.html', heading: 'h'}});
  diagram({theme: 'teal', fill: false});
  // @ts-expect-error neither theme nor day (runtime: "diagram({theme}) must be one of ...")
  diagram({});
  // @ts-expect-error no options at all
  diagram();
  // @ts-expect-error not a theme
  diagram({theme: 'purple'});
  // @ts-expect-error not a legacy day
  diagram({day: 3});
  // @ts-expect-error fill needs the slide it fills (runtime: "diagram({fill: true}) needs diagram({slide})")
  diagram({theme: 'blue', fill: true});
  // @ts-expect-error unknown option
  diagram({theme: 'blue', colour: 'red'});

  // ---- box({step}) needs a title ----
  box({step: 1, title: 'T'});
  box({title: 'T', body: 'b', lines: ['x'], tone: 'new', tag: 'tag'});
  // @ts-expect-error the badge aligns to the title's first line (runtime: "box({step}) needs a title")
  box({step: 1});
  // @ts-expect-error the same with a body but no title
  box({step: 'A', body: 'b'});

  // ---- sizes are literal numbers >= 14 ----
  box({title: 'T', size: 14});
  box({title: 'T', size: 20});
  // @ts-expect-error below the 14px floor (runtime: "font-size 12 is below the 14px floor")
  box({title: 'T', size: 12});
  // @ts-expect-error not an integer in the allowed set
  box({title: 'T', size: 14.5});
  // @ts-expect-error a size is a number, not a CSS string
  box({title: 'T', size: '16px'});

  // ---- exact option bags: a typo is an error, not silently ignored ----
  // @ts-expect-error
  box({titel: 'T'});
  // @ts-expect-error
  banner({headline: 'H', subb: 'x'});
  // @ts-expect-error
  caption('c', {boldd: true});
  // @ts-expect-error unknown box tone
  box({title: 'T', tone: 'warning'});
  // @ts-expect-error a banner needs its headline
  banner({sub: 'x'});

  stat('76%', '率', {size: 'display', tone: 'danger'});
  row([stat(10, '件数'), stat(20, '金額')]);
  // @ts-expect-error stat has only the two semantic sizes
  stat('76%', '率', {size: 'hero'});
  // @ts-expect-error display is a text role, not a box tone
  stat('76%', '率', {tone: 'display'});

  bars([{label: 'A', value: 1, series: 'a', id: 'a'}], {max: 2, dir: 'h'});
  bars([{label: 'A', value: 1}, {label: 'B', value: 2}], {dir: 'v', stack: true, unit: '%'});
  // @ts-expect-error unknown series
  bars([{label: 'A', value: 1, series: 'danger'}]);
  // @ts-expect-error unknown direction
  bars([{label: 'A', value: 1}], {dir: 'horizontal'});

  // ---- connect(): route-specific and label-specific options ----
  connect('a', 'b');
  connect('a', 'b', {route: 'elbow', bend: 0.25, bendOffset: 8});
  connect('a', 'b', {route: 'elbow', bend: 'auto', label: 'x', chip: true, labelAt: 0.3});
  connect('a:bottom', 'b:bottom', {route: 'loop-under', dip: 40});
  connect('a', 'b', {route: 'straight', label: 'x', arrow: 'both', line: 'dotted', tone: 'danger'});
  connect('a', 'b', {label: 'x'});
  // @ts-expect-error dip belongs to loop-under only
  connect('a', 'b', {dip: 40});
  // @ts-expect-error dip with an elbow
  connect('a', 'b', {route: 'elbow', dip: 40});
  // @ts-expect-error bend belongs to elbow only
  connect('a', 'b', {bend: 0.5});
  // @ts-expect-error bend with loop-under
  connect('a', 'b', {route: 'loop-under', bend: 0.5});
  // @ts-expect-error bendOffset belongs to elbow only
  connect('a', 'b', {route: 'loop-under', bendOffset: 5});
  // @ts-expect-error chip needs a label
  connect('a', 'b', {chip: true});
  // @ts-expect-error labelAt needs a label
  connect('a', 'b', {labelAt: 0.4});
  // @ts-expect-error unknown route
  connect('a', 'b', {route: 'curved'});
  // @ts-expect-error unknown arrow
  connect('a', 'b', {arrow: 'middle'});

  // ---- branch(): the route defaults to 'elbow', so bend needs no route ----
  branch('a', [{to: 'b', label: 'yes', bend: 'start'}, {to: 'c', dashed: true}], {bend: 0.3});
  // @ts-expect-error dip needs route loop-under
  branch('a', [{to: 'b', dip: 10}]);
  // @ts-expect-error chip needs a label
  branch('a', [{to: 'b', chip: true}]);
  // @ts-expect-error malformed ref in a target
  branch('a', [{to: 'b:sideways'}]);

  // ---- grid(children, {cols}): cols is required ----
  grid([box({title: 'a'}), box({title: 'b'})], {cols: 2});
  grid([box({title: 'a'})], {cols: 3, gap: 8});
  // @ts-expect-error opts missing (runtime: "grid(children, {cols}) needs cols")
  grid([box({title: 'a'})]);
  // @ts-expect-error cols missing
  grid([box({title: 'a'})], {gap: 8});
  // @ts-expect-error row children are box() bands, not captions
  row([caption('x')]);

  // ---- pyramid(): at least 2 layers; curve(): at least 2 points with a numeric y ----
  pyramid(['top', 'bottom']);
  pyramid(['a', {text: 'b'}, 'c'], {layerHeight: 60});
  // @ts-expect-error one layer (runtime: "pyramid(layers) needs at least 2 layers")
  pyramid(['only']);
  // @ts-expect-error no layers
  pyramid([]);
  curve([{y: 1}, {y: 0.5, emphasis: 'danger', dropLine: true}, {y: 0}], {height: 200});
  // @ts-expect-error one point (runtime: "curve(points) needs at least 2 points")
  curve([{y: 1}]);
  // @ts-expect-error y must be a number (runtime: "every point needs a numeric y")
  curve([{y: 1}, {y: '0.5'}]);
  // @ts-expect-error y is missing
  curve([{y: 1}, {emphasis: 'accent'}]);

  // ---- raw({draw}): draw is required ----
  raw({h: 10, draw: ctx => `<rect x="${ctx.x}"/>`});
  // @ts-expect-error runtime: "raw({draw}) needs a draw(ctx) function"
  raw({h: 10});
  // @ts-expect-error draw must be a function
  raw({draw: '<g/>'});

  // ---- wf nodes: mark / tone / state unions, [row, col] tuples, exact keys ----
  wf.btn('a', {primary: true, n: 1, mark: 'new'});
  wf.chip('c', {tone: 'ok'});
  wf.video({state: 'loading', live: true});
  screens([{id: 's', root: wf.text('x'), at: [1, 0.5]}]);
  wireframe(wf.col([wf.btn('a', {n: true})]), {h: 'fit', frame: 'light', notes: [{title: 't', text: 'x'}, 'y'], overlays: [wf.dialog('d', {buttons: [wf.btn('ok')]}), wf.toast('t')]});
  // @ts-expect-error mark is 'new' | 'changed'
  wf.btn('a', {mark: 'old'});
  // @ts-expect-error unknown tone
  wf.chip('c', {tone: 'green'});
  // @ts-expect-error unknown state
  wf.video({state: 'broken'});
  // @ts-expect-error typo in a node option
  wf.btn('a', {primay: true});
  // @ts-expect-error `at` is [row, col]
  screens([{id: 's', root: wf.text('x'), at: [1]}]);
  // @ts-expect-error `at` is [row, col], not three numbers
  screens([{id: 's', root: wf.text('x'), at: [1, 2, 3]}]);
  // @ts-expect-error a screens item needs a root
  screens([{id: 's', title: 'T'}]);
  // @ts-expect-error h is a number or 'fit'
  wireframe(wf.text('x'), {h: 'tall'});
  // @ts-expect-error a text size can only be 'title'
  wf.text('x', {size: 10});
}

export function peopleDotsCases(): void {
  diagram({theme: 'blue'}).add(people(100, 76, {tone: 'danger', cols: 10}), dots([0.1, {at: 0.5, tone: 'accent'}], {zones: [{from: 0, to: 0.3, label: 'x'}]}));
  // @ts-expect-error tone is accent | danger
  people(10, 1, {tone: 'muted'});
  // @ts-expect-error people() takes no reveal
  people(10, 1, {reveal: 1});
  // @ts-expect-error a zone needs a label
  dots([0.1], {zones: [{from: 0, to: 0.3}]});
}
