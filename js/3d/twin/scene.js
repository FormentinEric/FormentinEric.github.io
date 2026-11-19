// Digital twin plant: environment, floor markings from the path graph, zone tiles, robot cell (L1),
// wrapped-pallet line (L2), AS/RS (racks, stacker crane, IN/OUT conveyors with lift tables), shipping bays,
// charger, parking, LGV models driven by fleet snapshots and the pallet flow driven by fleet pick/drop events.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { materials } from '../core/materials.js';
import { concreteMaps, floorTextTexture, hazardTexture, cartonTexture } from '../core/textures.js';
import { mergeStatic } from '../core/merge.js';
import { nextTask } from '../core/yield.js';
import { createLGV } from '../models/lgv.js';
import { createPalletizingCell } from '../models/cell.js';
import { createWrapper } from '../models/wrapper.js';
import { createCharger } from '../models/charger.js';
import { createLoadedPallet, createPallet, createCarton, PALLET_HEIGHT, CARTON } from '../models/props.js';
import { createStackerCrane } from '../models/stackerCrane.js';
import { NODES, EDGES, STATIONS, ZONES, palletSpot } from './layout.js';
import { createAsrs } from './asrs.js';

const L2_PERIOD = 40;     // s between wrapped pallets on line 2
const OUT_PERIOD = 32;    // s between AS/RS retrievals at 50 % fill (shorter when fuller, longer when emptier)
const TRUCK_PERIOD = 75;  // s between truck departures (or earlier if a bay is full)
const PIT_SPEED = 0.35;   // m/s pallet conveyors
const ZONE_COLORS = { owned: 0x22d3ee, queued: 0xff4d4d };

// AS/RS: 14 single-pallet bays × 5 beam levels on both sides of one stacker-crane aisle
const RACK = { x0: -8.4, pitch: 1.2, bays: 14, levels: [0.75, 2.15, 3.55, 4.95, 6.35], height: 7.8, depth: 1.0, front: -6.2, back: -8.8 };
const RACK_X1 = RACK.x0 + RACK.bays * RACK.pitch;
const AISLE_Z = (RACK.front - RACK.depth + RACK.back) / 2;                       // -8.0
const SLOT_Z = [RACK.front - RACK.depth / 2, RACK.back - RACK.depth / 2];        // side 0 (loop side), side 1
const SLOT_Y0 = RACK.levels[0] + 0.06;     // pallet bottom on the first beam level = lift-table top position
const CRANE_HEIGHT = 7.64;                 // guide rollers straddle the top rail hung under the rack ties
const TABLE_SPEED = 0.3;                   // m/s lift tables
const PALLET_GAP = 1.35;                   // m between queued pallets on a conveyor
const WRAP_SECONDS = 12;
const NAV_Y = 2.68;                        // height of the LGV laser scanner = reflector height
// building columns carrying cylindrical reflectors for the LGV laser navigation
const COLUMNS = [[-13.2, -5.5], [-13.2, 5.5], [12.3, -5.5], [12.3, 5.2], [-1.6, 9.5], [11.2, 9.5]];
// reflector strips on rack uprights facing the loop (x of the upright)
const RACK_REFLECTORS = [-7.2, -1.2, 6.0];
const slotKey = (s) => `${s.bay}/${s.level}/${s.side}`;
const slotPos = (s) => ({ x: RACK.x0 + (s.bay + 0.5) * RACK.pitch, y: RACK.levels[s.level] + 0.06, z: SLOT_Z[s.side] });
const slotName = (s) => `${s.side ? 'B' : 'A'}${String(s.bay + 1).padStart(2, '0')}-${s.level + 1}`;

function mesh(geo, mat, x = 0, y = 0, z = 0, cast = true) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = cast;
    m.receiveShadow = true;
    return m;
}

/** Flat strip on the floor from (x0,z0) to (x1,z1). */
function strip(x0, z0, x1, z1, width, mat, y = 0.003) {
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
    const m = mesh(new THREE.PlaneGeometry(len, width).rotateX(-Math.PI / 2), mat, (x0 + x1) / 2, y, (z0 + z1) / 2, false);
    m.rotation.y = Math.atan2(-dz, dx);
    return m;
}

function arrowGeometry() {
    const s = new THREE.Shape();
    s.moveTo(-0.35, -0.06); s.lineTo(0.05, -0.06); s.lineTo(0.05, -0.18); s.lineTo(0.35, 0);
    s.lineTo(0.05, 0.18); s.lineTo(0.05, 0.06); s.lineTo(-0.35, 0.06);
    return new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2);
}

function label(text, x, z, rotY, M, size = 0.9) {
    const mat = new THREE.MeshStandardMaterial({ map: floorTextTexture(text), transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1 });
    const m = mesh(new THREE.PlaneGeometry(size * 4, size).rotateX(-Math.PI / 2), mat, x, 0.004, z, false);
    m.rotation.y = rotY;
    return m;
}

function rectOutline(cx, cz, w, d, rotY, mat) {
    const g = new THREE.Group();
    g.add(strip(-w / 2, -d / 2, w / 2, -d / 2, 0.06, mat), strip(-w / 2, d / 2, w / 2, d / 2, 0.06, mat));
    g.add(strip(-w / 2, -d / 2, -w / 2, d / 2, 0.06, mat), strip(w / 2, -d / 2, w / 2, d / 2, 0.06, mat));
    g.position.set(cx, 0, cz);
    g.rotation.y = rotY;
    return g;
}

/** Floor-level roller bed (pit conveyor) from z0 to z1 at x. */
function pitConveyor(M, x, z0, z1) {
    const g = new THREE.Group();
    const len = Math.abs(z1 - z0), cz = (z0 + z1) / 2;
    g.add(mesh(new THREE.BoxGeometry(1.1, 0.02, len), M.steelWorn, x, 0.005, cz, false));
    for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.06, 0.05, len), M.fenceYellow, x + s * 0.58, 0.025, cz));
    const rollerGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.0, 12).rotateZ(Math.PI / 2);
    for (let z = Math.min(z0, z1) + 0.1; z < Math.max(z0, z1); z += 0.16) g.add(mesh(rollerGeo, M.aluminium, x, 0.03, z, false));
    return g;
}

/**
 * Tiny parts (bolts, LEDs, labels) and glowing parts do not cast shadows: invisible in the shadow map,
 * but each one costs a draw call in the shadow pass.
 */
function trimShadowCasters(root, minRadius = 0.1) {
    const s = new THREE.Vector3();
    root.updateMatrixWorld(true);
    root.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh || !o.castShadow) return;
        const m = o.material;
        if (m.emissive && m.emissive.getHex() !== 0 && m.emissiveIntensity > 0) { o.castShadow = false; return; }
        if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
        o.getWorldScale(s);
        if (o.geometry.boundingSphere.radius * Math.max(s.x, s.y, s.z) < minRadius) o.castShadow = false;
    });
}

/** One rack row (both frames of its depth). `skip`: 'bay/level' beam pairs left out (conveyor transfer positions). */
function rackBlock(M, zFront, skip = new Set()) {
    const { x0, pitch, bays, levels, height, depth } = RACK;
    const g = new THREE.Group();
    const postGeo = new THREE.BoxGeometry(0.09, height, 0.07);
    const braceGeo = new THREE.BoxGeometry(0.03, 1.15, 0.03);
    const plateGeo = new THREE.BoxGeometry(0.16, 0.012, 0.14);
    for (let k = 0; k <= bays; k++) {
        const x = x0 + k * pitch;
        for (const dz of [0, -depth]) {
            g.add(mesh(postGeo, M.rackBlue, x, height / 2, zFront + dz));
            g.add(mesh(plateGeo, M.steelDark, x, 0.006, zFront + dz, false));
        }
        for (let j = 0; j < Math.floor(height / 1.05); j++) {
            const b = mesh(braceGeo, M.rackBlue, x, 0.6 + j * 1.05, zFront - depth / 2);
            b.rotation.x = j % 2 ? 0.95 : -0.95;
            g.add(b);
        }
    }
    const beamGeo = new THREE.BoxGeometry(pitch - 0.09, 0.12, 0.05);
    for (let b = 0; b < bays; b++) for (let l = 0; l < levels.length; l++) {
        if (skip.has(`${b}/${l}`)) continue;
        for (const dz of [0, -depth]) g.add(mesh(beamGeo, M.rackOrange, x0 + (b + 0.5) * pitch, levels[l], zFront + dz));
    }
    return g;
}

/** Floor rail with end buffers, top guide rail hung under ties across the rack tops, end portal. */
function craneRails(M) {
    const g = new THREE.Group();
    const bx0 = RACK.x0 - 0.6, bx1 = RACK_X1 + 1.8;   // end buffers clear the crane's own buffers at the last bay
    g.add(mesh(new THREE.BoxGeometry(bx1 - bx0, 0.02, 0.34), M.steelDark, (bx0 + bx1) / 2, 0.01, AISLE_Z, false));
    g.add(mesh(new THREE.BoxGeometry(bx1 - bx0, 0.09, 0.07), M.steelWorn, (bx0 + bx1) / 2, 0.065, AISLE_Z));
    for (const x of [bx0 + 0.15, bx1 - 0.15]) g.add(mesh(new THREE.BoxGeometry(0.3, 0.4, 0.5), M.hazard, x, 0.2, AISLE_Z));
    const tx1 = RACK_X1 + 0.5;
    const span = (RACK.front - RACK.depth) - RACK.back + 0.14;
    const topY = RACK.height + 0.04;
    for (let x = RACK.x0; x <= RACK_X1 + 1e-6; x += 2 * RACK.pitch) g.add(mesh(new THREE.BoxGeometry(0.08, 0.08, span), M.steelDark, x, topY, AISLE_Z));
    g.add(mesh(new THREE.BoxGeometry(tx1 - RACK.x0, 0.12, 0.08), M.steelDark, (RACK.x0 + tx1) / 2, topY - 0.1, AISLE_Z));
    // end portal carrying the rail past the last rack frame
    for (const dz of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.12, topY, 0.12), M.rackBlue, tx1, topY / 2, AISLE_Z + dz * (span / 2 - 0.06)));
    g.add(mesh(new THREE.BoxGeometry(0.12, 0.08, span), M.steelDark, tx1, topY, AISLE_Z));
    return g;
}

/** Scissor lift table in a pit at a conveyor end; `load` (if any) rides on its top. */
function createLiftTable(M, x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.add(mesh(new THREE.BoxGeometry(1.22, 0.02, 1.34), M.steelDark, 0, 0.004, 0, false));
    for (const s of [-1, 1]) group.add(mesh(new THREE.BoxGeometry(0.05, 0.05, 1.34), M.fenceYellow, s * 0.64, 0.025, 0));
    const top = new THREE.Group();
    top.add(mesh(new THREE.BoxGeometry(1.08, 0.05, 1.24), M.lgvYellow, 0, -0.045, 0));
    const roller = new THREE.CylinderGeometry(0.025, 0.025, 1.0, 10).rotateZ(Math.PI / 2);
    for (let k = -3; k <= 3; k++) top.add(mesh(roller, M.aluminium, 0, -0.025, k * 0.17, false));
    for (const s of [-1, 1]) top.add(mesh(new THREE.BoxGeometry(0.04, 0.07, 1.24), M.steelDark, s * 0.56, -0.02, 0));
    mergeStatic(top);
    group.add(top);
    const armGeo = new THREE.BoxGeometry(0.05, 0.04, 1.1);
    const arms = [];
    for (const ax of [-0.42, 0.42]) for (const sgn of [-1, 1]) {
        const a = mesh(armGeo, M.steelDark, ax, 0.03, 0);
        group.add(a);
        arms.push({ m: a, sgn });
    }
    const t = { group, h: 0, target: 0, load: null };
    t.update = (dt) => {
        const d = t.target - t.h;
        t.h += Math.sign(d) * Math.min(Math.abs(d), TABLE_SPEED * dt);
        top.position.y = t.h;
        const lift = Math.max(0, t.h - 0.05);
        const th = Math.asin(Math.min(1, lift / 1.1));
        for (const { m, sgn } of arms) { m.position.y = 0.03 + lift / 2; m.rotation.x = sgn * th; }
        if (t.load) t.load.position.y = t.h;
    };
    t.at = (y) => t.target === y && Math.abs(t.h - y) < 1e-3;
    return t;
}

/** 2 × 3 cartons × 3 layers as one box, the carton texture tiled once per carton face. */
function cartonBlockGeometry() {
    const g = new THREE.BoxGeometry(2 * CARTON.w, 3 * CARTON.h, 3 * CARTON.d);
    const uv = g.attributes.uv;
    const rep = [[3, 3], [3, 3], [2, 3], [2, 3], [2, 3], [2, 3]];   // faces +x −x +y −y +z −z: cartons along (u, v)
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) uv.setXY(f * 4 + k, uv.getX(f * 4 + k) * rep[f][0], uv.getY(f * 4 + k) * rep[f][1]);
    return g;
}

/**
 * @param {{lgvIds: string[], onPalletReady: Function, onPalletAtOut: Function, onLog: Function,
 *          onStationBlocked?: (station: string, blocked: boolean) => void}} opts
 *        onStationBlocked: a P/D cannot take a pallet now (e.g. the IN conveyor is backed up to it)
 */
export async function buildPlant(stage, { lgvIds, onPalletReady, onPalletAtOut, onLog, onStationBlocked = () => {} }) {
    const { scene, renderer } = stage;
    const M = materials();
    await nextTask();

    // ---------- environment & lights ----------
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    await nextTask();
    scene.environmentIntensity = 0.42;
    scene.background = new THREE.Color(0x0a0f18);
    scene.fog = new THREE.Fog(0x0a0f18, 30, 75);
    const { map, roughnessMap } = concreteMaps(16);
    const floor = mesh(new THREE.PlaneGeometry(64, 52).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map, roughnessMap, roughness: 0.9, envMapIntensity: 0.6 }), 0, 0, 0, false);
    floor.name = 'Floor';
    scene.add(floor);
    scene.add(new THREE.HemisphereLight(0xb9c8ff, 0x1a1e26, 0.45));
    const key = new THREE.DirectionalLight(0xfff1e0, 2.1);
    key.position.set(9, 16, -5);
    key.castShadow = true;
    Object.assign(key.shadow.camera, { left: -17, right: 17, top: 14, bottom: -14, near: 1, far: 50 });
    key.shadow.bias = -0.0003;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 3;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x9cc8ff, 0.75);
    rim.position.set(-8, 7, 12);
    scene.add(rim);
    for (const [x, z] of [[-6, 0], [6, 0], [-6, -7], [6, -7]]) {
        const p = new THREE.PointLight(0xfff0dc, 3, 16, 1.6);
        p.position.set(x, 9, z);
        scene.add(p);
    }

    const statics = new THREE.Group();
    scene.add(statics);
    await nextTask();

    // ---------- markings from the graph ----------
    const yellow = new THREE.MeshStandardMaterial({ color: 0xf2b20f, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -1 });
    const white = new THREE.MeshStandardMaterial({ color: 0xaeb6bf, roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -1 });
    const node = (id) => NODES.find((n) => n.id === id);
    const arrow = arrowGeometry();
    for (const e of EDGES) {
        const a = node(e.from), b = node(e.to);
        const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
        const nx = -dz / len * 0.85, nz = dx / len * 0.85;
        statics.add(strip(a.x + nx, a.z + nz, b.x + nx, b.z + nz, 0.07, yellow), strip(a.x - nx, a.z - nz, b.x - nx, b.z - nz, 0.07, yellow));
        for (let s = 1.2; s < len - 0.6; s += 3) {
            const m = mesh(arrow, white, a.x + dx / len * s, 0.004, a.z + dz / len * s, false);
            m.rotation.y = Math.atan2(-dz, dx);
            statics.add(m);
        }
    }
    for (const [name, st] of Object.entries(STATIONS)) {
        const p = palletSpot(st);
        statics.add(rectOutline(p.x, p.z, 1.0, 1.4, st.heading, white));
        const lx = st.dock.x - Math.sin(st.heading) * 0.2, lz = st.dock.z - Math.cos(st.heading) * 0.2;
        statics.add(label(name.replace('ASRS_', ''), lx + Math.cos(st.heading) * 1.0, lz - Math.sin(st.heading) * 1.0, st.heading + Math.PI, M, 0.5));
    }

    await nextTask();
    // ---------- zone tiles (coloured by the traffic manager) ----------
    const zoneTiles = new Map();
    for (const z of ZONES) {
        const mat = new THREE.MeshBasicMaterial({ color: ZONE_COLORS.owned, transparent: true, opacity: 0.1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
        const g = new THREE.Group();
        for (const e of EDGES.filter((ed) => ed.zone === z)) {
            const a = node(e.from), b = node(e.to);
            g.add(strip(a.x, a.z, b.x, b.z, 1.6, mat, 0.005));
        }
        g.visible = false;
        scene.add(g);
        zoneTiles.set(z, { group: g, mat });
    }

    await nextTask();
    // ---------- line 1: robot palletizing cell (rotated so its light curtain faces the loop) ----------
    const stationPallets = { L1: null, L2: null, ASRS_OUT: null };
    const cell = await createPalletizingCell({
        initialCount: 14,
        onPalletReady: () => { stationPallets.L1 = 'cell'; onPalletReady('L1'); },
    });
    cell.group.position.set(-4.45, 0, 6.05);
    cell.group.rotation.y = Math.PI;
    scene.add(cell.group);

    await nextTask();
    // ---------- line 2: wrapped pallets on a pit conveyor ----------
    const L2 = palletSpot(STATIONS.L2);
    statics.add(pitConveyor(M, L2.x, L2.z - 0.6, L2.z + 5.0));
    const hatch = new THREE.MeshStandardMaterial({ map: hazardTexture(3, 1), roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1 });
    statics.add(strip(L2.x - 0.8, L2.z + 1.1, L2.x + 0.8, L2.z + 1.1, 0.3, hatch));
    // stretch wrapper over the conveyor: pallets arrive bare, leave wrapped
    const WRAP_Z = L2.z + 2.7;
    const wrapper = createWrapper();
    wrapper.group.position.set(L2.x, 0, WRAP_Z);
    wrapper.group.rotation.y = Math.PI;          // control panel on the outer side, away from the robot cell
    scene.add(wrapper.group);
    let l2Timer = 6, l2Moving = null, l2Phase = null, l2Hold = false;

    await nextTask();
    // ---------- AS/RS: rack rows, crane aisle, IN/OUT conveyors ending on lift tables ----------
    const IN = palletSpot(STATIONS.ASRS_IN), OUT = palletSpot(STATIONS.ASRS_OUT);
    const bayOf = (x) => Math.round((x - RACK.x0) / RACK.pitch - 0.5);
    const inBay = bayOf(IN.x), outBay = bayOf(OUT.x);
    const exclude = [{ bay: inBay, level: 0, side: 0 }, { bay: outBay, level: 0, side: 0 }];
    const asrs = createAsrs({ bays: RACK.bays, levels: RACK.levels.length, sides: 2, prefill: 0.55, inBay, exclude, seed: 11 });
    statics.add(rackBlock(M, RACK.front, new Set(exclude.map((e) => `${e.bay}/${e.level}`))), rackBlock(M, RACK.back), craneRails(M));
    const TRANSFER_Z = SLOT_Z[0];
    statics.add(pitConveyor(M, IN.x, IN.z + 0.6, TRANSFER_Z + 0.68), pitConveyor(M, OUT.x, OUT.z + 0.6, TRANSFER_Z + 0.68));
    const inTable = createLiftTable(M, IN.x, TRANSFER_Z);
    const outTable = createLiftTable(M, OUT.x, TRANSFER_Z);
    outTable.h = outTable.target = SLOT_Y0;          // the OUT table waits up, empty, for the crane
    scene.add(inTable.group, outTable.group);
    const crane = createStackerCrane({ height: CRANE_HEIGHT, x0: RACK.x0 - 0.5, x1: RACK_X1 + 0.5, reach: SLOT_Z[0] - AISLE_Z, y0: SLOT_Y0 });
    crane.group.position.z = AISLE_Z;
    crane.festoon.position.z = AISLE_Z;
    scene.add(crane.group, crane.festoon);

    await nextTask();
    // stored pallets: one instance per slot (zero scale when empty), plain or stretch-wrapped carton blocks
    const slotIdx = new Map();
    const skipSlots = new Set(exclude.map(slotKey));
    for (let bay = 0; bay < RACK.bays; bay++) for (let level = 0; level < RACK.levels.length; level++) for (let side = 0; side < 2; side++) {
        const k = slotKey({ bay, level, side });
        if (!skipSlots.has(k)) slotIdx.set(k, slotIdx.size);
    }
    const cartonMap = cartonTexture(21, '#b98a5b');
    cartonMap.wrapS = cartonMap.wrapT = THREE.RepeatWrapping;
    const blockGeo = cartonBlockGeometry();
    const palletIM = new THREE.InstancedMesh(createPallet().geometry, M.wood, slotIdx.size);
    const bareIM = new THREE.InstancedMesh(blockGeo, new THREE.MeshStandardMaterial({ map: cartonMap, roughness: 0.8 }), slotIdx.size);
    const wrapIM = new THREE.InstancedMesh(blockGeo, new THREE.MeshPhysicalMaterial({ map: cartonMap, color: 0xe4ebf3, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.12 }), slotIdx.size);
    for (const im of [palletIM, bareIM, wrapIM]) { im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; scene.add(im); }
    const o = new THREE.Object3D();
    /** wrap: true / false = a stored pallet (wrapped or not), null = empty slot */
    function setSlot(slot, wrap) {
        const i = slotIdx.get(slotKey(slot));
        const p = slotPos(slot);
        const put = (im, on, y) => {
            o.position.set(p.x, y, p.z);
            o.scale.setScalar(on ? 1 : 0);
            o.updateMatrix();
            im.setMatrixAt(i, o.matrix);
            im.instanceMatrix.needsUpdate = true;
        };
        put(palletIM, wrap !== null, p.y);
        put(bareIM, wrap === false, p.y + PALLET_HEIGHT + 1.5 * CARTON.h);
        put(wrapIM, wrap === true, p.y + PALLET_HEIGHT + 1.5 * CARTON.h);
    }
    for (const k of slotIdx.keys()) { const [bay, level, side] = k.split('/').map(Number); setSlot({ bay, level, side }, null); }
    const wraps = new Map();      // pallet id → stretch-wrapped
    asrs.snapshot().forEach((s, i) => { const w = (i * 7) % 5 > 1; wraps.set(s.palletId, w); setSlot(s, w); });
    const stock = () => Math.round(asrs.fill() * asrs.capacity);
    const inbound = [];           // pallets on the IN conveyor, oldest first
    let inBlocked = false, nextPalletId = 1001;
    let outTimer = 8, outMoving = null;

    await nextTask();
    // ---------- shipping bays + dock wall with trailer ----------
    const bayNames = ['B1', 'B2', 'B3'];
    const bays = Object.fromEntries(bayNames.map((b) => [b, []]));
    const BAY_SLOTS = [7.6, 6.3, 5.0];
    for (const b of bayNames) {
        const p = palletSpot(STATIONS[b]);
        statics.add(rectOutline(p.x, 6.3, 1.1, 4.0, 0, yellow));
    }
    // dock doors: low frames + dock levellers, so the camera can see over them
    const leveller = new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.6, metalness: 0.4 });
    for (const b of bayNames) {
        const p = palletSpot(STATIONS[b]);
        statics.add(mesh(new THREE.BoxGeometry(2.0, 0.04, 1.2), leveller, p.x, 0.02, 8.6, false));
        statics.add(strip(p.x - 1.0, 8.0, p.x + 1.0, 8.0, 0.25, hatch));
        for (const s of [-1, 1]) {
            statics.add(mesh(new THREE.BoxGeometry(0.14, 1.2, 0.14), M.fenceYellow, p.x + s * 1.1, 0.6, 8.6));
            statics.add(mesh(new THREE.BoxGeometry(0.18, 0.12, 0.18), M.plasticBlack, p.x + s * 1.1, 1.26, 8.6));
        }
    }
    let truckTimer = TRUCK_PERIOD;

    // ---------- charger and parking ----------
    const c1 = STATIONS.C1;
    const charger = createCharger();
    charger.group.position.set(c1.dock.x - 0.05, 0, c1.dock.z - 0.1);
    scene.add(charger.group);

    // ---------- building columns and laser reflectors ----------
    const columnPaint = new THREE.MeshStandardMaterial({ color: 0x8a939e, roughness: 0.6, metalness: 0.35 });
    const reflectorMat = new THREE.MeshStandardMaterial({ color: 0xf4f7fb, emissive: 0x9fb4c8, emissiveIntensity: 0.35, roughness: 0.15 });
    const reflectors = [];          // { c: centre (world), r: radius of the reflecting surface }
    for (const [x, z] of COLUMNS) {
        const H = 9.5;
        for (const dx of [-0.14, 0.14]) statics.add(mesh(new THREE.BoxGeometry(0.02, H, 0.3), columnPaint, x + dx, H / 2, z));   // flanges
        statics.add(mesh(new THREE.BoxGeometry(0.26, H, 0.02), columnPaint, x, H / 2, z));                                     // web
        statics.add(mesh(new THREE.BoxGeometry(0.5, 0.025, 0.5), M.steelDark, x, 0.012, z, false));
        statics.add(mesh(new THREE.BoxGeometry(0.34, 1.2, 0.34), M.hazard, x, 0.6, z));                                          // impact guard
        statics.add(mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.45, 24, 1, true), reflectorMat, x, NAV_Y, z, false));
        reflectors.push({ c: new THREE.Vector3(x, NAV_Y, z), r: 0.24 });
    }
    for (const x of RACK_REFLECTORS) {
        statics.add(mesh(new THREE.BoxGeometry(0.09, 0.45, 0.012), reflectorMat, x, NAV_Y, RACK.front + 0.045, false));
        reflectors.push({ c: new THREE.Vector3(x, NAV_Y, RACK.front + 0.05), r: 0 });
    }

    await nextTask();
    mergeStatic(statics);

    // ---------- LGVs ----------
    const lgvs = new Map();
    for (const id of lgvIds) {
        await nextTask();
        const m = createLGV({ id });
        m.state.loaded = false;
        scene.add(m.group);
        lgvs.set(id, m);
    }
    const carried = {};

    // loads are clones of 6 cached templates: clones share geometry and materials (no memory growth)
    const loadTemplates = new Map();
    function newLoad(wrap, x, z, heading) {
        const variant = Math.floor(Math.random() * 3);
        const key = `${wrap ? 'w' : 'n'}${variant}`;
        if (!loadTemplates.has(key)) loadTemplates.set(key, createLoadedPallet({ cols: 2, rows: 3, layers: 3, wrap, seed: variant * 3 }));
        const g = loadTemplates.get(key).clone();
        g.position.set(x, 0, z);
        g.rotation.y = heading;
        g.userData.wrap = wrap;
        scene.add(g);
        return g;
    }

    const obstacles = new Map();     // lgv id → carton lying in its protective field during an alarm

    // ---------- pallet flow on fleet events ----------
    function handle(e) {
        if (e.type === 'pick') {
            let wrap = true;
            if (e.station === 'L1') { cell.takePallet(); wrap = false; }
            else if (stationPallets[e.station] && stationPallets[e.station] !== 'cell') {
                wrap = stationPallets[e.station].userData.wrap;
                scene.remove(stationPallets[e.station]);
            }
            stationPallets[e.station] = null;
            carried[e.lgv] = wrap;
            lgvs.get(e.lgv)?.setFilm(wrap);
        } else if (e.type === 'alarm') {
            // the obstacle: a fallen carton in the protective field, removed when the alarm clears
            const m = lgvs.get(e.lgv);
            if (!m) return;
            if (e.active) {
                let ob = obstacles.get(e.lgv);
                if (!ob) { ob = createCarton(7); ob.rotation.set(0.25, 0.6, 0.1); obstacles.set(e.lgv, ob); }
                const h = m.group.rotation.y;
                ob.position.set(m.group.position.x + Math.sin(h) * 2.7, CARTON.h / 2 - 0.02, m.group.position.z + Math.cos(h) * 2.7);
                scene.add(ob);
            } else obstacles.get(e.lgv)?.removeFromParent();
        } else if (e.type === 'drop') {
            const st = STATIONS[e.station];
            const p = palletSpot(st);
            const g = newLoad(carried[e.lgv] ?? true, p.x, p.z, st.heading);
            delete carried[e.lgv];
            if (e.station === 'ASRS_IN') { g.userData.id = `P${nextPalletId++}`; inbound.push(g); }
            else if (bays[e.station]) bays[e.station].push({ g, target: BAY_SLOTS[bays[e.station].length] ?? 5.0 });
        }
    }

    // ---------- laser reflectors in line of sight ----------
    let rayLgv = null, rayTimer = 0;
    const RACK_BOX = { x0: RACK.x0 - 0.05, x1: RACK_X1 + 0.05, z0: RACK.back - RACK.depth - 0.05, z1: RACK.front - 0.1 };
    function blockedByRacks(ax, az, bx, bz) {
        // segment vs the rack footprint (slab test in XZ; racks are taller than the scanner)
        let t0 = 0, t1 = 1;
        for (const [a, d, lo, hi] of [[ax, bx - ax, RACK_BOX.x0, RACK_BOX.x1], [az, bz - az, RACK_BOX.z0, RACK_BOX.z1]]) {
            if (Math.abs(d) < 1e-9) { if (a < lo || a > hi) return false; continue; }
            let u = (lo - a) / d, v = (hi - a) / d;
            if (u > v) [u, v] = [v, u];
            t0 = Math.max(t0, u); t1 = Math.min(t1, v);
            if (t0 > t1) return false;
        }
        return true;
    }
    function visibleReflectors(p) {
        const out = [];
        for (const { c, r } of reflectors) {
            const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz);
            if (d > 24 || d < 0.5) continue;
            const t = new THREE.Vector3(c.x + (dx / d) * r, NAV_Y, c.z + (dz / d) * r);   // facing point of the reflector
            if (r === 0 && p.z < c.z) continue;                                            // rack strips face the loop only
            if (blockedByRacks(p.x, p.z, t.x, t.z)) continue;
            out.push({ t, d });
        }
        return out.sort((a, b) => a.d - b.d).slice(0, 3).map((o) => o.t);
    }
    /** Laser rays follow this LGV (null: none). */
    function showRaysFor(id) {
        for (const [k, m] of lgvs) if (k !== id) m.showLaserRays(null);
        rayLgv = id;
        rayTimer = 0;
    }

    // ---------- stacker crane jobs ----------
    const outPeriod = () => OUT_PERIOD * Math.min(1.2, Math.max(0.45, 1.5 - asrs.fill()));
    function storeJob() {
        const g = inTable.load;
        const id = g.userData.id;
        const slot = asrs.store(id);
        if (!slot) return;
        wraps.set(id, g.userData.wrap);
        const p = slotPos(slot);
        crane.move({
            from: { x: IN.x, y: SLOT_Y0, side: 1 },
            to: { x: p.x, y: p.y, side: slot.side ? -1 : 1 },
            take: () => { inTable.load = null; inTable.target = 0; return g; },
            put: (l) => {
                l.removeFromParent();
                setSlot(slot, wraps.get(id));
                onLog({ type: 'drop', text: `AS/RS stored ${id} in ${slotName(slot)} (${stock()} in stock)` });
            },
        });
    }
    function retrieveJob() {
        const r = asrs.retrieve();
        if (!r) return;
        outTimer = outPeriod();
        const p = slotPos(r.slot);
        const wrap = wraps.get(r.palletId) ?? true;
        wraps.delete(r.palletId);
        crane.move({
            from: { x: p.x, y: p.y, side: r.slot.side ? -1 : 1 },
            to: { x: OUT.x, y: SLOT_Y0, side: 1 },
            take: () => {
                setSlot(r.slot, null);
                const g = newLoad(wrap, p.x, p.z, Math.PI);
                g.position.y = p.y;
                g.userData.id = r.palletId;
                return g;
            },
            put: (l) => {
                scene.attach(l);
                outTable.load = l;
                outTable.target = 0;
                onLog({ type: 'pick', text: `AS/RS retrieved ${r.palletId} from ${slotName(r.slot)}` });
            },
        });
    }

    function update(dt, snapshot, zones) {
        // a P/D is refilled only once the LGV that served it has left (no pallet sliding into its forks)
        const docked = new Set();
        for (const s of snapshot) if (s.station) docked.add(s.station);
        // LGVs
        for (const s of snapshot) {
            const m = lgvs.get(s.id);
            if (!m) continue;
            m.group.position.set(s.x, 0, s.z);
            m.group.rotation.y = s.heading;
            m.state.speed = s.speed;
            m.state.lift = s.lift;
            m.state.loaded = s.loaded;
            m.state.battery = Math.max(0, s.battery);
            m.state.mode = s.state === 'Alarm' ? 'ALARM' : s.state === 'WaitZone' ? 'WAIT' : s.state === 'Charging' ? 'CHARGE' : 'AUTO';
            m.state.mission = s.missionId ? `${s.missionId} ${s.missionType}` : s.state.toUpperCase();
            m.update(dt);
        }
        // robot cell
        cell.update(dt);
        // line 2
        // line 2 holds while the AS/RS is nearly full (hysteresis 90 % → 80 %), like a WMS buffer limit
        const fillNow = asrs.fill();
        if (!l2Hold && fillNow >= 0.9) { l2Hold = true; onLog({ type: 'mission', text: 'Line 2 on hold: AS/RS 90 % full' }); }
        else if (l2Hold && fillNow <= 0.8) { l2Hold = false; onLog({ type: 'mission', text: 'Line 2 resumed' }); }
        // a bare pallet rides into the wrapper, gets wrapped, then rides to the P/D (waiting while an LGV is docked)
        if (!l2Hold && !stationPallets.L2 && !l2Moving && (l2Timer -= dt) <= 0) {
            l2Moving = newLoad(false, L2.x, L2.z + 4.6, 0);
            l2Phase = 'infeed';
            l2Timer = L2_PERIOD;
        }
        if (l2Moving && l2Phase === 'infeed') {
            l2Moving.position.z = Math.max(WRAP_Z, l2Moving.position.z - PIT_SPEED * dt);
            if (l2Moving.position.z <= WRAP_Z) {
                l2Phase = 'wrap';
                wrapper.wrap(WRAP_SECONDS, () => {
                    const g = newLoad(true, L2.x, WRAP_Z, 0);
                    scene.remove(l2Moving);
                    l2Moving = g;
                    l2Phase = 'outfeed';
                });
            }
        } else if (l2Moving && l2Phase === 'outfeed') {
            const stop = docked.has('L2') ? L2.z + PALLET_GAP : L2.z;
            l2Moving.position.z = Math.max(stop, l2Moving.position.z - PIT_SPEED * dt);
            if (l2Moving.position.z <= L2.z) { stationPallets.L2 = l2Moving; l2Moving = null; l2Phase = null; onPalletReady('L2'); }
        }
        wrapper.update(dt);
        // charger glows while an LGV charges on it
        const charging = snapshot.find((s) => s.station === 'C1' && s.state === 'Charging');
        charger.setCharging(!!charging);
        charger.update(dt, charging ? charging.battery : null);
        // laser triangulation of the selected LGV: 3 nearest reflectors in line of sight
        if (rayLgv && (rayTimer -= dt) <= 0) {
            rayTimer = 0.25;
            const m = lgvs.get(rayLgv);
            if (m) m.showLaserRays(visibleReflectors(m.group.position));
        }
        // AS/RS IN: the conveyor feeds the lift table (pallets queue behind it), the table lifts to the crane
        inTable.update(dt);
        outTable.update(dt);
        const inFree = !inTable.load && inTable.at(0);
        for (let i = 0; i < inbound.length; i++) {
            const stop = i > 0 ? inbound[i - 1].position.z + PALLET_GAP : inFree ? TRANSFER_Z : TRANSFER_Z + PALLET_GAP;
            inbound[i].position.z = Math.max(stop, inbound[i].position.z - PIT_SPEED * dt);
        }
        if (inFree && inbound.length && inbound[0].position.z <= TRANSFER_Z + 1e-6) {
            inTable.load = inbound.shift();
            inTable.target = SLOT_Y0;
        }
        // a pallet still on the IN P/D blocks the next drop there
        const inBusy = inbound.some((g) => g.position.z > IN.z - 1.25);
        if (inBusy !== inBlocked) { inBlocked = inBusy; onStationBlocked('ASRS_IN', inBusy); }
        // crane: stores first; retrieves on its (fill-dependent) period, first when the rack is getting full
        crane.update(dt);
        outTimer -= dt;
        if (!crane.busy()) {
            const fill = asrs.fill();
            const inReady = inTable.load && inTable.at(SLOT_Y0) && fill < 1;
            const outReady = !outTable.load && outTable.at(SLOT_Y0) && outTimer <= 0 && fill > 0;
            if (inReady && !(outReady && fill > 0.85)) storeJob();
            else if (outReady) retrieveJob();
        }
        // AS/RS OUT: the table lowers the retrieved pallet; the conveyor brings it to the P/D once that is clear
        if (outTable.load && outTable.at(0) && !stationPallets.ASRS_OUT && !outMoving && !docked.has('ASRS_OUT')) {
            outMoving = outTable.load;
            outTable.load = null;
        }
        if (!outTable.load && outTable.target === 0 && (!outMoving || outMoving.position.z > TRANSFER_Z + 1.3)) outTable.target = SLOT_Y0;
        if (outMoving) {
            outMoving.position.z = Math.min(OUT.z, outMoving.position.z + PIT_SPEED * dt);
            if (outMoving.position.z >= OUT.z) { stationPallets.ASRS_OUT = outMoving; outMoving = null; onPalletAtOut(); }
        }
        // bays: slide into lanes, trucks leave periodically or when a lane is full
        let full = false;
        for (const b of bayNames) {
            for (const p of bays[b]) p.g.position.z = Math.min(p.target, p.g.position.z + 0.5 * dt);
            if (bays[b].length >= 3) full = true;
        }
        const total = bayNames.reduce((t, b) => t + bays[b].length, 0);
        if (total && ((truckTimer -= dt) <= 0 || full)) {
            for (const b of bayNames) { for (const p of bays[b]) scene.remove(p.g); bays[b].length = 0; }
            onLog({ type: 'mission', text: `Truck departed with ${total} pallet${total > 1 ? 's' : ''}` });
            truckTimer = TRUCK_PERIOD;
        }
        // zones
        for (const [z, { group, mat }] of zoneTiles) {
            const info = zones[z];
            group.visible = !!info.owner;
            mat.color.setHex(info.queue.length ? ZONE_COLORS.queued : ZONE_COLORS.owned);
            mat.opacity = info.queue.length ? 0.16 : 0.1;
        }
    }

    trimShadowCasters(scene);
    return { lgvs, handle, update, showRaysFor, stored: stock, capacity: asrs.capacity, asrs, crane, wrapper, charger };
}
