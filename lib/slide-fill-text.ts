import type {Role, Roles} from './types/core.ts';
import type {ImageBand} from './types/image.ts';

/** The unscaled size of a role explicitly opted into the extended text range. */
export function fillTextSize(roles: Roles, role?: Role): number {
  return role ? roles[role] : 0;
}

export function imageFillTextSize(data: Pick<ImageBand, 'labelRole' | 'marks' | 'labels'>, roles: Roles): number {
  let size = fillTextSize(roles, data.labelRole);
  for (const mark of data.marks ?? []) size = Math.max(size, fillTextSize(roles, mark.role));
  for (const label of data.labels ?? []) size = Math.max(size, fillTextSize(roles, label.role));
  return size;
}
