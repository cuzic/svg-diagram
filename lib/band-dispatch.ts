import {defOf} from './band-def.ts';

export type HookName = 'layout' | 'measure' | 'emit' | 'verify' | 'reveal' | 'children';

// biome-ignore lint/complexity/noBannedTypes: The resolver carries heterogeneous hooks without calling them.
type Hook = Function;
type LegacyTables = Partial<Record<HookName, Record<string, Hook>>>;

export interface Dispatch {
  hook(band: {type: string}, name: HookName): Hook;
}

export const coreDispatch: Dispatch = {
  hook(band, name) {
    const def = defOf(band);
    if (!def) throw new Error(`帯の型 "${band.type}" の定義がありません。その帯の入口を import して作ってください`);
    const hook = def[name];
    if (typeof hook !== 'function') throw new Error(`帯の型 "${band.type}" の定義に "${name}" がありません。その帯の定義を確認してください`);
    return hook;
  },
};

export function withLegacyTables(base: Dispatch, tables: LegacyTables): Dispatch {
  const rows: LegacyTables = Object.fromEntries(Object.entries(tables).map(([name, table]) => [name, {...table}]));
  return {
    hook(band, name) {
      const hook = defOf(band)?.[name];
      if (typeof hook === 'function') return hook;
      const table = rows[name];
      const legacy = table && Object.hasOwn(table, band.type) ? table[band.type] : undefined;
      return legacy ?? base.hook(band, name);
    },
  };
}

export function assertNoShadowedRows(migrated: readonly string[], tables: LegacyTables): void {
  for (const [name, table] of Object.entries(tables)) {
    if (!table) continue;
    for (const type of migrated) {
      if (Object.hasOwn(table, type)) throw new Error(`移行済みの帯の型 "${type}" が "${name}" 表に残っています。その行を削除してください`);
    }
  }
}
