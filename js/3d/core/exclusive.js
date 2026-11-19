// Keeps at most one WebGL stage rendering at a time (pure logic, no DOM).

export function createExclusiveRunner() {
    const stages = new Map();
    let active = null;
    return {
        register(id, stage) {
            stages.set(id, stage);
        },
        request(id) {
            if (active === id) return;
            if (active) stages.get(active).stop();
            active = id;
            stages.get(id).start();
        },
        release(id) {
            if (active !== id) return;
            stages.get(id).stop();
            active = null;
        },
        active: () => active,
    };
}
