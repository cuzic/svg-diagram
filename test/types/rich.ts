// Type-level tests for rich text (ADR 0003): which fields take em.* parts, and that a band never holds them. Never executed (see ids.ts).
import {banner, box, caption, diagram, em, group, row, stat, swimlane, wf} from '../../lib/dsl.ts';
import type {BannerBand, BoxBand, BoxLine, CaptionBand, GroupBand, RichText, Styled, SwimlaneStepBand} from '../../lib/types.ts';

export function richCases(): void {
  // ---- positive: the fields in scope take a string or an array with em.* parts ----
  box({title: ['Claude in ', em.b('Chrome')], body: ['許可は ', em.danger(em.b('ユーザー')), ' が決める'], note: [em.muted('注')], lines: ['a', {text: ['x ', em.accent('y')], bold: false}]});
  box({step: 1, title: ['a ', em.accent('b')]});
  banner({headline: ['a ', em.accent('b')], sub: ['c ', em.b('d')]});
  caption(['a ', em.b('b')]);
  group([box({title: 'a'})], {title: ['g ', em.danger('!')]});
  stat('76%', ['導入', em.b('前')]);
  swimlane([{id: 'a', label: 'A'}], [{id: 's', lane: 'a', title: ['t ', em.accent('u')], body: [em.b('b')]}]);
  const rt: RichText = ['a', em.b('b')];
  box({body: rt});
  const part: Styled = em.b(em.danger('x'));
  box({body: [part]});

  // ---- a part on its own, or in lines, is not text ----
  // @ts-expect-error a bare part is not rich text (wrap it in an array)
  box({body: em.b('x')});
  // @ts-expect-error a part as a line would become a line of its own: write {text: [...]}
  box({lines: ['a', em.danger('b')]});
  // @ts-expect-error an array as a line is not a line
  box({lines: [['a', em.b('b')]]});
  // @ts-expect-error the parts take a string or another part, not a number
  em.b(1);

  // ---- out of scope: these fields stay plain strings ----
  // @ts-expect-error a tag is a string
  box({title: 'T', tag: [em.b('x')]});
  // @ts-expect-error a stamp is a string
  box({title: 'T', stamp: [em.b('x')]});
  // @ts-expect-error a connect label is a string
  diagram({theme: 'blue'}).connect('a', 'b', {label: [em.b('x')]});
  // @ts-expect-error a lane label is a string
  swimlane([{id: 'a', label: [em.b('A')]}], []);
  // @ts-expect-error a wireframe's text is a string
  wf.text([em.b('x')]);

  // ---- a band holds plain text only ----
  const b: BoxBand = box({title: 'T'});
  const t: string | undefined = b.title;
  const lines: BoxLine[] | undefined = b.lines;
  void t; void lines;
  const bn: BannerBand = banner({headline: 'h'});
  const h: string = bn.headline;
  void h;
  const cp: CaptionBand = caption('c');
  const ct: string = cp.text;
  void ct;
  const gr: GroupBand = group([], {title: 'g'});
  const gt: string | undefined = gr.title;
  void gt;
  const st: SwimlaneStepBand | undefined = undefined as SwimlaneStepBand | undefined;
  const sTitle: string | undefined = st?.title;
  void sTitle;
  // @ts-expect-error a band's title is a string: add() takes a band as it is, so an array would reach layout
  diagram({theme: 'blue'}).add({type: 'box', title: [em.b('x')]});
  // @ts-expect-error the same for a banner
  diagram({theme: 'blue'}).add({type: 'banner', tone: 'accent', headline: [em.b('x')]});
  row([box({title: ['a', em.b('b')]})]);
}
