export interface Rect {x: number; y: number; w: number; h: number}
export interface Fonts {sans: string; mono: string}

export const EMU = 9525; // 1px at 96dpi
export const emu = (px: number): number => Math.round(px * EMU);
export const hex = (c: string): string => c.replace('#', '').toUpperCase();

export const xfrm = (r: Rect): string => `<a:xfrm><a:off x="${emu(r.x)}" y="${emu(r.y)}"/><a:ext cx="${emu(r.w)}" cy="${emu(r.h)}"/></a:xfrm>`;
export const solidFill = (color: string): string => `<a:solidFill><a:srgbClr val="${hex(color)}"/></a:solidFill>`;
export const roundRectAdj = (r: Rect): number => Math.min(r.w, r.h) > 0 ? Math.round((8 / Math.min(r.w, r.h)) * 100000) : 0;
