// Keeps at most one WebGL stage rendering at a time (pure logic, no DOM).
// The latest request wins; when the active stage is released, the most recent other stage that still
// wants to run (requested and not released, e.g. still on screen) starts again.

export function createExclusiveRunner() {
    const stages = new Map();
    const wanting = [];          // ids requested and not released, oldest first
    let active = null;
    return {
        register(id, stage) {
            stages.set(id, stage);
        },
        request(id) {
            const i = wanting.indexOf(id);
            if (i >= 0) wanting.splice(i, 1);
            wanting.push(id);
            if (active === id) return;
            if (active) stages.get(active).stop();
            active = id;
            stages.get(id).start();
        },
        release(id) {
            const i = wanting.indexOf(id);
            if (i >= 0) wanting.splice(i, 1);
            if (active !== id) return;
            stages.get(id).stop();
            active = wanting.length ? wanting[wanting.length - 1] : null;
            if (active) stages.get(active).start();
        },
        active: () => active,
    };
}
