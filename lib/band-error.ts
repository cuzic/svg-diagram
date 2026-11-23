export class BandError extends Error {
  readonly plugin: string;
  readonly kind: string;
  readonly phase: 'definition' | 'build';

  constructor(plugin: string, kind: string, phase: BandError['phase'], message: string, options?: ErrorOptions) {
    super(`${plugin}:${kind}: ${message}`, options);
    this.name = 'BandError';
    this.plugin = plugin;
    this.kind = kind;
    this.phase = phase;
  }
}
