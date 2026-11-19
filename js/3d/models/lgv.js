// Detailed counterbalanced LGV (laser guided vehicle), fully procedural.
// Local frame: origin on the floor, +Z = fork side (forward), +Y up. Units: metres.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { materials } from '../core/materials.js';
import { labelTexture, screenTexture, corrugationTexture } from '../core/textures.js';
import { createLoadedPallet } from './props.js';
import { mergeStatic } from '../core/merge.js';

const BODY_W = 1.02;           // extrusion width (plus bevel ≈ 1.09 m)
const SIDE_X = BODY_W / 2 + 0.035;
const MAST_Z = 0.74;
const FORK_Z = 0.93;
const MAX_LIFT = 1.6;

function mesh(geo, mat, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
}

// Side profile (z, y) extruded across the vehicle width.
function profileGeometry(points, width, bevel = 0.035) {
    const geo = new THREE.ExtrudeGeometry(points, {
        depth: width, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 18,
    });
    geo.translate(0, 0, -width / 2);
    geo.rotateY(-Math.PI / 2);   // shape-x → +Z, extrusion → X
    return geo;
}

function bodyShape() {
    const s = new THREE.Shape();
    s.moveTo(-0.43, 0.30);
    s.lineTo(0.62, 0.30);
    s.lineTo(0.62, 1.45);
    s.quadraticCurveTo(0.62, 1.58, 0.47, 1.63);
    s.lineTo(0.18, 1.77);
    s.lineTo(-0.22, 1.74);                           // short rear deck, gentle slope
    s.quadraticCurveTo(-0.45, 1.74, -0.47, 1.49);    // rounded rear edge
    s.quadraticCurveTo(-0.48, 0.85, -0.43, 0.30);
    return s;
}

function forkShape() {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(1.15, 0);
    s.lineTo(1.15, 0.012);
    s.lineTo(0.93, 0.045);
    s.lineTo(0.05, 0.045);
    s.quadraticCurveTo(0.045, 0.06, 0.045, 0.09);
    s.lineTo(0.045, 0.58);
    s.lineTo(0, 0.58);
    s.closePath();
    return s;
}

function wheel(radius, width, M, tireMat) {
    const g = new THREE.Group();
    const r0 = radius * 0.62, hw = width / 2, e = Math.min(0.03, radius * 0.15);
    const profile = [
        new THREE.Vector2(r0, -hw), new THREE.Vector2(radius - e, -hw), new THREE.Vector2(radius, -hw + e),
        new THREE.Vector2(radius, hw - e), new THREE.Vector2(radius - e, hw), new THREE.Vector2(r0, hw),
    ];
    const tire = new THREE.LatheGeometry(profile, 48);
    tire.rotateZ(Math.PI / 2);
    g.add(mesh(tire, tireMat));
    const rim = new THREE.CylinderGeometry(r0, r0, width * 0.78, 32);
    rim.rotateZ(Math.PI / 2);
    g.add(mesh(rim, M.steelDark));
    const hub = new THREE.CylinderGeometry(r0 * 0.45, r0 * 0.5, width * 0.86, 24);
    hub.rotateZ(Math.PI / 2);
    g.add(mesh(hub, M.aluminium));
    const boltGeo = new THREE.CylinderGeometry(0.009, 0.009, width * 0.9, 8);
    boltGeo.rotateZ(Math.PI / 2);
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.add(mesh(boltGeo, M.chrome, 0, Math.cos(a) * r0 * 0.32, Math.sin(a) * r0 * 0.32));
    }
    return g;
}

// C-channel upright: web on the outside, flanges pointing to +X (mirror with scale.x = -1).
function channel(h, M) {
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(0.022, h, 0.13), M.steelDark, 0, h / 2, 0));
    g.add(mesh(new THREE.BoxGeometry(0.075, h, 0.018), M.steelDark, 0.026, h / 2, 0.056));
    g.add(mesh(new THREE.BoxGeometry(0.075, h, 0.018), M.steelDark, 0.026, h / 2, -0.056));
    return g;
}

function fieldShape(width, length, round) {
    const s = new THREE.Shape();
    s.moveTo(-width / 2, 0);
    s.lineTo(-width / 2, length - round);
    s.quadraticCurveTo(-width / 2, length, -width / 2 + round, length);
    s.lineTo(width / 2 - round, length);
    s.quadraticCurveTo(width / 2, length, width / 2, length - round);
    s.lineTo(width / 2, 0);
    return s;
}

function safetyField(width, length, color, opacity) {
    const g = new THREE.Group();
    const shape = fieldShape(width, length, Math.min(0.5, width / 3));
    const fill = new THREE.ShapeGeometry(shape, 16);
    fill.rotateX(Math.PI / 2);
    g.add(new THREE.Mesh(fill, new THREE.MeshBasicMaterial({
        color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
        polygonOffset: true, polygonOffsetFactor: -2,
    })));
    const pts = shape.getPoints(24).map((p) => new THREE.Vector3(p.x, 0.002, p.y));
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: Math.min(1, opacity * 4) })));
    return g;
}

/**
 * @param {{id?: string, forksSide?: 1|-1}} opts  forksSide -1 puts mast and forks on the -Z side (simulator)
 */
export function createLGV({ id = '02', forksSide = 1 } = {}) {
    const M = materials();
    const root = new THREE.Group();
    root.name = `LGV-${id}`;
    const tireMat = M.rubber.clone();
    tireMat.bumpMap = corrugationTexture(40);
    tireMat.bumpScale = 3;

    // ---------- chassis & body ----------
    root.add(mesh(new RoundedBoxGeometry(1.08, 0.2, 1.15, 3, 0.05), M.chassis, 0, 0.22, 0.1));
    root.add(mesh(profileGeometry(bodyShape(), BODY_W), M.lgvYellow));

    // rear rubber bumper with hazard stripes
    const bumper = mesh(new RoundedBoxGeometry(1.12, 0.17, 0.12, 3, 0.04), M.hazardShort, 0, 0.33, -0.52);
    root.add(bumper);
    // rear grille (counterweight ventilation)
    const grille = new THREE.Group();
    grille.add(mesh(new RoundedBoxGeometry(0.72, 0.24, 0.03, 2, 0.01), M.plasticBlack));
    for (let i = 0; i < 6; i++) grille.add(mesh(new THREE.BoxGeometry(0.66, 0.012, 0.035), M.steelWorn, 0, -0.09 + i * 0.036, 0.004));
    grille.position.set(0, 1.0, -0.513);
    root.add(grille);

    // side details (mirrored)
    for (const side of [-1, 1]) {
        const x = side * SIDE_X;
        // hazard band
        const band = mesh(new THREE.PlaneGeometry(0.97, 0.07), M.hazard, x + side * 0.002, 0.37, 0.095);
        band.rotation.y = side * Math.PI / 2;
        root.add(band);
        // cyan status LED strip
        root.add(mesh(new THREE.BoxGeometry(0.012, 0.022, 0.8), M.ledCyan, x + side * 0.004, 1.6, 0.08));
        // battery door: seams, vents, handle
        const door = new THREE.Group();
        const seamV = new THREE.BoxGeometry(0.01, 0.36, 0.012);
        const seamH = new THREE.BoxGeometry(0.01, 0.012, 0.58);
        door.add(mesh(seamV, M.plasticBlack, 0, 0, -0.29), mesh(seamV, M.plasticBlack, 0, 0, 0.29));
        door.add(mesh(seamH, M.plasticBlack, 0, 0.18, 0), mesh(seamH, M.plasticBlack, 0, -0.18, 0));
        for (let i = 0; i < 6; i++) door.add(mesh(new THREE.BoxGeometry(0.01, 0.012, 0.22), M.plasticBlack, 0, -0.11 + i * 0.03, -0.13));
        const handle = new THREE.CapsuleGeometry(0.012, 0.1, 4, 8);
        handle.rotateX(Math.PI / 2);
        door.add(mesh(handle, M.chrome, side * 0.012, 0.0, 0.17));
        door.position.set(x + side * 0.002, 0.64, -0.12);
        root.add(door);
        // vehicle number
        const num = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.23),
            new THREE.MeshStandardMaterial({ map: labelTexture(id), transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }));
        num.position.set(x + side * 0.003, 1.3, 0.22);
        num.rotation.y = side * Math.PI / 2;
        root.add(num);
        // front safety laser scanner (corner, 45°)
        const scanner = new THREE.Group();
        scanner.add(mesh(new RoundedBoxGeometry(0.14, 0.16, 0.12, 2, 0.02), M.lgvYellow));
        scanner.add(mesh(new THREE.BoxGeometry(0.12, 0.055, 0.02), M.glassDark, 0, 0.0, 0.062));
        scanner.add(mesh(new THREE.BoxGeometry(0.03, 0.012, 0.005), M.ledGreen, 0.035, 0.06, 0.061));
        scanner.position.set(side * 0.46, 0.40, 0.70);
        scanner.rotation.y = side * Math.PI / 4;
        root.add(scanner);
        // emergency stops (front sides and rear top corners)
        root.add(estop(M, side * 0.46, 1.68, 0.42));
        root.add(estop(M, side * 0.4, 1.76, -0.3));
    }

    // front LED bar & headlight-like sensors
    root.add(mesh(new THREE.BoxGeometry(0.7, 0.024, 0.012), M.ledCyan, 0, 1.2, 0.66));
    // rear safety scanner
    const rearScanner = new THREE.Group();
    rearScanner.add(mesh(new RoundedBoxGeometry(0.16, 0.16, 0.12, 2, 0.02), M.lgvYellow));
    rearScanner.add(mesh(new THREE.BoxGeometry(0.13, 0.055, 0.02), M.glassDark, 0, 0, -0.062));
    rearScanner.position.set(0, 0.47, -0.55);
    root.add(rearScanner);

    // HMI display on the rear deck
    const screen = screenTexture();
    const hmi = new THREE.Group();
    hmi.add(mesh(new RoundedBoxGeometry(0.36, 0.22, 0.05, 2, 0.015), M.plasticBlack));
    const display = new THREE.Mesh(new THREE.PlaneGeometry(0.31, 0.155),
        new THREE.MeshStandardMaterial({ map: screen.texture, emissiveMap: screen.texture, emissive: 0xffffff, emissiveIntensity: 1.1, roughness: 0.2 }));
    display.position.z = -0.027;
    display.rotation.y = Math.PI;
    hmi.add(display);
    hmi.position.set(0.22, 1.85, -0.2);
    hmi.rotation.x = 0.55;
    root.add(hmi);

    // antenna
    root.add(mesh(new THREE.CylinderGeometry(0.007, 0.01, 0.32, 8), M.plasticBlack, -0.28, 1.93, -0.12));
    root.add(mesh(new THREE.SphereGeometry(0.014, 12, 8), M.plasticBlack, -0.28, 2.1, -0.12));

    // ---------- wheels ----------
    const wheels = [];
    const addWheel = (r, w, x, z) => {
        const wh = wheel(r, w, M, tireMat);
        wh.position.set(x, r, z);
        root.add(wh);
        wheels.push({ obj: wh, r });
        const guard = new THREE.TorusGeometry(r + 0.04, 0.022, 8, 28, Math.PI);
        guard.rotateY(Math.PI / 2);
        root.add(mesh(guard, M.chassis, x, r, z));
    };
    for (const s of [-1, 1]) {
        addWheel(0.24, 0.2, s * 0.53, 0.42);   // load wheels (under the mast)
        addWheel(0.19, 0.15, s * 0.46, -0.22);  // steering wheels
    }

    // ---------- laser navigation scanner (rotating head + beam) ----------
    root.add(mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.8, 12), M.steelDark, 0, 2.2, -0.05));
    root.add(mesh(new THREE.BoxGeometry(0.16, 0.02, 0.16), M.steelDark, 0, 1.798, -0.05));
    const navBase = new THREE.Group();
    navBase.position.set(0, 2.6, -0.05);   // laser head above the mast top (2.47 m)
    navBase.add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 32), M.lgvYellow, 0, 0, 0));
    navBase.add(mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.04, 32), M.plasticBlack, 0, 0.145, 0));
    const navHead = new THREE.Group();
    navHead.position.y = 0.08;
    navHead.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.075, 32), M.glassDark));
    navHead.add(mesh(new THREE.BoxGeometry(0.018, 0.018, 0.006), M.ledRed, 0, 0, 0.081));
    const beam = new THREE.Mesh(new THREE.CircleGeometry(3.5, 12, Math.PI / 2 - 0.05, 0.1),
        new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.rotation.x = -Math.PI / 2;
    navHead.add(beam);
    navBase.add(navHead);
    root.add(navBase);

    // ---------- warning beacon ----------
    const beacon = new THREE.Group();
    beacon.position.set(-0.4, 1.795, 0.05);
    beacon.add(mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.04, 24), M.plasticBlack, 0, 0.02, 0));
    const dome = mesh(new THREE.SphereGeometry(0.048, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.beaconDome.clone(), 0, 0.04, 0);
    dome.castShadow = false;
    beacon.add(dome);
    const reflector = mesh(new THREE.BoxGeometry(0.05, 0.02, 0.008), M.ledAmber, 0, 0.06, 0);
    beacon.add(reflector);
    const beaconLight = new THREE.PointLight(0xff8a00, 0, 3.5, 2);
    beaconLight.position.y = 0.07;
    beacon.add(beaconLight);
    root.add(beacon);

    // ---------- mast ----------
    const OUTER_H = 2.35;
    for (const s of [-1, 1]) {
        const up = channel(OUTER_H, M);
        up.position.set(s * 0.46, 0.12, MAST_Z);
        up.scale.x = -s;
        root.add(up);
        // tilt cylinders
        const tilt = new THREE.CylinderGeometry(0.03, 0.03, 0.42, 12);
        tilt.rotateX(Math.PI / 2 - 0.35);
        root.add(mesh(tilt, M.steelDark, s * 0.38, 0.72, 0.55));
    }
    root.add(mesh(new THREE.BoxGeometry(1.0, 0.08, 0.12), M.steelDark, 0, 0.12 + OUTER_H, MAST_Z));
    root.add(mesh(new THREE.BoxGeometry(0.96, 0.06, 0.1), M.steelDark, 0, 1.15, MAST_Z));
    // main lift cylinder (fixed barrel + chrome rod that extends)
    root.add(mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.3, 20), M.steelWorn, 0, 0.78, MAST_Z + 0.02));
    const rod = mesh(new THREE.CylinderGeometry(0.034, 0.034, 1, 16), M.chrome, 0, 0, MAST_Z + 0.02);
    root.add(rod);
    // hydraulic hoses along the mast
    const hoseCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.22, 0.95, 0.6), new THREE.Vector3(0.3, 1.4, MAST_Z - 0.05), new THREE.Vector3(0.32, 2.3, MAST_Z - 0.04),
    ]);
    root.add(mesh(new THREE.TubeGeometry(hoseCurve, 24, 0.013, 8), M.hose));

    // inner (telescopic) mast stage
    const inner = new THREE.Group();
    const INNER_H = 2.2;
    for (const s of [-1, 1]) {
        const up = channel(INNER_H, M);
        up.position.set(s * 0.37, 0, 0);
        up.scale.x = s;
        inner.add(up);
    }
    inner.add(mesh(new THREE.BoxGeometry(0.8, 0.07, 0.1), M.steelDark, 0, INNER_H, 0));
    const sheaveGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.04, 20);
    sheaveGeo.rotateZ(Math.PI / 2);
    const sheaves = [];
    for (const s of [-1, 1]) {
        const sh = mesh(sheaveGeo, M.aluminium, s * 0.2, INNER_H + 0.06, 0.03);
        inner.add(sh);
        sheaves.push(sh);
    }
    inner.position.set(0, 0.16, MAST_Z + 0.07);
    root.add(inner);

    // lift chains (instanced links)
    const LINK = 0.05;
    const chainMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.024, LINK * 1.1, 0.012), M.steelWorn, 400);
    chainMesh.castShadow = true;
    root.add(chainMesh);

    // ---------- carriage, backrest, forks ----------
    const carriage = new THREE.Group();
    carriage.add(mesh(new RoundedBoxGeometry(1.02, 0.4, 0.06, 2, 0.015), M.steelWorn, 0, 0.26, FORK_Z - 0.03));
    const bar = (w, h, d, x, y, z) => carriage.add(mesh(new THREE.BoxGeometry(w, h, d), M.steelDark, x, y, z));
    bar(0.04, 0.84, 0.04, -0.49, 0.88, FORK_Z - 0.03);
    bar(0.04, 0.84, 0.04, 0.49, 0.88, FORK_Z - 0.03);
    bar(1.02, 0.04, 0.04, 0, 1.3, FORK_Z - 0.03);
    bar(1.02, 0.03, 0.03, 0, 0.9, FORK_Z - 0.03);
    for (let i = -3; i <= 3; i++) bar(0.016, 0.82, 0.016, i * 0.14, 0.88, FORK_Z - 0.03);
    const forkGeo = profileGeometry(forkShape(), 0.12, 0.006);
    for (const s of [-1, 1]) {
        carriage.add(mesh(forkGeo, M.steelWorn, s * 0.27, 0, FORK_Z));
        // pallet presence sensor at the fork tip
        carriage.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.01, 10), M.ledGreen, s * 0.27, 0.047, FORK_Z + 1.0));
    }
    const load = createLoadedPallet({ cols: 2, rows: 3, layers: 3, seed: Number(id) || 0 });
    load.position.set(0, -0.055, FORK_Z + 0.62);
    carriage.add(load);
    root.add(carriage);

    // ---------- safety fields & blue spot (floor projections) ----------
    const fieldsFront = new THREE.Group();
    fieldsFront.add(safetyField(1.9, 3.6, 0xffb020, 0.07), safetyField(1.4, 2.3, 0xff3030, 0.12));
    fieldsFront.position.set(0, 0.006, 0.66);
    const fieldsRear = new THREE.Group();
    fieldsRear.add(safetyField(1.9, 3.2, 0xffb020, 0.07), safetyField(1.4, 2.0, 0xff3030, 0.12));
    fieldsRear.position.set(0, 0.006, -0.56);
    fieldsRear.rotation.y = Math.PI;
    root.add(fieldsFront, fieldsRear);

    const spotMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
    const haloMat = spotMat.clone();
    haloMat.opacity = 0.18;
    const spotGeo = new THREE.CircleGeometry(0.22, 32).rotateX(-Math.PI / 2);
    const haloGeo = new THREE.CircleGeometry(0.5, 32).rotateX(-Math.PI / 2);
    const makeSpot = (z) => {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(haloGeo, haloMat), new THREE.Mesh(spotGeo, spotMat));
        g.position.set(0, 0.009, z);
        root.add(g);
        return g;
    };
    const spotFront = makeSpot(3.1);
    const spotRear = makeSpot(-1.8);

    // ---------- runtime state ----------
    const state = { speed: 0, lift: 0.12, loaded: true, mode: 'AUTO', battery: 0.87, mission: 'M1042  A3 → B1' };
    const tmp = new THREE.Object3D();
    let screenTimer = 0;
    let t = 0;

    function updateChains(carriageY, innerY) {
        let n = 0;
        const top = inner.position.y + innerY + INNER_H + 0.06;
        for (const s of [-1, 1]) {
            const x = s * 0.2;
            const front = { from: carriageY + 0.42, to: top, z: MAST_Z + 0.13 };
            const back = { from: 1.15, to: top, z: MAST_Z + 0.04 };
            for (const run of [front, back]) {
                const count = Math.max(0, Math.floor((run.to - run.from) / LINK));
                for (let i = 0; i < count && n < chainMesh.count; i++) {
                    tmp.position.set(x, run.from + i * LINK + LINK / 2, run.z);
                    tmp.rotation.set(0, i % 2 ? Math.PI / 2 : 0, 0);
                    tmp.updateMatrix();
                    chainMesh.setMatrixAt(n++, tmp.matrix);
                }
            }
        }
        for (let i = n; i < chainMesh.count; i++) {
            tmp.position.set(0, -10, 0);
            tmp.updateMatrix();
            chainMesh.setMatrixAt(i, tmp.matrix);
        }
        chainMesh.instanceMatrix.needsUpdate = true;
    }

    function update(dt) {
        t += dt;
        const v = state.speed;
        for (const w of wheels) w.obj.rotation.x += (v * dt) / w.r;

        // mast: carriage rides the inner stage, inner stage extends with half the stroke
        const lift = THREE.MathUtils.clamp(state.lift, 0.02, MAX_LIFT);
        const innerY = Math.max(0, lift - 0.45) * 0.55;
        inner.position.y = 0.16 + innerY;
        carriage.position.y = lift;
        const rodTop = 1.4 + innerY;
        rod.scale.y = rodTop - 1.2;
        rod.position.y = 1.2 + (rodTop - 1.2) / 2;
        for (const sh of sheaves) sh.rotation.x = -lift * 6;
        updateChains(lift, innerY);
        load.visible = state.loaded;

        // nav scanner spins ~2 rev/s
        navHead.rotation.y += dt * Math.PI * 4;
        updateRays();

        // beacon flashes while moving or handling a load
        const active = Math.abs(v) > 0.02 || state.mode !== 'AUTO';
        const flash = active ? (Math.sin(t * 9) > 0.2 ? 1 : 0.15) : 0.15;
        reflector.rotation.y += dt * 10;
        dome.material.emissiveIntensity = 0.4 + flash * 3.5;
        beaconLight.intensity = flash * 2.5;

        // safety fields and blue spot follow the travel direction
        // obstacle alarm: front fields stay on and pulse
        const alarm = state.mode === 'ALARM';
        fieldsFront.visible = v > 0.02 || alarm;
        const k = alarm ? 1 + Math.sin(t * 14) * 0.05 : 1;
        fieldsFront.scale.set(k, 1, k);
        fieldsRear.visible = v < -0.02;
        spotFront.visible = v > 0.02;
        spotRear.visible = v < -0.02;
        const pulse = 0.65 + Math.sin(t * 6) * 0.25;
        spotMat.opacity = pulse;

        screenTimer -= dt;
        if (screenTimer <= 0) {
            screenTimer = 0.5;
            const label = Math.abs(v) > 0.02 ? (v > 0 ? 'MOVING ▶' : '◀ REVERSE') : (state.mode === 'AUTO' ? 'AUTO' : state.mode);
            screen.draw({ title: `LGV-${id}`, state: label, battery: state.battery, line: state.mission });
        }
    }

    // merge everything that never moves relative to the vehicle body
    mergeStatic(root, [...wheels.map((w) => w.obj), inner, carriage, navHead, beacon, rod, chainMesh, fieldsFront, fieldsRear, spotFront, spotRear]);
    mergeStatic(carriage, [load]);
    mergeStatic(inner, sheaves);
    for (const w of wheels) mergeStatic(w.obj);

    // ---------- laser triangulation: rays from the nav head to the reflectors it is measuring ----------
    const RAYS = 3;
    const rayGeo = new THREE.BufferGeometry();
    rayGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RAYS * 6), 3));
    rayGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(RAYS * 6), 3));
    const rays = new THREE.LineSegments(rayGeo, new THREE.LineBasicMaterial({
        vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    rays.frustumCulled = false;
    rays.visible = false;
    let rayTargets = null;
    const _head = new THREE.Vector3(), _beam = new THREE.Vector3(), _to = new THREE.Vector3();
    function updateRays() {
        if (!rayTargets) return;
        outer.updateMatrixWorld(true);
        navHead.getWorldPosition(_head);
        _beam.set(0, 0, -1).applyQuaternion(navHead.getWorldQuaternion(new THREE.Quaternion()));   // beam sector direction
        const pos = rayGeo.attributes.position, col = rayGeo.attributes.color;
        const hl = outer.worldToLocal(_head.clone());
        for (let i = 0; i < RAYS; i++) {
            const t = rayTargets[i];
            if (!t) { pos.setXYZ(2 * i, hl.x, hl.y, hl.z); pos.setXYZ(2 * i + 1, hl.x, hl.y, hl.z); continue; }
            _to.subVectors(t, _head);
            // the ray flashes when the spinning beam sweeps across its reflector
            const c = (_to.x * _beam.x + _to.z * _beam.z) / (Math.hypot(_to.x, _to.z) * Math.hypot(_beam.x, _beam.z) || 1);
            const k = 0.28 + 0.72 * Math.pow(Math.max(0, c), 24);
            const tl = outer.worldToLocal(_to.copy(t));
            pos.setXYZ(2 * i, hl.x, hl.y, hl.z);
            pos.setXYZ(2 * i + 1, tl.x, tl.y, tl.z);
            col.setXYZ(2 * i, k, 0.16 * k, 0.16 * k);
            col.setXYZ(2 * i + 1, 0.5 * k, 0.08 * k, 0.08 * k);
        }
        pos.needsUpdate = true;
        col.needsUpdate = true;
    }

    update(0);
    const outer = new THREE.Group();
    outer.name = `LGV-${id}`;
    if (forksSide < 0) root.rotation.y = Math.PI;
    outer.add(root, rays);
    /** Draw up to 3 rays from the nav head to these world points (reflectors), or hide them with null. */
    function showLaserRays(targets) {
        rayTargets = targets && targets.length ? targets.slice(0, RAYS) : null;
        rays.visible = !!rayTargets;
        updateRays();
    }
    /** Show or hide the stretch film of the carried load (L2 pallets are wrapped, L1 pallets are not). */
    const setFilm = (visible) => { const f = load.getObjectByName('film'); if (f) f.visible = visible; };

    return { group: outer, body: root, state, update, carriage, MAX_LIFT, setFilm, showLaserRays };
}

function estop(M, x, y, z) {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.035, 20), M.lgvYellow, 0, 0.018, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 12), M.plasticBlack, 0, 0.045, 0));
    const cap = mesh(new THREE.SphereGeometry(0.038, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.estopRed, 0, 0.052, 0);
    cap.scale.y = 0.55;
    g.add(cap);
    g.position.set(x, y, z);
    return g;
}
