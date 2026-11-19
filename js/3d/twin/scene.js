// Digital twin plant: environment, floor markings from the path graph, zone tiles, robot cell (L1),
// wrapped-pallet line (L2), AS/RS racks with IN/OUT conveyors, shipping bays, charger, parking,
// LGV models driven by fleet snapshots and the pallet flow driven by fleet pick/drop events.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { materials } from '../core/materials.js';
import { concreteMaps, floorTextTexture, hazardTexture, cartonTexture } from '../core/textures.js';
import { mergeStatic } from '../core/merge.js';
import { createLGV } from '../models/lgv.js';
import { createPalletizingCell } from '../models/cell.js';
import { createLoadedPallet, createPallet, PALLET_HEIGHT } from '../models/props.js';
import { NODES, EDGES, STATIONS, ZONES, palletSpot } from './layout.js';

const L2_PERIOD = 40;     // s between wrapped pallets on line 2
const OUT_PERIOD = 32;    // s between AS/RS retrievals
const TRUCK_PERIOD = 75;  // s between truck departures (or earlier if a bay is full)
const PIT_SPEED = 0.35;   // m/s pallet conveyors
const ZONE_COLORS = { owned: 0x22d3ee, queued: 0xff4d4d };

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

function rackBlock(M, { x0, x1, zFront, depth, levels, height }) {
    const g = new THREE.Group();
    const bay = 2.75;
    const xs = [];
    for (let x = x0; x <= x1 + 1e-6; x += bay) xs.push(x);
    const postGeo = new THREE.BoxGeometry(0.09, height, 0.07);
    for (const x of xs) {
        for (const dz of [0, -depth]) g.add(mesh(postGeo, M.rackBlue, x, height / 2, zFront + dz));
        for (let k = 0; k < Math.floor(height / 1.05); k++) {
            const b = mesh(new THREE.BoxGeometry(0.03, 1.15, 0.03), M.rackBlue, x, 0.6 + k * 1.05, zFront - depth / 2);
            b.rotation.x = k % 2 ? 0.95 : -0.95;
            g.add(b);
        }
    }
    const beamGeo = new THREE.BoxGeometry(bay - 0.09, 0.12, 0.05);
    for (let i = 0; i < xs.length - 1; i++) {
        for (const y of levels) for (const dz of [0, -depth]) g.add(mesh(beamGeo, M.rackOrange, (xs[i] + xs[i + 1]) / 2, y, zFront + dz));
    }
    const slots = [];
    for (let i = 0; i < xs.length - 1; i++) for (const y of [0.06, ...levels.map((l) => l + 0.06)]) {
        for (let p = -1; p <= 1; p++) slots.push({ x: (xs[i] + xs[i + 1]) / 2 + p * 0.88, y, z: zFront - depth / 2 });
    }
    return { group: g, slots };
}

export function buildPlant(stage, { lgvIds, onPalletReady, onPalletAtOut, onLog }) {
    const { scene, renderer } = stage;
    const M = materials();

    // ---------- environment & lights ----------
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.42;
    scene.background = new THREE.Color(0x0a0f18);
    scene.fog = new THREE.Fog(0x0a0f18, 30, 75);
    const { map, roughnessMap } = concreteMaps(16);
    scene.add(mesh(new THREE.PlaneGeometry(64, 52).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map, roughnessMap, roughness: 0.9, envMapIntensity: 0.6 }), 0, 0, 0, false));
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

    // ---------- line 1: robot palletizing cell (rotated so its light curtain faces the loop) ----------
    const stationPallets = { L1: null, L2: null, ASRS_OUT: null };
    const cell = createPalletizingCell({
        initialCount: 14,
        onPalletReady: () => { stationPallets.L1 = 'cell'; onPalletReady('L1'); },
    });
    cell.group.position.set(-4.45, 0, 6.05);
    cell.group.rotation.y = Math.PI;
    scene.add(cell.group);

    // ---------- line 2: wrapped pallets on a pit conveyor ----------
    const L2 = palletSpot(STATIONS.L2);
    statics.add(pitConveyor(M, L2.x, L2.z - 0.6, L2.z + 3.6));
    const hatch = new THREE.MeshStandardMaterial({ map: hazardTexture(3, 1), roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1 });
    statics.add(strip(L2.x - 0.8, L2.z + 3.9, L2.x + 0.8, L2.z + 3.9, 0.5, hatch));
    let l2Timer = 6, l2Moving = null;

    // ---------- AS/RS: racks + IN/OUT pit conveyors ----------
    const IN = palletSpot(STATIONS.ASRS_IN), OUT = palletSpot(STATIONS.ASRS_OUT);
    const levels = [1.6, 3.2, 4.8, 6.4];
    const front = rackBlock(M, { x0: -8.25, x1: 8.25, zFront: -6.2, depth: 1.0, levels, height: 7.8 });
    const back = rackBlock(M, { x0: -8.25, x1: 8.25, zFront: -8.8, depth: 1.0, levels, height: 7.8 });
    statics.add(front.group, back.group);
    statics.add(pitConveyor(M, IN.x, IN.z + 0.6, -6.9), pitConveyor(M, OUT.x, OUT.z + 0.6, -6.9));
    const slots = [...front.slots, ...back.slots].filter((s) => s.y > 0.1 || (Math.abs(s.x - IN.x) > 0.9 && Math.abs(s.x - OUT.x) > 0.9));
    const palletIM = new THREE.InstancedMesh(createPallet().geometry, M.wood, slots.length);
    const blockIM = new THREE.InstancedMesh(new RoundedBoxGeometry(0.78, 1, 1.18, 2, 0.02), new THREE.MeshStandardMaterial({ map: cartonTexture(21, '#b98a5b'), roughness: 0.8 }), slots.length);
    const o = new THREE.Object3D();
    slots.forEach((s, i) => {
        const h = 0.75 + ((i * 37) % 10) / 20;
        o.position.set(s.x, s.y, s.z); o.scale.set(1, 1, 1); o.updateMatrix(); palletIM.setMatrixAt(i, o.matrix);
        o.position.set(s.x, s.y + PALLET_HEIGHT + h / 2, s.z); o.scale.set(1, h, 1); o.updateMatrix(); blockIM.setMatrixAt(i, o.matrix);
    });
    for (const im of [palletIM, blockIM]) { im.castShadow = true; im.receiveShadow = true; scene.add(im); }
    let stored = Math.round(slots.length * 0.55);
    const showStored = () => { palletIM.count = blockIM.count = Math.min(stored, slots.length); };
    showStored();
    const inbound = [];        // pallets riding into the racks
    let outTimer = 8, outMoving = null;

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
    statics.add(mesh(new RoundedBoxGeometry(0.5, 1.5, 0.35, 2, 0.04), M.cabinetGrey, c1.dock.x + 0.4, 0.75, c1.dock.z - 1.0));
    statics.add(mesh(new THREE.BoxGeometry(0.34, 0.2, 0.01), M.ledGreen, c1.dock.x + 0.4, 1.15, c1.dock.z - 0.82, false));
    statics.add(mesh(new THREE.BoxGeometry(0.9, 0.02, 0.5), M.aluminium, c1.dock.x, 0.01, c1.dock.z, false));

    mergeStatic(statics);

    // ---------- LGVs ----------
    const lgvs = new Map();
    for (const id of lgvIds) {
        const m = createLGV({ id });
        m.state.loaded = false;
        scene.add(m.group);
        lgvs.set(id, m);
    }
    const carried = {};

    function newLoad(wrap, x, z, heading) {
        const g = createLoadedPallet({ cols: 2, rows: 3, layers: 3, wrap, seed: Math.floor(Math.random() * 9) });
        g.position.set(x, 0, z);
        g.rotation.y = heading;
        g.userData.wrap = wrap;
        scene.add(g);
        return g;
    }

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
        } else if (e.type === 'drop') {
            const st = STATIONS[e.station];
            const p = palletSpot(st);
            const g = newLoad(carried[e.lgv] ?? true, p.x, p.z, st.heading);
            delete carried[e.lgv];
            if (e.station === 'ASRS_IN') inbound.push(g);
            else if (bays[e.station]) bays[e.station].push({ g, target: BAY_SLOTS[bays[e.station].length] ?? 5.0 });
        }
    }

    function update(dt, snapshot, zones) {
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
            m.state.mode = s.state === 'WaitZone' ? 'WAIT' : s.state === 'Charging' ? 'CHARGE' : 'AUTO';
            m.state.mission = s.missionId ? `${s.missionId} ${s.missionType}` : s.state.toUpperCase();
            m.update(dt);
        }
        // robot cell
        cell.update(dt);
        // line 2
        if (!stationPallets.L2 && !l2Moving && (l2Timer -= dt) <= 0) {
            l2Moving = newLoad(true, L2.x, L2.z + 3.4, 0);
            l2Timer = L2_PERIOD;
        }
        if (l2Moving) {
            l2Moving.position.z = Math.max(L2.z, l2Moving.position.z - PIT_SPEED * dt);
            if (l2Moving.position.z <= L2.z) { stationPallets.L2 = l2Moving; l2Moving = null; onPalletReady('L2'); }
        }
        // AS/RS in: ride into the rack, then stored
        for (let i = inbound.length - 1; i >= 0; i--) {
            const g = inbound[i];
            g.position.z -= PIT_SPEED * dt;
            if (g.position.z < -6.6) { scene.remove(g); inbound.splice(i, 1); stored++; showStored(); onLog({ type: 'drop', text: `AS/RS stored pallet (${stored} in stock)` }); }
        }
        // AS/RS out: retrieve to the OUT P/D
        if (!stationPallets.ASRS_OUT && !outMoving && stored > 0 && (outTimer -= dt) <= 0) {
            stored--; showStored();
            outMoving = newLoad(Math.random() > 0.4, OUT.x, -6.6, Math.PI);
            outTimer = OUT_PERIOD;
        }
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

    return { lgvs, handle, update, stored: () => stored, capacity: slots.length };
}
