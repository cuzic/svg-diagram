/** A slot appears with its latest child and vanishes when all its children have vanished. */
export function rowSlotStages({ id, cols, children }) {
    const slots = new Map();
    if (!id)
        return slots;
    let next = 1;
    for (const child of children) {
        const col = cols ? child.col ?? next : next;
        next = col + (cols ? child.span ?? 1 : 1);
        for (let i = col; i < next; i++) {
            const key = `${id}#${i}`;
            const previous = slots.get(key);
            const end = previous ? Math.max(previous.end ?? Infinity, child.until ?? Infinity) : child.until;
            slots.set(key, { start: Math.max(previous?.start ?? 0, child.reveal ?? 0), end: end === Infinity ? undefined : end });
        }
    }
    return slots;
}
