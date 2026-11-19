// Zone-based traffic control: one owner per zone, FIFO queue for waiters (pure logic, no three.js).

export function createTraffic(zoneIds) {
    const zones = new Map(zoneIds.map((z) => [z, { owner: null, queue: [] }]));
    const get = (zone) => {
        const z = zones.get(zone);
        if (!z) throw new Error(`unknown zone ${zone}`);
        return z;
    };
    return {
        tryReserve(zone, lgv) {
            const z = get(zone);
            if (z.owner === lgv) return true;
            if (z.owner === null && (z.queue.length === 0 || z.queue[0] === lgv)) {
                if (z.queue[0] === lgv) z.queue.shift();
                z.owner = lgv;
                return true;
            }
            if (!z.queue.includes(lgv)) z.queue.push(lgv);
            return false;
        },
        release(zone, lgv) {
            const z = get(zone);
            if (z.owner === lgv) z.owner = null;
        },
        owner: (zone) => get(zone).owner,
        queue: (zone) => [...get(zone).queue],
        snapshot: () => Object.fromEntries([...zones].map(([id, z]) => [id, { owner: z.owner, queue: [...z.queue] }])),
    };
}
