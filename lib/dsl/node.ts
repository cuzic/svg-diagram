import type {IconName} from '../icons.ts';
import type {Declares, HandleOf} from '../strict.ts';
import type {TextTone} from '../types/core.ts';
import type {BoxBand, BoxTone} from '../types/text-bands.ts';
import {box} from './box.ts';

export interface NodeOpts {
  icon: IconName;
  label: string;
  /** a second, muted line under the label (a type, an address) */
  sub?: string;
  /** side of the icon in px (default 48) */
  size?: number;
  /** `true` draws the box around it (default: no box) */
  frame?: boolean;
  tone?: BoxTone;
  iconTone?: TextTone;
  tag?: string;
  tagTone?: import('../types/core.ts').TagTone;
  flex?: number;
  width?: number;
  col?: number;
  span?: number;
}
/**
 * A node: `box({icon, iconAt: 'top', title: label, body: sub, frame})`, centred. Put nodes in row() / grid(), inside group() for a
 * network / VPC / region boundary, and join them with connect() by id.
 */
export function node<const Id extends string = never>(opts: NodeOpts & {id?: Id}): BoxBand & Declares<Id> & HandleOf<Id>;
export function node(opts: NodeOpts & {id?: string}): BoxBand {
  const {label, sub, size, frame, ...rest} = opts;
  if (size !== undefined && !(size >= 16 && size <= 96)) throw new Error(`node(): size must be between 16 and 96 px (got ${size})`);
  return box({...rest, title: label, ...(sub !== undefined ? {body: sub} : {}), iconAt: 'top', ...(size !== undefined ? {iconSize: size} : {}), ...(frame ? {} : {frame: false as const}), align: 'center'} as never) as BoxBand;
}
