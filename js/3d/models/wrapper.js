// Rotating-ring stretch wrapper for line 2 (procedural). The pallet sits at the origin of the group.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { materials } from '../core/materials.js';
import { mergeStatic } from '../core/merge.js';

function mesh(geo, mat, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
}

export function createWrapper() {
    const M = materials();
    const group = new THREE.Group();
    group.name = 'StretchWrapper';
    const S = 1.25;          // half side of the frame
    const H = 3.2;

    // frame: 4 posts + top ring frame + cross beams
    for (const [x, z] of [[-S, -S], [S, -S], [-S, S], [S, S]]) {
        group.add(mesh(new THREE.BoxGeometry(0.14, H, 0.14), M.rackBlue, x, H / 2, z));
        group.add(mesh(new THREE.BoxGeometry(0.3, 0.02, 0.3), M.steelDark, x, 0.01, z));
    }
    for (const [x, z, w, d] of [[0, -S, 2 * S + 0.14, 0.14], [0, S, 2 * S + 0.14, 0.14], [-S, 0, 0.14, 2 * S], [S, 0, 0.14, 2 * S]]) {
        group.add(mesh(new THREE.BoxGeometry(w, 0.16, d), M.rackBlue, x, H, z));
    }
    group.add(mesh(new RoundedBoxGeometry(0.7, 0.35, 0.7, 2, 0.04), M.cabinetGrey, 0, H + 0.2, 0));    // ring drive
    // control panel with stack light
    group.add(mesh(new RoundedBoxGeometry(0.5, 1.4, 0.3, 2, 0.03), M.cabinetGrey, S + 0.55, 0.7, -S + 0.3));
    group.add(mesh(new THREE.BoxGeometry(0.2, 0.06, 0.01), M.ledGreen, S + 0.55, 1.15, -S + 0.46));
    const stack = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.22, 16), M.ledGreen, S + 0.55, 1.55, -S + 0.3);
    group.add(stack);

    // moving ring with the film carriage
    const ring = new THREE.Group();
    ring.add(mesh(new THREE.TorusGeometry(1.05, 0.045, 10, 64).rotateX(Math.PI / 2), M.aluminium));
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        const arm = mesh(new THREE.BoxGeometry(0.08, 0.06, 0.25), M.steelDark, Math.cos(a) * (S - 0.12), 0, Math.sin(a) * (S - 0.12));
        arm.rotation.y = -a;
        ring.add(arm);
    }
    const spinner = new THREE.Group();
    const carriage = new THREE.Group();
    carriage.add(mesh(new RoundedBoxGeometry(0.22, 0.45, 0.16, 2, 0.02), M.lgvYellow, 0, 0, 0));
    carriage.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.42, 20), new THREE.MeshStandardMaterial({ color: 0xe8eef3, roughness: 0.25, metalness: 0.1 }), -0.13, 0, 0));
    carriage.position.set(1.05, 0, 0);
    spinner.add(carriage);
    ring.add(spinner);
    group.add(ring);

    // film being applied (grows from the bottom while the ring rises)
    const film = mesh(new RoundedBoxGeometry(0.84, 1, 1.24, 2, 0.02), M.stretchWrap, 0, 0, 0);
    film.castShadow = false;
    film.visible = false;
    group.add(film);

    mergeStatic(group, [ring, film, stack]);
    mergeStatic(ring, [spinner]);

    let job = null;
    const LOAD_H = 1.03;   // pallet + 3 layers

    function update(dt) {
        if (!job) {
            ring.position.y = THREE.MathUtils.lerp(ring.position.y, 0.25, Math.min(1, dt * 2));
            stack.material = M.ledGreen;
            return;
        }
        job.t += dt;
        const k = Math.min(1, job.t / job.seconds);
        // ring goes up and back down; film height follows the highest point reached
        const up = k < 0.6 ? k / 0.6 : 1 - (k - 0.6) / 0.4 * 0.35;
        ring.position.y = 0.2 + up * (LOAD_H + 0.05);
        spinner.rotation.y += dt * 4.2;
        job.top = Math.max(job.top, ring.position.y);
        film.visible = true;
        film.scale.y = Math.max(0.05, job.top);
        film.position.y = film.scale.y / 2;
        stack.material = M.ledAmber;
        if (k >= 1) {
            film.visible = false;
            const j = job;
            job = null;
            j.onDone?.();
        }
    }

    return {
        group,
        update,
        busy: () => !!job,
        /** Animate wrapping for `seconds`, then call onDone (the caller shows the load's own film). */
        wrap(seconds = 12, onDone) { job = { t: 0, seconds, onDone, top: 0 }; },
    };
}
