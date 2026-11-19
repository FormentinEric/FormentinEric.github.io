// Palletizing cell: robot + infeed roller conveyor + pallet station + fence, light curtain,
// controller cabinet with stack light, and the pick-and-place cycle.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { materials } from '../core/materials.js';
import { createRobot } from './robot.js';
import { createPallet, createCarton, CARTON, PALLET_HEIGHT } from './props.js';
import { screenTexture } from '../core/textures.js';
import { mergeStatic } from '../core/merge.js';

const CONV_TOP = 0.8;
const CONV_Z = 1.05;
const CONV_X0 = -6.0, CONV_X1 = -1.3;          // conveyor from → end stop
const PICK_X = CONV_X1 - CARTON.w / 2 - 0.05;  // carton centre when stopped
const PALLET_POS = new THREE.Vector3(1.55, 0, 1.05);

function mesh(geo, mat, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
}

const ease = (t) => t * t * t * (t * (t * 6 - 15) + 10); // smootherstep

function conveyor(M) {
    const g = new THREE.Group();
    const len = CONV_X1 - CONV_X0 + 0.15;
    const cx = (CONV_X0 + CONV_X1) / 2;
    const W = 0.62;
    for (const s of [-1, 1]) {
        // C-profile side frame
        g.add(mesh(new THREE.BoxGeometry(len, 0.14, 0.012), M.steelDark, cx, CONV_TOP - 0.06, CONV_Z + s * W / 2));
        g.add(mesh(new THREE.BoxGeometry(len, 0.012, 0.05), M.steelDark, cx, CONV_TOP + 0.006, CONV_Z + s * (W / 2 - 0.02)));
        g.add(mesh(new THREE.BoxGeometry(len, 0.012, 0.05), M.steelDark, cx, CONV_TOP - 0.126, CONV_Z + s * (W / 2 - 0.02)));
        // guide rails
        g.add(mesh(new THREE.BoxGeometry(len, 0.03, 0.012), M.aluminium, cx, CONV_TOP + 0.1, CONV_Z + s * (CARTON.d / 2 + 0.04)));
        for (let x = CONV_X0 + 0.3; x < CONV_X1; x += 1.0) {
            g.add(mesh(new THREE.BoxGeometry(0.02, 0.1, 0.02), M.aluminium, x, CONV_TOP + 0.05, CONV_Z + s * (CARTON.d / 2 + 0.05)));
        }
    }
    // legs with feet and cross braces
    for (let x = CONV_X0 + 0.2; x <= CONV_X1; x += 1.2) {
        for (const s of [-1, 1]) {
            g.add(mesh(new THREE.BoxGeometry(0.05, CONV_TOP - 0.13, 0.05), M.steelDark, x, (CONV_TOP - 0.13) / 2, CONV_Z + s * (W / 2 - 0.03)));
            g.add(mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.02, 12), M.rubber, x, 0.01, CONV_Z + s * (W / 2 - 0.03)));
        }
        g.add(mesh(new THREE.BoxGeometry(0.04, 0.04, W - 0.06), M.steelDark, x, 0.25, CONV_Z));
    }
    // end stop + photo eye
    g.add(mesh(new THREE.BoxGeometry(0.04, 0.16, W), M.fenceYellow, CONV_X1 + 0.02, CONV_TOP + 0.08, CONV_Z));
    g.add(mesh(new RoundedBoxGeometry(0.05, 0.07, 0.04, 2, 0.008), M.plasticBlack, PICK_X - 0.12, CONV_TOP + 0.14, CONV_Z - W / 2 - 0.03));
    const eye = mesh(new THREE.BoxGeometry(0.012, 0.012, 0.004), M.ledRed, PICK_X - 0.12, CONV_TOP + 0.15, CONV_Z - W / 2 - 0.009);
    g.add(eye);
    g.add(mesh(new THREE.BoxGeometry(0.05, 0.07, 0.01), M.aluminium, PICK_X - 0.12, CONV_TOP + 0.14, CONV_Z + W / 2 + 0.02));
    // drive motor + gearbox
    const mx = (CONV_X0 + CONV_X1) / 2;
    g.add(mesh(new RoundedBoxGeometry(0.2, 0.18, 0.16, 2, 0.02), M.rackBlue, mx, CONV_TOP - 0.25, CONV_Z + W / 2 + 0.1));
    g.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.24, 24).rotateX(Math.PI / 2), M.motor, mx + 0.18, CONV_TOP - 0.25, CONV_Z + W / 2 + 0.1));

    // rollers (instanced, they spin when the belt runs)
    const pitch = 0.1;
    const count = Math.floor((CONV_X1 - CONV_X0) / pitch);
    const rollerGeo = new THREE.CylinderGeometry(0.03, 0.03, W - 0.05, 18).rotateX(Math.PI / 2);
    const rollers = new THREE.InstancedMesh(rollerGeo, M.aluminium, count);
    rollers.castShadow = true;
    rollers.receiveShadow = true;
    const tmp = new THREE.Object3D();
    const xs = [];
    for (let i = 0; i < count; i++) xs.push(CONV_X0 + 0.05 + i * pitch);
    let angle = 0;
    function spin(dt, speed) {
        angle -= (speed * dt) / 0.03;
        for (let i = 0; i < count; i++) {
            tmp.position.set(xs[i], CONV_TOP - 0.03, CONV_Z);
            tmp.rotation.set(0, 0, angle);
            tmp.updateMatrix();
            rollers.setMatrixAt(i, tmp.matrix);
        }
        rollers.instanceMatrix.needsUpdate = true;
    }
    spin(0, 0);
    g.add(rollers);
    return { group: g, spin, eye, rollers };
}

function fencePanel(M, width, height = 2.0) {
    const g = new THREE.Group();
    const meshTex = M.fenceMesh.map.clone();
    meshTex.needsUpdate = true;
    meshTex.repeat.set(width / 0.5, height / 0.5);
    const mat = M.fenceMesh.clone();
    mat.map = meshTex;
    const panel = mesh(new THREE.PlaneGeometry(width - 0.06, height - 0.12), mat, 0, 0.12 + (height - 0.12) / 2, 0);
    g.add(panel);
    for (const y of [0.12, height]) g.add(mesh(new THREE.BoxGeometry(width - 0.05, 0.025, 0.025), M.plasticBlack, 0, y, 0));
    g.add(mesh(new THREE.BoxGeometry(0.055, height + 0.05, 0.055), M.fenceYellow, -width / 2, (height + 0.05) / 2, 0));
    g.add(mesh(new THREE.BoxGeometry(0.14, 0.012, 0.14), M.steelDark, -width / 2, 0.006, 0));
    return g;
}

function fenceRun(M, from, to, gaps = []) {
    // straight fence from `from` to `to` (Vector2 in x,z), panels ≤ 1.2 m, skipping gap ranges [t0,t1] (0..1)
    const g = new THREE.Group();
    const dir = to.clone().sub(from);
    const L = dir.length();
    const n = Math.ceil(L / 1.2);
    const w = L / n;
    const ang = Math.atan2(dir.x, dir.y);
    for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n;
        if (gaps.some(([a, b]) => t0 < b && t1 > a)) continue;
        const p = fencePanel(M, w);
        const c = from.clone().addScaledVector(dir, (t0 + t1) / 2);
        p.position.set(c.x, 0, c.y);
        p.rotation.y = ang - Math.PI / 2;
        g.add(p);
    }
    // closing post
    g.add(mesh(new THREE.BoxGeometry(0.055, 2.05, 0.055), M.fenceYellow, to.x, 1.025, to.y));
    return g;
}

function lightCurtain(M, x0, x1, z) {
    const g = new THREE.Group();
    for (const [x, s] of [[x0, 1], [x1, -1]]) {
        g.add(mesh(new RoundedBoxGeometry(0.06, 1.7, 0.06, 2, 0.01), M.plasticBlack, x, 0.85, z));
        g.add(mesh(new THREE.BoxGeometry(0.065, 0.06, 0.065), M.fenceYellow, x, 1.72, z));
        g.add(mesh(new THREE.BoxGeometry(0.004, 1.45, 0.012), M.ledRed, x + s * 0.031, 0.85, z));
    }
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 9; i++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.004, 0.004), beamMat);
        b.position.set((x0 + x1) / 2, 0.2 + i * 0.17, z);
        g.add(b);
    }
    return g;
}

function stackLight(M) {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 10), M.aluminium, 0, 0.15, 0));
    const colors = [M.ledGreen, M.lampOff, M.lampOff];
    const segs = [];
    for (let i = 0; i < 3; i++) {
        const s = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.075, 24), colors[i], 0, 0.34 + i * 0.08, 0);
        g.add(s);
        segs.push(s);
    }
    g.add(mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.02, 24), M.plasticBlack, 0, 0.59, 0));
    return { group: g, segs };
}

function cabinet(M) {
    const g = new THREE.Group();
    g.add(mesh(new RoundedBoxGeometry(0.7, 1.8, 0.55, 3, 0.02), M.cabinetGrey, 0, 0.95, 0));
    g.add(mesh(new THREE.BoxGeometry(0.72, 0.1, 0.57), M.steelDark, 0, 0.05, 0));
    g.add(mesh(new THREE.BoxGeometry(0.004, 1.6, 0.004), M.plasticBlack, 0, 0.95, 0.277));
    g.add(mesh(new THREE.CapsuleGeometry(0.012, 0.12, 4, 8), M.plasticBlack, 0.27, 1.05, 0.29));
    for (let i = 0; i < 8; i++) g.add(mesh(new THREE.BoxGeometry(0.22, 0.008, 0.01), M.plasticBlack, -0.18, 0.3 + i * 0.025, 0.277));
    // main switch
    g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 20).rotateX(Math.PI / 2), M.fenceYellow, 0.2, 1.4, 0.285));
    g.add(mesh(new THREE.BoxGeometry(0.02, 0.09, 0.03), M.estopRed, 0.2, 1.4, 0.3));
    // teach pendant hanging on the side
    const tp = screenTexture(256, 160);
    tp.draw({ title: 'R6 TP', state: 'AUTO', battery: 1, line: 'PAL_CYCLE' });
    const pendant = new THREE.Group();
    pendant.add(mesh(new RoundedBoxGeometry(0.26, 0.34, 0.06, 2, 0.02), M.plasticBlack));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.12),
        new THREE.MeshStandardMaterial({ map: tp.texture, emissiveMap: tp.texture, emissive: 0xffffff, emissiveIntensity: 0.9 }));
    scr.position.set(0, 0.06, 0.031);
    pendant.add(scr);
    pendant.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 16).rotateX(Math.PI / 2), M.estopRed, 0.08, -0.1, 0.035));
    pendant.position.set(0.37, 1.2, 0.05);
    pendant.rotation.y = Math.PI / 2;
    g.add(pendant);
    const sl = stackLight(M);
    sl.group.position.set(-0.22, 1.85, -0.15);
    g.add(sl.group);
    return { group: g, stack: sl };
}

export function createPalletizingCell() {
    const M = materials();
    const cell = new THREE.Group();
    cell.name = 'PalletizingCell';

    const robot = createRobot();
    cell.add(robot.group);

    const conv = conveyor(M);
    cell.add(conv.group);

    const pallet = createPallet();
    pallet.position.copy(PALLET_POS);
    pallet.rotation.y = Math.PI / 2;
    cell.add(pallet);

    // fence: back, sides, front with LGV exit opening + light curtain
    const Z0 = -1.6, Z1 = 2.45, X0 = -2.45, X1 = 2.85;
    cell.add(fenceRun(M, new THREE.Vector2(X0, Z0), new THREE.Vector2(X1, Z0)));
    cell.add(fenceRun(M, new THREE.Vector2(X1, Z0), new THREE.Vector2(X1, Z1)));
    cell.add(fenceRun(M, new THREE.Vector2(X0, Z1), new THREE.Vector2(X0, Z0), [[0.2, 0.5]])); // conveyor opening
    cell.add(fenceRun(M, new THREE.Vector2(X0, Z1), new THREE.Vector2(0.75, Z1)));
    cell.add(lightCurtain(M, 0.8, 2.35, Z1));
    cell.add(fenceRun(M, new THREE.Vector2(2.4, Z1), new THREE.Vector2(X1, Z1)));

    const cab = cabinet(M);
    cab.group.position.set(-3.3, 0, -0.6);
    cab.group.rotation.y = Math.PI / 2;
    cell.add(cab.group);

    // static geometry → one mesh per material
    mergeStatic(cell, [robot.group, conv.rollers, conv.eye, pallet, ...cab.stack.segs]);

    // ---------- cycle ----------
    const boxes = [];          // cartons travelling on the conveyor
    const placed = [];         // cartons on the pallet
    let spawnTimer = 0;
    const SPEED = 0.55;

    function slot(i) {
        const layer = Math.floor(i / 6), k = i % 6;
        const col = k % 3, row = Math.floor(k / 3);
        return new THREE.Vector3(
            PALLET_POS.x + (col - 1) * CARTON.w,
            PALLET_POS.y + PALLET_HEIGHT + (layer + 1) * CARTON.h,
            PALLET_POS.z + (row - 0.5) * CARTON.d,
        );
    }
    const pickTop = new THREE.Vector3(PICK_X, CONV_TOP + CARTON.h, CONV_Z);
    const UP = 0.35;

    // Cylindrical interpolation around the robot base → natural arcs, no path through the base
    function interp(a, b, s, lift) {
        const ta = Math.atan2(a.x, a.z), tb = Math.atan2(b.x, b.z);
        let dt = tb - ta;
        if (dt > Math.PI) dt -= Math.PI * 2;
        if (dt < -Math.PI) dt += Math.PI * 2;
        const th = ta + dt * s;
        const r = THREE.MathUtils.lerp(Math.hypot(a.x, a.z), Math.hypot(b.x, b.z), s);
        const y = THREE.MathUtils.lerp(a.y, b.y, s) + Math.sin(Math.PI * s) * lift;
        return new THREE.Vector3(Math.sin(th) * r, y, Math.cos(th) * r);
    }

    let tcp = pickTop.clone().add(new THREE.Vector3(0, UP + 0.3, 0.4));
    let step = null;
    let stepT = 0;
    let index = 0;
    let carried = null;
    let fullTimer = 0;
    const queue = [];

    function plan() {
        const s = slot(index);
        const abovePick = pickTop.clone().setY(pickTop.y + UP);
        const abovePlace = s.clone().setY(s.y + UP);
        queue.push(
            { to: abovePick, dur: 1.0, lift: 0.15 },
            { waitBox: true },
            { to: pickTop, dur: 0.45 },
            { grip: true, dur: 0.25 },
            { to: abovePick, dur: 0.4 },
            { to: abovePlace, dur: 1.35, lift: 0.3 },
            { to: s, dur: 0.5 },
            { release: true, dur: 0.25 },
            { to: abovePlace, dur: 0.4 },
        );
    }

    function boxAtPick() {
        return boxes.find((b) => Math.abs(b.position.x - PICK_X) < 0.01);
    }

    function update(dt) {
        // conveyor flow
        spawnTimer -= dt;
        const last = boxes[boxes.length - 1];
        if (spawnTimer <= 0 && boxes.length < 5 && (!last || last.position.x > CONV_X0 + 0.9)) {
            const c = createCarton(Math.floor(Math.random() * 3));
            c.position.set(CONV_X0 + 0.25, CONV_TOP + CARTON.h / 2, CONV_Z);
            cell.add(c);
            boxes.push(c);
            spawnTimer = 0.8;
        }
        let moving = false;
        for (let i = 0; i < boxes.length; i++) {
            const limit = i === 0 ? PICK_X : boxes[i - 1].position.x - CARTON.w - 0.06;
            const b = boxes[i];
            if (b.position.x < limit) {
                b.position.x = Math.min(limit, b.position.x + SPEED * dt);
                moving = true;
            }
        }
        conv.spin(dt, moving ? SPEED : 0);
        conv.eye.material = boxAtPick() ? M.ledGreen : M.ledRed;

        // pallet full: wait, then clear and restart (the LGV will take it away in the full scene)
        if (fullTimer > 0) {
            fullTimer -= dt;
            if (fullTimer <= 0) {
                for (const p of placed) cell.remove(p);
                placed.length = 0;
                index = 0;
            }
            robot.setJoints(robot.solveIK(tcp));
            return;
        }

        if (!step) {
            if (!queue.length) plan();
            step = queue.shift();
            stepT = 0;
            step.from = tcp.clone();
        }

        if (step.waitBox) {
            if (boxAtPick()) step = null;
        } else if (step.grip || step.release) {
            stepT += dt;
            if (step.grip && !carried) {
                carried = boxAtPick();
                boxes.splice(boxes.indexOf(carried), 1);
                robot.tcp.attach(carried);
                robot.setVacuum(true);
            }
            if (step.release && carried) {
                cell.attach(carried);
                const s = slot(index);
                carried.position.set(s.x, s.y - CARTON.h / 2, s.z);
                carried.rotation.set(0, 0, 0);
                placed.push(carried);
                carried = null;
                robot.setVacuum(false);
                index++;
            }
            if (stepT >= step.dur) step = null;
        } else {
            stepT += dt;
            const s = Math.min(1, stepT / step.dur);
            tcp = interp(step.from, step.to, ease(s), step.lift || 0);
            if (s >= 1) {
                step = null;
                if (index >= 18 && queue.length === 0) fullTimer = 2.5;
            }
        }
        robot.setJoints(robot.solveIK(tcp));
    }

    return { group: cell, update, robot, stack: cab.stack, palletPosition: PALLET_POS.clone() };
}
