// Plant layout (data only, metres, XZ floor plane; +Z = front where the lines and bays are).
// One-way main loop: front edge travels +X, right edge −Z, back edge −X, left edge +Z.
//
//        z = −5   [ASRS IN P/D]            [ASRS OUT P/D]
//        z = −2   BL ◄── Bw ◄── INa ◄── Bk ◄── OUTa ◄────────── BR
//                  │                                             ▲
//                  ▼                                     C1a ── ► charger (x 10.95)
//        z = +2   FL ─► L2a ─► L1a ─► Fm1 ─► Fm2 ─► B1a ─► B2a ─► B3a ─► FR
//        z = +5   [L2 P/D] [L1 P/D in robot cell]  conveyor   [B1] [B2] [B3]

export const PALLET_OFFSET = 1.55;   // LGV origin → load centre on the forks
export const PLANT = { minX: -11.5, maxX: 12.5, minZ: -9.5, maxZ: 8.5 };

export const NODES = [
    { id: 'FL', x: -9.5, z: 2 }, { id: 'L2a', x: -8.5, z: 2 }, { id: 'L1a', x: -6, z: 2 },
    { id: 'Fm1', x: -2, z: 2 }, { id: 'Fm2', x: 1, z: 2 }, { id: 'B1a', x: 3.5, z: 2 },
    { id: 'B2a', x: 6, z: 2 }, { id: 'B3a', x: 8.5, z: 2 }, { id: 'FR', x: 9.5, z: 2 },
    { id: 'C1a', x: 9.5, z: 0 }, { id: 'BR', x: 9.5, z: -2 },
    { id: 'OUTa', x: 3, z: -2 }, { id: 'Bk', x: 0, z: -2 }, { id: 'INa', x: -3, z: -2 },
    { id: 'Bw', x: -6, z: -2 }, { id: 'BL', x: -9.5, z: -2 },
];

export const ZONES = ['F1', 'F2', 'F3', 'F4', 'R', 'K1', 'K2', 'K3', 'L'];

export const EDGES = [
    // front edge (+X)
    { from: 'FL', to: 'L2a', zone: 'F1' }, { from: 'L2a', to: 'L1a', zone: 'F1' },
    { from: 'L1a', to: 'Fm1', zone: 'F2' }, { from: 'Fm1', to: 'Fm2', zone: 'F2' },
    { from: 'Fm2', to: 'B1a', zone: 'F3' }, { from: 'B1a', to: 'B2a', zone: 'F3' },
    { from: 'B2a', to: 'B3a', zone: 'F4' }, { from: 'B3a', to: 'FR', zone: 'F4' },
    // right edge (−Z)
    { from: 'FR', to: 'C1a', zone: 'R' }, { from: 'C1a', to: 'BR', zone: 'R' },
    // back edge (−X)
    { from: 'BR', to: 'OUTa', zone: 'K1' }, { from: 'OUTa', to: 'Bk', zone: 'K1' },
    { from: 'Bk', to: 'INa', zone: 'K2' }, { from: 'INa', to: 'Bw', zone: 'K2' },
    { from: 'Bw', to: 'BL', zone: 'K3' },
    // left edge (+Z)
    { from: 'BL', to: 'FL', zone: 'L' },
];

// heading: rotation.y that makes the LGV's +Z (forks) point from the approach node to the dock
const station = (node, dx, dz) => {
    const n = NODES.find((m) => m.id === node);
    return { node, dock: { x: n.x + dx, z: n.z + dz }, heading: Math.atan2(dx, dz) };
};

export const STATIONS = {
    L2: station('L2a', 0, 1.45),
    L1: station('L1a', 0, 1.45),
    B1: station('B1a', 0, 1.45),
    B2: station('B2a', 0, 1.45),
    B3: station('B3a', 0, 1.45),
    ASRS_IN: station('INa', 0, -1.45),
    ASRS_OUT: station('OUTa', 0, -1.45),
    C1: station('C1a', 1.45, 0),
};

/** Load centre for a station (where the pallet sits). */
export function palletSpot(s) {
    return { x: s.dock.x + Math.sin(s.heading) * PALLET_OFFSET, z: s.dock.z + Math.cos(s.heading) * PALLET_OFFSET };
}
