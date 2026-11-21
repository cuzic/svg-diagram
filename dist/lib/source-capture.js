// Opt-in process default for capturing V8 stacks from the DSL.
let enabled = false;
export function captureSourceLocations(on) {
    enabled = on;
}
export function sourceCaptureEnabled() {
    return enabled && typeof Error.captureStackTrace === 'function';
}
