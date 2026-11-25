import { assertTrustedBandFields, band, DEF_API, EXTERNAL } from './band-def.js';
import { BandError } from './band-error.js';
import { located } from './located.js';
function supportsApi(version) {
    const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\.(?:0|[1-9]\d*)(?:-[\w.-]+)?(?:\+[\w.-]+)?)?$/.exec(version);
    const [major, minor] = DEF_API.split('.').map(Number);
    return !!match && Number(match[1]) === major &&
        (major === 0 ? Number(match[2]) === minor : Number(match[2]) <= (minor ?? 0));
}
function builder(plugin, kind, definition) {
    if (!/^[a-z][a-z0-9-]*$/.test(kind)) {
        throw new BandError(plugin, kind, 'definition', '帯のキーは英小文字で始め、英小文字・数字・ハイフンを使ってください');
    }
    const type = `${plugin}:${kind}`;
    const def = { ...definition, type, [EXTERNAL]: true };
    assertTrustedBandFields(def);
    Object.freeze(def);
    return located((input, { id, scope, reveal, until } = {}) => {
        let data;
        try {
            data = def.build(input);
        }
        catch (cause) {
            const message = cause instanceof Error ? cause.message : String(cause);
            throw new BandError(plugin, kind, 'build', message, { cause });
        }
        if (data === null || typeof data !== 'object' || Array.isArray(data) ||
            ![Object.prototype, null].includes(Object.getPrototypeOf(data))) {
            throw new BandError(plugin, kind, 'build', 'build() はプレーンオブジェクトを返してください');
        }
        const opts = { id, scope, reveal, until };
        for (const field of ['type', ...Object.keys(opts)]) {
            if (Object.hasOwn(data, field)) {
                throw new BandError(plugin, kind, 'build', `build() の戻り値の "${field}" は帯の構築用に予約されています。別の名前を使ってください`);
            }
        }
        const metadata = Object.fromEntries(Object.entries(opts).filter(([, value]) => value !== undefined));
        return band(def, { ...data, type, ...metadata });
    });
}
export function pluginBands(plugin) {
    const { id, apiVersion, bands } = plugin;
    if (!/^[a-z][a-z0-9-]*$/.test(id) || id === 'core' || id === 'svg-diagram') {
        throw new Error(`プラグインの id "${id}" は使えません。英小文字で始め、英小文字・数字・ハイフンを使い、予約名を避けてください`);
    }
    if (!supportsApi(apiVersion)) {
        throw new Error(`${id}: apiVersion "${apiVersion}" はホストの API "${DEF_API}" と互換性がありません。対応する API 版のプラグインを使ってください`);
    }
    return Object.fromEntries(Object.entries(bands).map(([kind, def]) => [kind, builder(id, kind, def)]));
}
