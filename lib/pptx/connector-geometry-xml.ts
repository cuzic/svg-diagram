import type {ConnXfrm} from './geom.ts';

export interface Glue {id: number; idx: number}
export function cxnXfrm(x: Omit<ConnXfrm, 'prst'>, withRot: boolean): string {
  const rot = withRot && x.rot ? ` rot="${x.rot}"` : '';
  return `<a:xfrm${rot}${x.flipH ? ' flipH="1"' : ''}${x.flipV ? ' flipV="1"' : ''}><a:off x="${x.offX}" y="${x.offY}"/><a:ext cx="${x.extX}" cy="${x.extY}"/></a:xfrm>`;
}

export const glueXml = (start?: Glue, end?: Glue): string =>
  `${start ? `<a:stCxn id="${start.id}" idx="${start.idx}"/>` : ''}${end ? `<a:endCxn id="${end.id}" idx="${end.idx}"/>` : ''}`;
