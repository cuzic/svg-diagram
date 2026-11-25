import type { BandValue } from './band-def.ts';
import type { PluginDef } from './plugin.ts';
import type { Declares } from './strict.ts';
import type { RevealOpts, ScopeOpts } from './types/core.ts';
type Options<Id extends string> = {
    id?: Id;
} & ScopeOpts & RevealOpts;
type Builders<P extends PluginDef> = {
    [Kind in keyof P['bands'] & string]: <const Id extends string = never>(input: Parameters<P['bands'][Kind]['build']>[0], opts?: Options<Id>) => BandValue<`${P['id']}:${Kind}`> & Declares<Id>;
};
export declare function pluginBands<const P extends PluginDef>(plugin: P): Builders<P>;
export {};
