// Single-deep AS/RS slot manager (pure logic): nearest free slot from IN, FIFO retrieval.
// Slot = { bay, level, side }; crane travel cost from IN = |bay − inBay| + 1.5 × level.
// `exclude` lists positions that are not storage (e.g. where the IN/OUT conveyors enter the rack).
// `seed`: the prefilled pallets get a shuffled (repeatable) age order, as in a rack that has been running.

export function createAsrs({ bays = 6, levels = 5, sides = 2, prefill = 0, inBay = 0, exclude = [], seed = null } = {}) {
    const skip = new Set(exclude.map((e) => `${e.bay}/${e.level}/${e.side}`));
    const slots = [];
    for (let bay = 0; bay < bays; bay++) for (let level = 0; level < levels; level++) for (let side = 0; side < sides; side++) {
        if (skip.has(`${bay}/${level}/${side}`)) continue;
        slots.push({ bay, level, side, cost: Math.abs(bay - inBay) + 1.5 * level, pallet: null });
    }
    // cheapest first; ties → lower bay, lower level, side 0
    slots.sort((a, b) => a.cost - b.cost || a.bay - b.bay || a.level - b.level || a.side - b.side);
    const fifo = [];   // slots in store order
    const pub = (s) => ({ bay: s.bay, level: s.level, side: s.side });

    function store(palletId) {
        const s = slots.find((x) => x.pallet === null);
        if (!s) return null;
        s.pallet = palletId;
        fifo.push(s);
        return pub(s);
    }

    for (let i = 0; i < Math.floor(slots.length * prefill); i++) store(`S${i}`);
    if (seed !== null) {
        let r = seed >>> 0;
        const rnd = () => ((r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 4294967296);
        for (let i = fifo.length - 1; i > 0; i--) {
            const j = Math.floor(rnd() * (i + 1));
            [fifo[i], fifo[j]] = [fifo[j], fifo[i]];
        }
    }

    return {
        store,
        retrieve() {
            const s = fifo.shift();
            if (!s) return null;
            const palletId = s.pallet;
            s.pallet = null;
            return { palletId, slot: pub(s) };
        },
        fill: () => fifo.length / slots.length,
        capacity: slots.length,
        snapshot: () => fifo.map((s) => ({ ...pub(s), palletId: s.pallet })),
    };
}
