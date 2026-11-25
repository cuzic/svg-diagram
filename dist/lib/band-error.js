export class BandError extends Error {
    plugin;
    kind;
    phase;
    constructor(plugin, kind, phase, message, options) {
        super(`${plugin}:${kind}: ${message}`, options);
        this.name = 'BandError';
        this.plugin = plugin;
        this.kind = kind;
        this.phase = phase;
    }
}
