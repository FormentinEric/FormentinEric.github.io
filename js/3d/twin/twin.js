// Digital twin: wires the simulation (graph, traffic, missions, fleet) to the 3D plant and the UI panels.
import * as THREE from 'three';
import { createStage } from '../core/stage.js';
import { whenVisible, prefersReducedMotion } from '../core/visible.js';
import { NODES, EDGES, STATIONS, ZONES } from './layout.js';
import { createGraph } from './graph.js';
import { createTraffic } from './traffic.js';
import { createMissionManager } from './missions.js';
import { createFleet } from './fleet.js';
import { buildPlant } from './scene.js';
import { createCodePanel } from '../ui/codePanel.js';
import { createWatch } from '../ui/watch.js';
import { createLog } from '../ui/log.js';
import { createScadaBar } from '../ui/scadaBar.js';

const LGV_IDS = ['01', '02', '03'];
const OVERVIEW = { pos: [12, 17, 18], target: [-0.5, 0, 0.5] };
const FOLLOW_OFFSET = new THREE.Vector3(4.5, 4.2, 5.5);

/**
 * @param {HTMLElement} root  #twin: contains .twin-view (canvas), toolbar buttons and the panel containers
 * @param {{register, request, release}} runner  exclusive WebGL runner
 */
export function mountTwin(root, runner) {
    const view = root.querySelector('.twin-view');
    const stage = createStage(view, { profile: 'auto', orbit: true, background: 0x0a0f18 });
    const { camera, controls, canvas } = stage;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.minDistance = 3;
    controls.maxDistance = 48;

    // ---------- simulation ----------
    const graph = createGraph(NODES, EDGES);
    const traffic = createTraffic(ZONES);
    const missions = createMissionManager({ graph, stations: STATIONS });

    // ---------- UI panels ----------
    const code = createCodePanel(root.querySelector('.twin-code'));
    const watch = createWatch(root.querySelector('.twin-watch'));
    const log = createLog(root.querySelector('.twin-log'), { max: 8 });
    const scada = createScadaBar(root.querySelector('.twin-scada'));
    const drops = [];   // simulated times of completed deliveries (missions/h)

    let fleet = null;
    const plant = buildPlant(stage, {
        lgvIds: LGV_IDS,
        onPalletReady: (s) => missions.palletReady(s),
        onPalletAtOut: () => missions.palletAvailableAtOut(),
        onLog: (e) => log.push({ t: fleet ? fleet.time() : 0, ...e }),
    });
    fleet = createFleet({
        graph, traffic, missions, stations: STATIONS, lgvIds: LGV_IDS, batteries: [0.92, 0.64, 0.38], seed: 42,
        onEvent: (e) => {
            plant.handle(e);
            if (e.type === 'drop') drops.push(e.t);
            if (e.type !== 'zone') log.push(e);          // zone reservations are too chatty for the log
        },
    });

    // ---------- selection ----------
    let selected = '02';
    const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.15, 1.3, 64).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.85, depthWrite: false }),
    );
    ring.position.y = 0.012;
    stage.scene.add(ring);
    const lgvButtons = [...root.querySelectorAll('[data-lgv]')];
    function select(id) {
        if (!LGV_IDS.includes(id)) return;
        selected = id;
        fleet.select(id);
        for (const b of lgvButtons) b.setAttribute('aria-pressed', String(b.dataset.lgv === id));
        watch.update(fleet.snapshot().find((s) => s.id === id), true);
        if (mode === 'follow') setMode('follow');      // glide to the newly selected LGV
    }

    const raycaster = new THREE.Raycaster();
    let down = null;
    canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
    canvas.addEventListener('pointerup', (e) => {
        if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;   // it was an orbit drag
        const r = canvas.getBoundingClientRect();
        raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
        for (const [id, m] of plant.lgvs) {
            if (raycaster.intersectObject(m.group, true).length) { select(id); return; }
        }
    });

    // ---------- camera modes ----------
    let mode = 'overview';
    let tween = null;
    const modeButtons = [...root.querySelectorAll('[data-twin="overview"], [data-twin="follow"]')];
    function overviewPose() {
        const scale = Math.pow(Math.max(1, 1.75 / camera.aspect), 0.9);
        const target = new THREE.Vector3(...OVERVIEW.target);
        return { target, pos: new THREE.Vector3(...OVERVIEW.pos).sub(target).multiplyScalar(scale).add(target) };
    }
    function setMode(m) {
        mode = m;
        for (const b of modeButtons) b.setAttribute('aria-pressed', String(b.dataset.twin === m));
        let goal;
        if (m === 'overview') goal = overviewPose();
        else {
            const s = plant.lgvs.get(selected).group.position;
            const target = new THREE.Vector3(s.x, 0.9, s.z);
            goal = { target, pos: target.clone().add(FOLLOW_OFFSET) };
        }
        tween = { p0: camera.position.clone(), t0: controls.target.clone(), p1: goal.pos, t1: goal.target, k: 0 };
    }
    const first = overviewPose();
    camera.position.copy(first.pos);
    controls.target.copy(first.target);
    controls.update();
    let userMoved = false;
    controls.addEventListener('start', () => { userMoved = true; tween = null; });
    new ResizeObserver(() => {
        if (mode === 'overview' && !userMoved) {
            const p = overviewPose();
            camera.position.copy(p.pos);
            controls.target.copy(p.target);
        }
    }).observe(view);

    // ---------- toolbar & keyboard ----------
    let paused = false;
    const pauseBtn = root.querySelector('[data-twin="pause"]');
    function togglePause() {
        paused = !paused;
        pauseBtn.setAttribute('aria-pressed', String(paused));
        pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    }
    root.querySelector('.twin-toolbar').addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.twin === 'pause') togglePause();
        else if (b.dataset.twin) setMode(b.dataset.twin);
        else if (b.dataset.lgv) select(b.dataset.lgv);
    });
    root.addEventListener('keydown', (e) => {
        if (e.target.closest('button')) return;          // buttons handle their own Enter/Space
        const k = e.key.toLowerCase();
        if (['1', '2', '3'].includes(k)) select(LGV_IDS[Number(k) - 1]);
        else if (k === 'f') setMode('follow');
        else if (k === 'escape') setMode('overview');
        else if (k === 'p') togglePause();
        else return;
        e.preventDefault();
    });

    // mobile tabs (Code / Watch / Log)
    const tabs = [...root.querySelectorAll('[data-tab]')];
    for (const t of tabs) {
        t.addEventListener('click', () => {
            root.dataset.tab = t.dataset.tab;
            for (const o of tabs) o.setAttribute('aria-selected', String(o === t));
        });
    }

    // ---------- frame ----------
    const followPrev = new THREE.Vector3();
    function frame(dt) {
        if (!paused) fleet.step(dt);
        const snap = fleet.snapshot();
        plant.update(paused ? 0 : dt, snap, traffic.snapshot());
        const sel = snap.find((s) => s.id === selected);
        ring.position.x = sel.x;
        ring.position.z = sel.z;
        code.setState(sel.state);
        watch.update(sel);
        const t = fleet.time();
        while (drops.length && drops[0] < t - 600) drops.shift();
        scada.update({
            missionsPerHour: (drops.length * 3600) / Math.max(60, Math.min(600, t)),
            online: `${snap.length}/${snap.length}`,
            alarms: snap.filter((s) => s.state === 'Alarm').length,
            asrsFill: plant.stored() / plant.capacity,
        });
        if (tween) {
            tween.k = Math.min(1, tween.k + dt / 1.1);
            const k = 1 - Math.pow(1 - tween.k, 3);
            camera.position.lerpVectors(tween.p0, tween.p1, k);
            controls.target.lerpVectors(tween.t0, tween.t1, k);
            if (tween.k >= 1) { tween = null; followPrev.copy(plant.lgvs.get(selected).group.position); }
        } else if (mode === 'follow') {
            // shift camera and target by the LGV displacement: the user can still orbit and zoom
            const p = plant.lgvs.get(selected).group.position;
            const d = p.clone().sub(followPrev);
            followPrev.copy(p);
            camera.position.add(d);
            controls.target.add(d);
        }
    }
    stage.onFrame(frame);

    if (new URLSearchParams(location.search).has('debug3d')) window.__twin = { stage, fleet, traffic, plant, select, setMode, frame };

    select(selected);
    frame(0);
    stage.renderOnce();
    if (!prefersReducedMotion()) {
        runner.register('twin', stage);
        whenVisible(view, () => runner.request('twin'), () => runner.release('twin'));
    }

    return { stage, fleet, plant, select, dispose: () => stage.dispose() };
}
