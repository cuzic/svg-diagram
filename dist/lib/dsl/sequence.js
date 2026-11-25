import { resolveIcon } from '../icon-registry.js';
import { assertBoxTone, revealOf, withHandle } from './shared.js';
export function sequence(actors, steps, opts = {}) {
    for (const a of actors)
        assertBoxTone(a.tone, `sequence() actor "${a.id}"`);
    // an icon is resolved here (the shell) and carried on the actor, so layout and emit stay free of I/O
    if (actors.some(a => a.iconTone !== undefined && a.icon === undefined))
        throw new Error('sequence(): an actor has iconTone but no icon');
    actors = actors.map(a => a.icon === undefined ? a : { ...a, iconGlyph: resolveIcon(a.icon, `sequence() actor "${a.id}" icon`) });
    for (const st of steps)
        if ('note' in st)
            assertBoxTone(st.tone, 'sequence() note');
    return withHandle({ type: 'sequence', actors, steps, numbered: opts.numbered, id: opts.id, ...revealOf(opts) }, opts.id);
}
