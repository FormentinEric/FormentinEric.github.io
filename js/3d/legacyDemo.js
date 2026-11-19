// TEMPORARY (phase 1): the original "Industrial Logic in Action" demo on r187 modules.
// Replaced by the digital twin in phase 2.
import * as THREE from 'three';
import { createStage } from './core/stage.js';
import { whenVisible, prefersReducedMotion } from './core/visible.js';
import { createLGV } from './models/lgv.js';
import { createLoadedPallet } from './models/props.js';

const CODE_LINES = [
    "<span class='keyword'>public class</span> <span class='type'>LgvController</span> {",
    "    <span class='keyword'>public void</span> <span class='method'>RouteLgv</span>(<span class='type'>Lgv</span> lgv, <span class='type'>Position</span> target) {",
    "        <span class='type'>Console</span>.<span class='method'>WriteLine</span>(<span class='string'>$\"Routing LGV {lgv.Id} to {target}...\"</span>);",
    "        <span class='keyword'>while</span> (lgv.Position != target) {",
    "            <span class='type'>Path</span> path = <span class='type'>PathFinder</span>.<span class='method'>Calculate</span>(lgv.Position, target);",
    "            lgv.<span class='method'>Move</span>(path.NextStep);",
    "            ",
    "            <span class='keyword'>if</span> (<span class='method'>CheckCollision</span>(lgv)) {",
    "                lgv.<span class='method'>Stop</span>();",
    "                <span class='type'>Logger</span>.<span class='method'>Warn</span>(<span class='string'>\"Collision detected!\"</span>);",
    "                <span class='method'>RecalculateRoute</span>(lgv);",
    "            }",
    "            <span class='keyword'>await</span> <span class='type'>Task</span>.<span class='method'>Delay</span>(<span class='number'>100</span>);",
    "        }",
    "        ",
    "        <span class='type'>Console</span>.<span class='method'>WriteLine</span>(<span class='string'>\"Target reached. Initiating operation.\"</span>);",
    "        lgv.<span class='method'>ExecutePalletOperation</span>();",
    "    }",
    "}",
];

function startCodeTyping(codeEl, panel) {
    // Static, trusted markup only (no user input reaches innerHTML).
    if (prefersReducedMotion()) {
        codeEl.innerHTML = CODE_LINES.join('<br>');
        return;
    }
    let line = 0, visible = false, timer = null;
    const body = panel.querySelector('.pc-body');
    const schedule = (fn, ms) => { timer = setTimeout(() => { timer = null; if (visible) fn(); }, ms); };
    function type() {
        if (line < CODE_LINES.length) {
            codeEl.innerHTML += CODE_LINES[line++] + '<br>';
            if (body) body.scrollTop = body.scrollHeight;
            schedule(type, 300 + Math.random() * 500);
        } else {
            schedule(() => { codeEl.innerHTML = ''; line = 0; type(); }, 8000);
        }
    }
    whenVisible(panel, () => { visible = true; if (!timer) schedule(type, 500); }, () => { visible = false; });
}

function buildScene(stage) {
    const { scene, camera } = stage;
    camera.position.set(9, 7.5, 9);
    camera.lookAt(0, 0.6, 0);
    scene.add(new THREE.HemisphereLight(0xb9c8ff, 0x1a1e26, 0.9));
    const key = new THREE.DirectionalLight(0xfff1e0, 2.2);
    key.position.set(6, 12, -3);
    key.castShadow = true;
    Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
    scene.add(key);
    scene.add(new THREE.GridHelper(20, 20, 0x334155, 0x1e293b));
    const shelfMat = new THREE.MeshLambertMaterial({ color: 0x3b82f6, wireframe: true, transparent: true, opacity: 0.4 });
    for (const x of [-4, 4]) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.5, 4, 6), shelfMat);
        shelf.position.set(x, 2, 0);
        scene.add(shelf);
    }
    const lgv = createLGV({ id: '02' });
    lgv.state.loaded = false;
    scene.add(lgv.group);
    const pallet = createLoadedPallet({ cols: 2, rows: 3, layers: 3, seed: 2 });
    pallet.rotation.y = Math.PI / 2;
    scene.add(pallet);
    return { lgv, pallet };
}

const STEPS = [
    { action: 'idle', target: [0, 0, 5] },
    { action: 'move', target: [0, 0, 0] },
    { action: 'turn', target: [-5, 0, 0] },
    { action: 'move', target: [-1, 0, 0] },
    { action: 'pickup' },
    { action: 'back', target: [0, 0, 0] },
    { action: 'turn', target: [5, 0, 0] },
    { action: 'move', target: [1, 0, 0] },
    { action: 'drop' },
    { action: 'back', target: [0, 0, 0] },
    { action: 'move', target: [0, 0, 5] },
];

export function mountLegacyDemo(container, codeEl, runner) {
    startCodeTyping(codeEl, codeEl.closest('.pc-mockup'));
    let stage;
    try {
        stage = createStage(container, { profile: 'medium', background: 0x0f172a });
    } catch {
        return { dispose() {} };   // no WebGL: the code panel keeps working
    }
    const { lgv, pallet } = buildScene(stage);
    const v = new THREE.Vector3();
    let step = 0, timer = 0;
    lgv.group.position.set(0, 0, 5);
    pallet.position.set(-2.55, 0, 0);

    const next = () => { step = (step + 1) % STEPS.length; timer = 0; };
    const face = (target, k) => {
        const from = lgv.group.quaternion.clone();
        lgv.group.lookAt(v.set(...target));
        const to = lgv.group.quaternion.clone();
        lgv.group.quaternion.copy(from).slerp(to, Math.min(1, k));
    };

    stage.onFrame((dt) => {
        const s = STEPS[step];
        const st = lgv.state;
        st.speed = 0;
        if (s.action === 'move' || s.action === 'back') {
            const to = v.set(...s.target).sub(lgv.group.position);
            const d = to.length();
            if (d > 0.03) {
                to.normalize();
                lgv.group.position.addScaledVector(to, Math.min(d, 1.6 * dt));
                st.speed = s.action === 'move' ? 1.6 : -1.6;
                if (s.action === 'move') face(lgv.group.position.clone().add(to).toArray(), 10 * dt);
            } else {
                lgv.group.position.set(...s.target);
                next();
            }
        } else if (s.action === 'turn') {
            face(s.target, 7 * dt);
            if ((timer += dt) > 0.7) { lgv.group.lookAt(v.set(...s.target)); next(); }
        } else if (s.action === 'pickup' || s.action === 'drop') {
            st.lift = Math.min(0.25, st.lift + 0.4 * dt);
            if ((timer += dt) > 0.8) {
                st.loaded = s.action === 'pickup';
                pallet.visible = !st.loaded;
                if (!st.loaded) pallet.position.set(2.55, 0, 0);
                st.lift = 0.12;
                next();
            }
        } else if ((timer += dt) > 1) {   // idle: reset the pallet on the left shelf
            pallet.position.set(-2.55, 0, 0);
            pallet.visible = true;
            next();
        }
        lgv.update(dt);
    });

    stage.renderOnce();
    if (!prefersReducedMotion()) {
        runner.register('demo', stage);
        whenVisible(container, () => runner.request('demo'), () => runner.release('demo'));
    }
    return { dispose: () => stage.dispose() };
}
