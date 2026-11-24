import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {renderStatus} from '../emit-status.ts';
import {snapGrid} from '../layout-util.ts';
import {layoutStatus, statusText, statusTexts} from '../status.ts';
import type {LaidOutStatus, StatusBand} from '../types/containers.ts';
import {statusRects} from '../verify-rects.ts';
import type {DiagramStatus} from '../types/core.ts';
import type {Finding} from '../types/verdicts.ts';

/** @internal Shared wording for the diagram-level finding. */
export function draftStatusFinding(status: DiagramStatus): Finding {
  return {rule: 'draft-status', severity: 'info', message: `この図は下書き(status: '${status}')。公開前に外す`};
}

const definition = {
  type: 'status',
  verify: {
    rects: statusRects,
    figureExtent: () => null,
    diagramFindings: ({accept}) => accept?.['draft-status'] ? [] : [draftStatusFinding('draft')],
  },
  textSizes: band => [band.size],
  measure(data, {atoms, roles}) {
    for (const [text, size, weight, font] of statusTexts(data, roles)) atoms(text, size, weight, font);
  },
  layout(data, {x, y, w, widthOf, roles}) {
    const laid = layoutStatus(data, x, snapGrid(y), w, widthOf, roles);
    return {laid, h: laid.h};
  },
  emit: renderStatus,
} satisfies BandDef<StatusBand, LaidOutStatus>;

/** A status strip. Put it first to place the badge above the content. */
export function status(value: DiagramStatus, label?: string): WithBandDef<StatusBand, LaidOutStatus> {
  if (value !== 'draft') throw new Error('status(): status must be "draft"');
  if (label !== undefined && (typeof label !== 'string' || !label.trim() || /[\r\n]/.test(label))) {
    throw new Error('status(): label must be a non-empty single-line string');
  }
  return band<StatusBand, LaidOutStatus>(definition, {type: 'status', status: value, text: statusText({statusLabel: label})});
}
