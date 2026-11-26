// The drawing of a chat() band (ADR 0074 D7): the frame, the round faces and names, the bubbles with a small tail, the blanks in their states (the same drawing as comic()),
// and the message box. Text widths for a filled blank come from the supplied value measurements.
import {escapeAttr, escapeXml} from '../emit-common.ts';
import {qualify, scopeOf} from '../scope-name.ts';
import {characterSvg} from '../comic/character.ts';
import {COLOR, FONT, FRAME, HEAD_FROM_BOTTOM, HEAD_R, f1} from '../comic/constants.ts';
import {faceSvg} from '../comic/face.ts';
import {slotSvg} from '../comic/slot-svg.ts';
import {slotValue} from '../comic/slot-values.ts';
import type {ValueTable} from '../comic/slot-values.ts';
import {fillTemplate, parseTemplate} from '../comic/template.ts';
import type {ChatLaidAvatar, ChatLaidBubble, ChatLaidInput, LaidOutChat} from '../types/chat.ts';
import type {WidthOf} from '../types/core.ts';
import {INPUT_FONT, NAME_FONT, TAIL_W} from './constants.ts';
import {bubbleRadius} from './layout.ts';

/** The head's circle, in the head-local frame the face is drawn in (centre at the origin), is the avatar's circle scaled down. */
const HEAD_LOCAL = {cx: 0, cy: 0, r: HEAD_R};

/** A bubble's outline: a rounded rectangle, with a small tail on the outer side of its top corner when it opens a run. */
export function bubblePath(b: Pick<ChatLaidBubble, 'x' | 'y' | 'w' | 'h' | 'tail'>): string {
  const {x, y, w, h} = b, r = bubbleRadius(h), x1 = x + w, y1 = y + h;
  const wedge = 10;
  const left = b.tail === 'left'
    ? `V${f1(y + r + wedge)}L${f1(x - TAIL_W)} ${f1(y + r)}L${x} ${f1(y + r)}`
    : `V${f1(y + r)}`;
  const rightEdge = b.tail === 'right'
    ? `V${f1(y + r)}L${f1(x1 + TAIL_W)} ${f1(y + r)}L${x1} ${f1(y + r + wedge)}`
    : '';
  return `M${f1(x + r)} ${y}H${f1(x1 - r)}A${r} ${r} 0 0 1 ${x1} ${f1(y + r)}${rightEdge}V${f1(y1 - r)}A${r} ${r} 0 0 1 ${f1(x1 - r)} ${y1}H${f1(x + r)}A${r} ${r} 0 0 1 ${x} ${f1(y1 - r)}${left}A${r} ${r} 0 0 1 ${f1(x + r)} ${y}Z`;
}

function avatarSvg(a: ChatLaidAvatar, index: number, characters: LaidOutChat['characters'], namespace: string): string {
  const prefix = `av-${namespace}${index}`, clip = `${prefix}-c`;
  const look = a.look;
  const ch = look.kind === 'asset' ? characters[look.asset] : undefined;
  const inner = ch ? characterSvg(ch, 'neutral', HEAD_LOCAL, `${prefix}-`) : undefined;
  const face = look.kind === 'face' ? look : {hue: 210, hair: 'short' as const};
  const body = inner ?? faceSvg({cx: 0, cy: 0, expression: 'neutral'}, face.hue, face.hair, HEAD_FROM_BOTTOM, prefix);
  // the head's own frame (centre at the origin, radius HEAD_R) is placed by a nested viewBox, not a transform; the circle clips it and the ring is drawn over it
  const {cx, cy, r} = a;
  return `<g data-avatar="${escapeAttr(a.id)}"><clipPath id="${clip}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>`
    + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${COLOR.paper}"/><g clip-path="url(#${clip})"><svg data-avatar-face="" x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" viewBox="${-HEAD_R} ${-HEAD_R} ${2 * HEAD_R} ${2 * HEAD_R}" overflow="hidden">${body}</svg></g>`
    + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${COLOR.ink}" stroke-width="2"/></g>`
    + `<text x="${a.nameX}" y="${a.nameY}" font-size="${NAME_FONT}" fill="${COLOR.prompt}">${escapeXml(a.name)}</text>`;
}

function bubbleSvg(b: ChatLaidBubble, blank: 'prompt' | 'line', node: (id: string) => string, values: ValueTable, widthOf?: WidthOf): string {
  const texts = new Map<string, string>();
  const slots = b.slots.map(s => {
    const value = slotValue(s, values);
    if (value) texts.set(s.id, value.text);
    return slotSvg(s, blank, node(s.id), value, widthOf);
  }).join('');
  const title = b.template && texts.size ? fillTemplate(parseTemplate(b.template), id => texts.get(id) ?? '＿＿') : b.title;
  const narration = b.kind === 'narration';
  const style = b.kind === 'think' || narration ? ' stroke-dasharray="6 3"' : '';
  const outline = `<path d="${bubblePath(b)}" fill="${b.mine ? COLOR.cool : COLOR.bubble}" stroke="${narration ? COLOR.prompt : COLOR.ink}" stroke-width="${b.kind === 'shout' ? 3.5 : narration ? 1.5 : 2}" stroke-linejoin="round"${style}${node(b.id)}/>`;
  return `<g data-bubble="${escapeAttr(b.id)}"><title>${escapeXml(title)}</title>${outline}`
    + b.runs.map(r => `<text x="${r.x}" y="${r.y}" font-size="${FONT}" fill="${COLOR.ink}">${escapeXml(r.text)}</text>`).join('') + slots + '</g>';
}

function inputSvg(i: ChatLaidInput): string {
  const {cx, cy, r} = i.send;
  return `<g data-input="message"><rect x="${i.x}" y="${i.y}" width="${i.w}" height="${i.h}" rx="${i.h / 2}" fill="${COLOR.paper}" stroke="${COLOR.prompt}" stroke-width="2"/>`
    + `<text x="${i.textX}" y="${i.textY}" dominant-baseline="central" font-size="${INPUT_FONT}" fill="${COLOR.prompt}">${escapeXml(i.text)}</text>`
    + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${COLOR.ink}"/><path d="M${f1(cx - 5)} ${f1(cy + 2)}L${cx} ${f1(cy - 4)}L${f1(cx + 5)} ${f1(cy + 2)}" fill="none" stroke="${COLOR.paper}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>`;
}

export function renderChatBand(b: LaidOutChat, values: ValueTable = {}, widthOf?: WidthOf): string {
  const scope = scopeOf(b);
  // A leading hyphen reserves the scoped namespace. Scope names can contain characters that are unsafe in url(#id).
  const namespace = scope ? `-${scope.split('').map(c => c.charCodeAt(0).toString(16)).join('_')}-` : '';
  const node = (id: string) => b.nodeIds ? ` data-node="${escapeAttr(qualify(scope, id))}"` : '';
  const frame = `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="12" fill="${COLOR.paper}" stroke="${COLOR.ink}" stroke-width="${FRAME}"/>`;
  const lines = b.separators.map(s => `<line x1="${s.x1}" y1="${s.y}" x2="${s.x2}" y2="${s.y}" stroke="${COLOR.prompt}" stroke-width="1"/>`).join('');
  return `<g data-chat="screen"><title>${escapeXml(b.title)}</title>${frame}${lines}`
    + b.avatars.map((a, i) => avatarSvg(a, i, b.characters, namespace)).join('')
    + b.bubbles.map(x => bubbleSvg(x, b.blank, node, values, widthOf)).join('')
    + (b.input ? inputSvg(b.input) : '') + '</g>';
}
