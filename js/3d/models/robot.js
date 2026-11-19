// Detailed 6-axis industrial robot with vacuum palletizing gripper and analytic IK.
// Local frame: origin on the floor at the robot base centre, +Y up. Units: metres.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { materials } from '../core/materials.js';
import { labelTexture } from '../core/textures.js';
import { mergeStatic } from '../core/merge.js';

// Kinematic constants
const J1_Y = 0.72;               // pedestal + base height
const SHOULDER = new THREE.Vector3(0, 0.55, 0.25); // J2 axis in J1 frame
const L1 = 1.2;                  // lower arm (J2 → J3)
const L2 = 1.25;                 // forearm (J3 → wrist centre)
const J4_OFFSET = 0.3;
const J6_OFFSET = 0.13;          // wrist centre → flange
const TOOL_LEN = 0.28;           // flange → suction cup lips
export const WRIST_TO_TIP = J6_OFFSET + TOOL_LEN;
const H0 = J1_Y + SHOULDER.y;
const A1 = SHOULDER.z;

function mesh(geo, mat, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
}
const alongX = (geo) => geo.rotateZ(Math.PI / 2);
const alongZ = (geo) => geo.rotateX(Math.PI / 2);

function lathe(points, mat, segments = 64) {
    return mesh(new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments), mat);
}

function motor(M, radius, length, axis = 'x') {
    const g = new THREE.Group();
    const body = new THREE.CylinderGeometry(radius, radius, length, 32);
    const cap = new THREE.CylinderGeometry(radius * 1.04, radius * 1.04, length * 0.12, 32);
    const gland = new THREE.CylinderGeometry(radius * 0.18, radius * 0.18, radius * 0.5, 12);
    g.add(mesh(body, M.motor));
    g.add(mesh(cap, M.aluminium, 0, length / 2, 0));
    for (let i = 0; i < 3; i++) {
        g.add(mesh(new THREE.TorusGeometry(radius * 1.005, radius * 0.03, 6, 32).rotateX(Math.PI / 2), M.steelWorn, 0, -length * 0.3 + i * length * 0.18, 0));
    }
    g.add(mesh(gland, M.plasticBlack, radius * 0.6, length * 0.2, radius * 0.9));
    if (axis === 'x') g.rotation.z = -Math.PI / 2;
    if (axis === 'z') g.rotation.x = Math.PI / 2;
    return g;
}

// Lower arm: tapered link with round ends, extruded across X.
function linkGeometry(length, r0, r1, thickness) {
    const s = new THREE.Shape();
    s.moveTo(r0, 0);
    s.lineTo(r1, length);
    s.absarc(0, length, r1, 0, Math.PI, false);
    s.lineTo(-r0, 0);
    s.absarc(0, 0, r0, Math.PI, Math.PI * 2, false);
    const geo = new THREE.ExtrudeGeometry(s, { depth: thickness, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 4, curveSegments: 24 });
    geo.translate(0, 0, -thickness / 2);
    geo.rotateY(-Math.PI / 2);
    return geo;
}

export function createRobot() {
    const M = materials();
    const white = M.robotWhite.clone();
    white.side = THREE.DoubleSide;
    const root = new THREE.Group();
    root.name = 'Robot-R6';

    // ---------- pedestal & fixed base ----------
    root.add(mesh(new THREE.BoxGeometry(1.1, 0.03, 1.1), M.steelDark, 0, 0.015, 0));
    for (const [x, z] of [[-0.48, -0.48], [0.48, -0.48], [-0.48, 0.48], [0.48, 0.48]]) {
        root.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 6), M.chrome, x, 0.05, z));
        root.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.08, 8), M.steelWorn, x, 0.07, z));
    }
    root.add(mesh(new RoundedBoxGeometry(0.82, 0.47, 0.82, 3, 0.03), M.cabinetGrey, 0, 0.265, 0));
    root.add(mesh(new THREE.BoxGeometry(0.84, 0.02, 0.84), M.steelDark, 0, 0.49, 0));
    const base = lathe([[0, 0.5], [0.46, 0.5], [0.46, 0.55], [0.43, 0.58], [0.41, 0.7], [0.37, 0.72], [0, 0.72]], white);
    root.add(base);
    root.add(mesh(new THREE.TorusGeometry(0.415, 0.007, 8, 96).rotateX(Math.PI / 2), M.ledCyan, 0, 0.705, 0));
    const conn = mesh(new RoundedBoxGeometry(0.26, 0.15, 0.12, 2, 0.02), M.motor, 0, 0.6, -0.47);
    root.add(conn);
    for (const x of [-0.06, 0.06]) root.add(mesh(alongZ(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 16)), M.aluminium, x, 0.6, -0.56));

    // ---------- J1 turret ----------
    const j1 = new THREE.Group();
    j1.position.y = J1_Y;
    root.add(j1);
    j1.add(lathe([[0, 0], [0.4, 0], [0.4, 0.05], [0.36, 0.11], [0, 0.11]], white));
    j1.add(mesh(new RoundedBoxGeometry(0.56, 0.46, 0.62, 3, 0.09), white, 0, 0.36, 0.04));
    const m2 = motor(M, 0.12, 0.24, 'x');
    m2.position.set(0.4, SHOULDER.y, SHOULDER.z);
    j1.add(m2);
    const m1 = motor(M, 0.09, 0.2, 'y');
    m1.position.set(0.12, 0.48, -0.26);
    j1.add(m1);
    // balancer anchor on the turret
    const balA = new THREE.Vector3(-0.33, 0.86, -0.12);
    j1.add(mesh(alongX(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 16)), M.steelDark, balA.x, balA.y, balA.z));

    // ---------- J2 lower arm ----------
    const j2 = new THREE.Group();
    j2.position.copy(SHOULDER);
    j1.add(j2);
    j2.add(mesh(alongX(new THREE.CylinderGeometry(0.21, 0.21, 0.36, 40)), white, -0.12, 0, 0));
    j2.add(mesh(alongX(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 32)), M.motor, -0.31, 0, 0));
    j2.add(mesh(linkGeometry(L1, 0.19, 0.15, 0.22), white, -0.15, 0, 0));
    const stripe = mesh(new THREE.BoxGeometry(0.006, 0.72, 0.028), M.ledCyan, -0.293, 0.55, 0);
    j2.add(stripe);
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.13),
        new THREE.MeshStandardMaterial({ map: labelTexture('EF-R6', { font: '900 120px Outfit, Arial, sans-serif', color: '#2b2f36' }), transparent: true, polygonOffset: true, polygonOffsetFactor: -2 }));
    decal.position.set(-0.294, 0.95, 0);
    decal.rotation.set(0, -Math.PI / 2, Math.PI / 2);
    j2.add(decal);
    const balB = new THREE.Vector3(-0.33, 0.5, -0.12); // balancer anchor on the arm (J2 frame)
    j2.add(mesh(alongX(new THREE.CylinderGeometry(0.045, 0.045, 0.1, 16)), M.steelDark, balB.x, balB.y, balB.z + 0.0));

    // gas-spring balancer (housing + chrome rod), oriented every frame
    const balHousing = mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 24), M.motor);
    const balRod = mesh(new THREE.CylinderGeometry(0.024, 0.024, 1, 16), M.chrome);
    j1.add(balHousing, balRod);

    // ---------- J3 elbow + forearm ----------
    const j3 = new THREE.Group();
    j3.position.set(0, L1, 0);
    j2.add(j3);
    j3.add(mesh(alongX(new THREE.CylinderGeometry(0.17, 0.17, 0.46, 40)), white, -0.08, 0, 0));
    const m3 = motor(M, 0.1, 0.2, 'x');
    m3.position.set(0.25, 0, 0);
    j3.add(m3);
    j3.add(mesh(new RoundedBoxGeometry(0.3, 0.3, 0.56, 3, 0.08), white, 0, 0.02, 0.06));
    const m4 = motor(M, 0.085, 0.22, 'z');
    m4.position.set(0, 0.05, -0.32);
    m4.rotation.x = -Math.PI / 2;
    j3.add(m4);
    for (const x of [-0.1, 0.1]) {
        const mm = motor(M, 0.055, 0.17, 'z');
        mm.position.set(x, -0.09, -0.28);
        mm.rotation.x = -Math.PI / 2;
        j3.add(mm);
    }

    const j4 = new THREE.Group();
    j4.position.z = J4_OFFSET;
    j3.add(j4);
    j4.add(mesh(alongZ(new THREE.CylinderGeometry(0.085, 0.115, 0.7, 36)), white, 0, 0, 0.36));
    j4.add(mesh(new THREE.TorusGeometry(0.1, 0.006, 8, 48), M.ledCyan, 0, 0, 0.1));
    for (const x of [-0.11, 0.11]) j4.add(mesh(new RoundedBoxGeometry(0.03, 0.17, 0.24, 2, 0.012), white, x, 0, L2 - J4_OFFSET - 0.08));

    // ---------- J5 wrist, J6 flange, gripper ----------
    const j5 = new THREE.Group();
    j5.position.z = L2 - J4_OFFSET;
    j4.add(j5);
    j5.add(mesh(alongX(new THREE.CylinderGeometry(0.085, 0.085, 0.19, 32)), white));
    for (const x of [-0.1, 0.1]) j5.add(mesh(alongX(new THREE.CylinderGeometry(0.088, 0.088, 0.02, 32)), M.motor, x, 0, 0));

    const j6 = new THREE.Group();
    j6.position.z = J6_OFFSET;
    j5.add(j6);
    j6.add(mesh(alongZ(new THREE.CylinderGeometry(0.065, 0.065, 0.03, 32)), M.aluminium, 0, 0, -0.03));

    const tool = new THREE.Group();
    j6.add(tool);
    tool.add(mesh(alongZ(new THREE.CylinderGeometry(0.08, 0.08, 0.03, 32)), M.steelDark, 0, 0, 0.0));
    tool.add(mesh(new THREE.BoxGeometry(0.06, 0.06, 0.15), M.aluminium, 0, 0, 0.09));
    tool.add(mesh(new RoundedBoxGeometry(0.42, 0.42, 0.035, 2, 0.008), M.plasticBlack, 0, 0, 0.19));
    for (const y of [-0.17, 0.17]) tool.add(mesh(new THREE.BoxGeometry(0.42, 0.03, 0.03), M.aluminium, 0, y, 0.158));
    for (const x of [-0.17, 0.17]) tool.add(mesh(new THREE.BoxGeometry(0.03, 0.42, 0.03), M.aluminium, x, 0, 0.158));
    const ejector = new THREE.Group();
    ejector.add(mesh(new RoundedBoxGeometry(0.13, 0.07, 0.05, 2, 0.01), M.rackBlue));
    const vacLed = mesh(new THREE.BoxGeometry(0.02, 0.012, 0.006), M.lampOff, 0.04, 0, -0.027);
    ejector.add(vacLed);
    ejector.position.set(0.1, 0.1, 0.14);
    tool.add(ejector);
    const bellow = new THREE.CylinderGeometry(0.02, 0.02, 0.04, 16);
    alongZ(bellow);
    const lip = new THREE.CylinderGeometry(0.022, 0.036, 0.022, 20);
    alongZ(lip);
    for (let i = -1; i <= 1; i++) for (let k = -1; k <= 1; k++) {
        tool.add(mesh(bellow, M.rubber, i * 0.13, k * 0.13, 0.228));
        tool.add(mesh(lip, M.rubber, i * 0.13, k * 0.13, TOOL_LEN - 0.011));
    }
    const hoseCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.1, 0.1, 0.12), new THREE.Vector3(0.12, 0.05, 0.03), new THREE.Vector3(0.07, 0.0, -0.06), new THREE.Vector3(0.02, 0.06, -0.12),
    ]);
    tool.add(mesh(new THREE.TubeGeometry(hoseCurve, 20, 0.01, 8), M.hose));

    const tcp = new THREE.Object3D();    // tool centre point at the cup lips
    tcp.position.z = TOOL_LEN;
    tool.add(tcp);

    // ---------- dress pack (corrugated hose following the arm) ----------
    const anchors = [
        [j1, new THREE.Vector3(0.0, 0.62, -0.32)],
        [j2, new THREE.Vector3(0.05, 0.45, -0.24)],
        [j3, new THREE.Vector3(0.0, 0.22, -0.18)],
        [j4, new THREE.Vector3(0.0, 0.16, 0.45)],
        [j4, new THREE.Vector3(0.0, 0.12, L2 - J4_OFFSET - 0.12)],
    ].map(([parent, p]) => {
        const o = new THREE.Object3D();
        o.position.copy(p);
        parent.add(o);
        return o;
    });
    const dressPack = mesh(new THREE.BufferGeometry(), M.hose);
    root.add(dressPack);
    const v = new THREE.Vector3();

    // ---------- joints ----------
    const joints = [0, 0, 0, 0, 0, 0];
    function setJoints(q) {
        for (let i = 0; i < 6; i++) joints[i] = q[i];
        j1.rotation.y = q[0];
        j2.rotation.x = q[1];
        j3.rotation.x = q[2];
        j4.rotation.z = q[3];
        j5.rotation.x = q[4];
        j6.rotation.z = q[5];
        root.updateMatrixWorld(true);

        // balancer between turret anchor and arm anchor (in J1 frame)
        const a = balA;
        const b = balB.clone().applyEuler(new THREE.Euler(q[1], 0, 0)).add(SHOULDER);
        const dir = b.clone().sub(a);
        const len = dir.length();
        dir.normalize();
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        const hLen = 0.42;
        balHousing.quaternion.copy(quat);
        balHousing.scale.set(1, hLen, 1);
        balHousing.position.copy(a).addScaledVector(dir, hLen / 2);
        balRod.quaternion.copy(quat);
        balRod.scale.set(1, len, 1);
        balRod.position.copy(a).addScaledVector(dir, len / 2);

        // dress pack hose (anchors converted to robot-local space)
        const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
        const pts = anchors.map((o) => o.getWorldPosition(v.clone()).applyMatrix4(inv));
        dressPack.geometry.dispose();
        dressPack.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.034, 10);
    }

    /** Tool pointing straight down, cup lips at `target` (robot-local). Returns joint angles. */
    function solveIK(target, yaw = 0) {
        const q1 = Math.atan2(target.x, target.z);
        const r = Math.hypot(target.x, target.z);
        const wx = r, wy = target.y + WRIST_TO_TIP;
        const dx = wx - A1, dy = wy - H0;
        const D = THREE.MathUtils.clamp(Math.hypot(dx, dy), Math.abs(L1 - L2) + 1e-3, L1 + L2 - 1e-3);
        const alpha = Math.atan2(dy, dx);
        const beta = Math.acos((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D));
        const psi1 = alpha + beta;                       // lower arm angle from horizontal (elbow up)
        const q2 = Math.PI / 2 - psi1;
        const ex = A1 + L1 * Math.cos(psi1), ey = H0 + L1 * Math.sin(psi1);
        const phi = -Math.atan2(wy - ey, wx - ex);       // forearm pitch below horizontal
        const q3 = phi - q2;
        const q5 = Math.PI / 2 - phi;
        const q6 = q1 - yaw;
        return [q1, q2, q3, 0, q5, q6];
    }

    function setVacuum(on) {
        vacLed.material = on ? M.ledGreen : M.lampOff;
    }

    // one merged mesh per material for each rigid link
    mergeStatic(root, [j1, dressPack]);
    mergeStatic(j1, [j2, balHousing, balRod]);
    mergeStatic(j2, [j3]);
    mergeStatic(j3, [j4]);
    mergeStatic(j4, [j5]);
    mergeStatic(j5, [j6]);
    mergeStatic(j6, [vacLed]);

    setJoints(solveIK(new THREE.Vector3(0, 1.4, 1.6)));
    return { group: root, setJoints, solveIK, tcp, joints, setVacuum };
}
