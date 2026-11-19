// Interactive LGV simulator (gameplay unchanged from block 1, now on r187 modules + new LGV model).
import * as THREE from 'three';
import { createStage } from './core/stage.js';
import { whenVisible } from './core/visible.js';
import { createLGV } from './models/lgv.js';
import { createLoadedPallet } from './models/props.js';
import { nextTask } from './core/yield.js';

const BOUNDARY = 9.0;
const LGV_SPEED = 9;      // units per second
const TURN_SPEED = 3;     // radians per second
const FORK_CENTER = 1.55; // distance from LGV origin to the load centre (forks on -Z)
const CRASH_MESSAGES = [
    "Whoops! Racks don't yield!",
    'OSHA wants to know your location.',
    "That wasn't in the routing logic...",
    'Looks like we need to debug your driving.',
    'Did your LGV license expire?',
];
const KEY_MAP = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };

export async function mountGame(container, runner) {
    const stage = createStage(container, { profile: 'low', post: false, background: 0x0a0f1c });
    const { scene, camera } = stage;
    camera.position.set(0, 15, 15);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.HemisphereLight(0xb9c8ff, 0x1a1e26, 1.0));
    const key = new THREE.DirectionalLight(0xfff1e0, 2.0);
    key.position.set(5, 20, 10);
    key.castShadow = true;
    Object.assign(key.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11 });
    scene.add(key);
    scene.add(new THREE.GridHelper(20, 20, 0x334155, 0x1e293b));

    // racks (obstacles)
    const racks = [];
    const shelfGeo = new THREE.BoxGeometry(2, 4, 6);
    const shelfMat = new THREE.MeshLambertMaterial({ color: 0x3b82f6, wireframe: true, transparent: true, opacity: 0.4 });
    const addRack = (x, z, rotY = 0) => {
        const rack = new THREE.Mesh(shelfGeo, shelfMat);
        rack.position.set(x, 2, z);
        rack.rotation.y = rotY;
        scene.add(rack);
        const w = rotY === 0 ? 2 : 6, d = rotY === 0 ? 6 : 2, pad = 1.4;
        racks.push({ minX: x - w / 2 - pad, maxX: x + w / 2 + pad, minZ: z - d / 2 - pad, maxZ: z + d / 2 + pad });
    };
    addRack(-6, 0);
    addRack(6, 0);
    addRack(0, -7, Math.PI / 2);

    // drop zones
    const zoneMat = new THREE.MeshBasicMaterial({ color: 0x0ea5e9, wireframe: true, transparent: true, opacity: 0.3 });
    const zoneGeo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    for (const [x, z] of [[-5, -5], [5, -5]]) {
        const zone = new THREE.Mesh(zoneGeo, zoneMat);
        zone.position.set(x, 0.01, z);
        scene.add(zone);
    }

    await nextTask();
    const lgv = createLGV({ id: '01', forksSide: -1 });
    lgv.state.loaded = false;
    lgv.group.position.set(0, 0, 5);
    scene.add(lgv.group);
    const pallet = createLoadedPallet({ cols: 2, rows: 3, layers: 3, seed: 1 });
    scene.add(pallet);

    let carrying = false;
    let angle = Math.PI;
    let crashTime = -10, time = 0;
    const keys = { up: false, down: false, left: false, right: false };
    const status = document.getElementById('game-status');
    const setStatus = (msg, error = false) => { status.textContent = msg; status.classList.toggle('is-error', error); };
    const forkCentre = () => new THREE.Vector3(-Math.sin(angle) * FORK_CENTER, 0, -Math.cos(angle) * FORK_CENTER).add(lgv.group.position);

    function togglePallet() {
        if (carrying) {
            carrying = false;
            pallet.position.copy(forkCentre());
            pallet.rotation.y = angle;
            pallet.visible = true;
            setStatus('Pallet dropped successfully.');
        } else if (forkCentre().distanceTo(new THREE.Vector3(pallet.position.x, 0, pallet.position.z)) < 1.5) {
            carrying = true;
            pallet.visible = false;
            setStatus('Pallet picked up.');
        } else {
            setStatus('Too far from pallet to pick up!', true);
        }
        lgv.state.loaded = carrying;
        lgv.state.lift = carrying ? 0.2 : 0.12;
    }

    // on-screen buttons (mouse, touch, keyboard Enter/Space)
    const bind = (id, k) => {
        const btn = document.getElementById(id);
        const on = (e) => { if (e.cancelable) e.preventDefault(); keys[k] = true; };
        const off = (e) => { if (e.cancelable) e.preventDefault(); keys[k] = false; };
        btn.addEventListener('mousedown', on);
        btn.addEventListener('mouseup', off);
        btn.addEventListener('mouseleave', off);
        btn.addEventListener('touchstart', on, { passive: false });
        btn.addEventListener('touchend', off, { passive: false });
        btn.addEventListener('touchcancel', off, { passive: false });
        btn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') on(e); });
        btn.addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') off(e); });
        btn.addEventListener('blur', () => { keys[k] = false; });
    };
    bind('btn-up', 'up');
    bind('btn-down', 'down');
    bind('btn-left', 'left');
    bind('btn-right', 'right');
    document.getElementById('btn-action').addEventListener('click', togglePallet);

    // keyboard only while the simulator has focus
    container.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        if (KEY_MAP[k]) { keys[KEY_MAP[k]] = true; e.preventDefault(); }
        else if (k === ' ' || k === 'enter') { e.preventDefault(); if (!e.repeat) togglePallet(); }
    });
    container.addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); if (KEY_MAP[k]) keys[KEY_MAP[k]] = false; });
    container.addEventListener('blur', () => { keys.up = keys.down = keys.left = keys.right = false; });

    stage.onFrame((dt) => {
        time += dt;
        if (keys.left) angle += TURN_SPEED * dt;
        if (keys.right) angle -= TURN_SPEED * dt;
        lgv.group.rotation.y = angle;
        // travel direction: body forward is +Z of the group (forks are on -Z)
        const dirX = Math.sin(angle), dirZ = Math.cos(angle);
        let speed = 0;
        if (keys.up) speed = LGV_SPEED;
        if (keys.down) speed = -LGV_SPEED * 0.5;
        let nx = lgv.group.position.x + dirX * speed * dt;
        let nz = lgv.group.position.z + dirZ * speed * dt;
        const hit = racks.some((r) => nx > r.minX && nx < r.maxX && nz > r.minZ && nz < r.maxZ);
        if (hit && time - crashTime > 3) {
            setStatus(CRASH_MESSAGES[Math.floor(Math.random() * CRASH_MESSAGES.length)], true);
            crashTime = time;
        }
        nx = THREE.MathUtils.clamp(nx, -BOUNDARY, BOUNDARY);
        nz = THREE.MathUtils.clamp(nz, -BOUNDARY, BOUNDARY);
        if (!hit) {
            lgv.group.position.set(nx, 0, nz);
            if (speed && time - crashTime > 3 && status.textContent.includes('Too far')) setStatus('System Online. Awaiting commands.');
        }
        // wheels turn with the body's direction: model forward (+Z) is reversed by forksSide -1
        lgv.state.speed = hit ? 0 : -speed;
        lgv.update(dt);
    });

    await stage.renderer.compileAsync(scene, camera);
    stage.renderOnce();
    runner.register('game', stage);
    whenVisible(container, () => runner.request('game'), () => runner.release('game'));
    return { dispose: () => stage.dispose() };
}
