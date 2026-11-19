// Single-mast stacker crane for a single-deep pallet AS/RS, fully procedural.
// Local frame: x = along the aisle (travel), y = up, z = across the aisle (forks reach ±z).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { materials } from '../core/materials.js';
import { screenTexture } from '../core/textures.js';
import { mergeStatic } from '../core/merge.js';

const V = { x: 2.5, y: 0.8, z: 0.5 };   // m/s: travel, lift, telescopic forks
const ACC = 1.0;
const LOAD_OFFSET = -0.62;                // m, load centre relative to the mast along x
const ENTER = 0.05;                       // m, forks enter this far below the pallet bottom (into its openings)
const LIFT = 0.12;                        // m, lift off the beams / table before retracting

function mesh(geo, mat, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
}

function beam(group, mat, a, b, t = 0.035) {
    const d = new THREE.Vector3().subVectors(b, a);
    const m = mesh(new THREE.BoxGeometry(t, d.length(), t), mat);
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    group.add(m);
}

/**
 * @param {{height?: number, x0?: number, x1?: number, reach?: number, y0?: number}} opts
 *        x0/x1: festoon ends (anchor at x0); reach: aisle centre → rack position centre; y0: initial carriage height
 */
export function createStackerCrane({ height = 7.9, x0 = -9, x1 = 9, reach = 1.3, y0 = 0.8 } = {}) {
    const M = materials();
    const group = new THREE.Group();
    group.name = 'StackerCrane';

    // ---------- bottom carriage ----------
    group.add(mesh(new RoundedBoxGeometry(2.6, 0.42, 0.62, 2, 0.04), M.lgvYellow, 0, 0.36, 0));
    group.add(mesh(new THREE.BoxGeometry(2.7, 0.06, 0.5), M.steelDark, 0, 0.12, 0));
    for (const s of [-1, 1]) {
        const wheel = new THREE.CylinderGeometry(0.17, 0.17, 0.14, 24).rotateX(Math.PI / 2);
        group.add(mesh(wheel, M.steelWorn, s * 1.05, 0.17, 0));
        group.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 16).rotateX(Math.PI / 2), M.aluminium, s * 1.05, 0.17, 0));
        group.add(mesh(new THREE.BoxGeometry(0.1, 0.22, 0.3), M.rubber, s * 1.36, 0.36, 0));          // buffers
        group.add(mesh(new THREE.BoxGeometry(0.02, 0.12, 0.64), M.hazard, s * 1.31, 0.42, 0));
    }
    // drive motor + gearbox beside the carriage (the lift carriage passes above it at the lowest level)
    group.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.32, 20).rotateZ(Math.PI / 2), M.motor, -0.7, 0.36, 0.43));
    group.add(mesh(new RoundedBoxGeometry(0.26, 0.26, 0.26, 2, 0.03), M.rackBlue, -1.0, 0.36, 0.43));

    // ---------- on-board cabinet ----------
    const cab = new THREE.Group();
    cab.add(mesh(new RoundedBoxGeometry(0.62, 1.35, 0.5, 2, 0.02), M.cabinetGrey, 0, 0.675, 0));
    cab.add(mesh(new THREE.BoxGeometry(0.004, 1.2, 0.004), M.plasticBlack, 0, 0.7, 0.252));
    const scr = screenTexture(256, 128);
    scr.draw({ title: 'SRM-01', state: 'AUTO', battery: 1, line: 'AISLE 1' });
    const display = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.13),
        new THREE.MeshStandardMaterial({ map: scr.texture, emissiveMap: scr.texture, emissive: 0xffffff, emissiveIntensity: 0.9 }));
    display.position.set(0.12, 1.05, 0.253);
    cab.add(display);
    const leds = [M.ledGreen, M.lampOff, M.lampOff].map((m, i) => {
        const l = mesh(new THREE.BoxGeometry(0.05, 0.02, 0.006), m, -0.18, 1.15 - i * 0.05, 0.254);
        cab.add(l);
        return l;
    });
    cab.position.set(0.85, 0.57, 0);
    group.add(cab);

    // ---------- lattice mast ----------
    const mast = new THREE.Group();
    const H = height - 0.6;
    for (const s of [-1, 1]) mast.add(mesh(new THREE.BoxGeometry(0.12, H, 0.16), M.cabinetGrey, s * 0.24, 0.57 + H / 2, 0));
    for (let y = 0.6, k = 0; y < H; y += 0.55, k++) {
        for (const z of [-0.07, 0.07]) {
            const xa = k % 2 ? 0.22 : -0.22;   // zig-zag lattice
            beam(mast, M.steelDark, new THREE.Vector3(xa, 0.57 + y, z), new THREE.Vector3(-xa, 0.57 + y + 0.55, z));
        }
        mast.add(mesh(new THREE.BoxGeometry(0.48, 0.03, 0.03), M.steelDark, 0, 0.57 + y, 0.07));
    }
    // lift guide rails on the mast faces
    for (const s of [-1, 1]) mast.add(mesh(new THREE.BoxGeometry(0.03, H - 0.4, 0.05), M.aluminium, s * 0.33, 0.77 + (H - 0.4) / 2, 0));
    // service ladder (side +x of the mast)
    for (const z of [-0.2, 0.2]) mast.add(mesh(new THREE.BoxGeometry(0.03, H - 1.0, 0.03), M.fenceYellow, 0.42, 1.1 + (H - 1.0) / 2, z));
    for (let y = 1.2; y < H; y += 0.3) mast.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.4, 8).rotateX(Math.PI / 2), M.steelDark, 0.42, y, 0));
    group.add(mast);

    // ---------- head with guide rollers and beacon ----------
    group.add(mesh(new RoundedBoxGeometry(0.9, 0.3, 0.5, 2, 0.03), M.lgvYellow, 0, height - 0.1, 0));
    for (const z of [-0.12, 0.12]) group.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 16), M.rubber, 0, height + 0.1, z));
    const beaconMat = M.beaconDome.clone();
    const beacon = mesh(new THREE.SphereGeometry(0.06, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), beaconMat, 0.3, height + 0.05, 0);
    beacon.castShadow = false;
    group.add(beacon);

    // ---------- lift carriage with 3-stage telescopic forks ----------
    const carriage = new THREE.Group();
    carriage.add(mesh(new RoundedBoxGeometry(1.0, 0.14, 1.3, 2, 0.02), M.lgvYellow, -0.62, 0, 0));
    carriage.add(mesh(new THREE.BoxGeometry(0.12, 0.7, 0.5), M.lgvYellow, -0.06, 0.25, 0));
    for (const z of [-0.66, 0.66]) carriage.add(mesh(new THREE.BoxGeometry(1.0, 0.06, 0.04), M.fenceYellow, -0.62, 0.12, z));
    carriage.add(mesh(new THREE.BoxGeometry(0.06, 0.03, 0.03), M.ledGreen, -0.15, 0.09, 0.66));   // load sensor
    const stages = [];
    for (const fx of [-0.92, -0.32]) {
        for (let k = 0; k < 3; k++) {
            const st = mesh(new THREE.BoxGeometry(0.14 - k * 0.025, 0.05, 1.2), k === 2 ? M.steelWorn : M.steelDark, fx, 0.1 + k * 0.012, 0);
            carriage.add(st);
            stages.push({ mesh: st, k });
        }
    }
    group.add(carriage);
    const forkTip = new THREE.Object3D();   // load anchor (moves with the last fork stage)
    carriage.add(forkTip);

    mergeStatic(group, [cab, carriage, beacon]);
    mergeStatic(cab, [display, ...leds]);
    mergeStatic(carriage, [...stages.map((st) => st.mesh), forkTip]);

    // ---------- festoon cable (world-space, anchored at the aisle start) ----------
    const festoon = new THREE.Group();
    festoon.add(mesh(new THREE.BoxGeometry(x1 - x0, 0.02, 0.02), M.steelDark, (x0 + x1) / 2, height + 0.35, 0.3));
    const loopGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.25, 0, 0), new THREE.Vector3(-0.15, -0.35, 0), new THREE.Vector3(0.15, -0.35, 0), new THREE.Vector3(0.25, 0, 0),
    ]), 16, 0.018, 6);
    const LOOPS = 7;
    const loops = new THREE.InstancedMesh(loopGeo, M.hose, LOOPS);   // one draw call for all cable loops
    loops.frustumCulled = false;
    festoon.add(loops);
    const lo = new THREE.Object3D();

    // ---------- motion ----------
    const pos = { x: 0, y: y0, z: 0 };     // carriage travel, lift height, fork extension (signed)
    const vel = { x: 0, y: 0, z: 0 };
    const queue = [];
    let step = null;
    let load = null;

    function axisTowards(axis, target, dt) {
        const d = target - pos[axis];
        if (Math.abs(d) < 1e-3) { pos[axis] = target; vel[axis] = 0; return true; }
        const vmax = Math.min(V[axis], Math.sqrt(2 * ACC * Math.abs(d)));
        vel[axis] = Math.min(vmax, Math.abs(vel[axis]) + ACC * dt) * Math.sign(d);
        const move = vel[axis] * dt;
        if (Math.abs(move) >= Math.abs(d)) { pos[axis] = target; vel[axis] = 0; return true; }
        pos[axis] += move;
        return false;
    }

    function apply() {
        group.position.x = pos.x;
        carriage.position.y = pos.y;
        for (const { mesh: m, k } of stages) m.position.z = pos.z * (k + 1) / 3;
        forkTip.position.set(LOAD_OFFSET, 0.13, pos.z);
        for (let i = 0; i < LOOPS; i++) {
            lo.position.set(x0 + 0.3 + (pos.x - x0 - 0.6) * (i + 1) / (LOOPS + 1), height + 0.35, 0.3);
            lo.updateMatrix();
            loops.setMatrixAt(i, lo.matrix);
        }
        loops.instanceMatrix.needsUpdate = true;
    }

    /**
     * Queue a pallet move. `from`/`to`: { x (load centre), y (pallet bottom), side } (side ±1 = rack face);
     * `take()` returns the pallet Object3D at `from` (forks already under it), `put(obj)` receives it at `to`
     * once it rests there; `done()` when the forks are back in the aisle.
     */
    function move({ from, to, take, put, done }) {
        queue.push(
            { x: from.x - LOAD_OFFSET, y: from.y - ENTER },
            { z: from.side * reach, call: () => { load = take(); if (load) forkTip.attach(load); } },
            { y: from.y + LIFT },
            { z: 0 },
            { x: to.x - LOAD_OFFSET, y: to.y + LIFT },
            { z: to.side * reach },
            { y: to.y - ENTER, call: () => { if (load) { const l = load; load = null; put(l); } } },
            { z: 0, call: done },
        );
    }

    let blink = 0;
    function update(dt) {
        if (!step && queue.length) step = queue.shift();
        if (step) {
            let ok = true;
            if (step.z !== undefined) ok = axisTowards('z', step.z, dt) && ok;
            else {
                if (step.x !== undefined) ok = axisTowards('x', step.x, dt) && ok;
                if (step.y !== undefined) ok = axisTowards('y', step.y, dt) && ok;
            }
            if (ok) { apply(); step.call?.(); step = null; }   // transforms current before attach/detach
        }
        apply();
        const moving = !!step || queue.length > 0;
        blink += dt;
        beaconMat.emissiveIntensity = moving ? (Math.sin(blink * 8) > 0 ? 3.5 : 0.4) : 0.6;
        leds[0].material = moving ? M.lampOff : M.ledGreen;
        leds[1].material = moving ? M.ledAmber : M.lampOff;
    }

    apply();
    return { group, festoon, update, move, busy: () => !!step || queue.length > 0, position: pos };
}
