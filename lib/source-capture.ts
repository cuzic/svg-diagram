// Opt-in process default for capturing V8 stacks from the DSL.
let enabled = false;

export function captureSourceLocations(on: boolean): void {
  enabled = on;
}

export function sourceCaptureEnabled(): boolean {
  return enabled && typeof Error.captureStackTrace === 'function';
}
