import type { IconName } from '../icons.ts';
import type { RowBand, RowOpts } from '../types/containers.ts';
import type { TextTone } from '../types/core.ts';
import type { BoxTone } from '../types/text-bands.ts';
/** One cell of iconRow(): the icon, the label beside it, and optionally a line of body. */
export interface IconRowItem {
    icon: IconName;
    label: string;
    body?: string;
    tone?: BoxTone;
    iconTone?: TextTone;
}
/** A row of icon + label boxes (each a plain box({icon, title})). The label is required: an icon alone does not say what it means. */
export declare function iconRow(items: IconRowItem[], opts?: RowOpts): RowBand;
