import {assertTrustedBandFields, band, DEF_API, EXTERNAL} from './band-def.ts';
import type {BandValue} from './band-def.ts';
import {BandError} from './band-error.ts';
import {located} from './located.ts';
import type {PluginBandDef, PluginDef} from './plugin.ts';
import type {Declares} from './strict.ts';
import type {RevealOpts, ScopeOpts} from './types/core.ts';

type Options<Id extends string> = {id?: Id} & ScopeOpts & RevealOpts;
type Builders<P extends PluginDef> = {
  [Kind in keyof P['bands'] & string]: <const Id extends string = never>(
    input: Parameters<P['bands'][Kind]['build']>[0], opts?: Options<Id>,
  ) => BandValue<`${P['id']}:${Kind}`> & Declares<Id>;
};

function supportsApi(version: string): boolean {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\.(?:0|[1-9]\d*)(?:-[\w.-]+)?(?:\+[\w.-]+)?)?$/.exec(version);
  const [major, minor] = DEF_API.split('.').map(Number);
  return !!match && Number(match[1]) === major &&
    (major === 0 ? Number(match[2]) === minor : Number(match[2]) <= (minor ?? 0));
}

function builder(plugin: string, kind: string, definition: PluginBandDef) {
  const type = `${plugin}:${kind}` as const;
  const def = {...definition, type, [EXTERNAL]: true as const};
  assertTrustedBandFields(def);
  return located((input: unknown, {id, scope, reveal, until}: Options<string> = {}) => {
    let data: object;
    try {
      data = def.build(input);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      throw new BandError(plugin, kind, 'build', message, {cause});
    }
    const value = {...data, type, id, scope, reveal, until};
    return band(def, value);
  });
}

export function pluginBands<const P extends PluginDef>(plugin: P): Builders<P> {
  const {id, apiVersion, bands} = plugin;
  if (!/^[a-z][a-z0-9-]*$/.test(id) || id === 'core' || id === 'svg-diagram') {
    throw new Error(`プラグインの id "${id}" は使えません。英小文字で始め、英小文字・数字・ハイフンを使い、予約名を避けてください`);
  }
  if (!supportsApi(apiVersion)) {
    throw new Error(`${id}: apiVersion "${apiVersion}" はホストの API "${DEF_API}" と互換性がありません。対応する API 版のプラグインを使ってください`);
  }
  return Object.fromEntries(Object.entries(bands).map(([kind, def]) => [kind, builder(id, kind, def)])) as Builders<P>;
}
