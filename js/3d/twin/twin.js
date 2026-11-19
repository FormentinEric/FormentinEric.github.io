// Digital twin: wires the simulation (graph, traffic, missions, fleet) to the 3D plant and the UI.
import { createStage } from '../core/stage.js';
import { whenVisible, prefersReducedMotion } from '../core/visible.js';
import { NODES, EDGES, STATIONS, ZONES } from './layout.js';
import { createGraph } from './graph.js';
import { createTraffic } from './traffic.js';
import { createMissionManager } from './missions.js';
import { createFleet } from './fleet.js';
import { buildPlant } from './scene.js';

const LGV_IDS = ['01', '02', '03'];
const OVERVIEW = { pos: [12, 17, 18], target: [-0.5, 0, 0.5] };

/**
 * @param {HTMLElement} root  element with a `.twin-view` child (receives the canvas)
 * @param {{register, request, release}} runner  exclusive WebGL runner
 * @param {{onEvent?: Function, onFrame?: Function}} hooks  UI hooks (log, panels)
 */
export function mountTwin(root, runner, hooks = {}) {
    const view = root.querySelector('.twin-view');
    const stage = createStage(view, { profile: 'auto', orbit: true, background: 0x0a0f18 });
    const { camera, controls } = stage;
    // overview framed for a 16:9 view; narrower views move the camera back so the whole plant fits
    function fitOverview() {
        const scale = Math.pow(Math.max(1, 1.75 / camera.aspect), 0.9);
        controls.target.set(...OVERVIEW.target);
        camera.position.set(...OVERVIEW.pos).sub(controls.target).multiplyScalar(scale).add(controls.target);
    }
    fitOverview();
    let userMoved = false;
    controls.addEventListener('start', () => { userMoved = true; });
    new ResizeObserver(() => { if (!userMoved) { fitOverview(); controls.update(); } }).observe(view);
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.minDistance = 3;
    controls.maxDistance = 45;
    controls.update();

    const graph = createGraph(NODES, EDGES);
    const traffic = createTraffic(ZONES);
    const missions = createMissionManager({ graph, stations: STATIONS });
    const emit = (e) => hooks.onEvent?.(e);
    const plant = buildPlant(stage, {
        lgvIds: LGV_IDS,
        onPalletReady: (s) => missions.palletReady(s),
        onPalletAtOut: () => missions.palletAvailableAtOut(),
        onLog: (e) => emit({ t: fleet.time(), lgv: null, ...e }),
    });
    const fleet = createFleet({
        graph, traffic, missions, stations: STATIONS, lgvIds: LGV_IDS, batteries: [0.92, 0.64, 0.38], seed: 42,
        onEvent: (e) => { plant.handle(e); emit(e); },
    });

    let paused = false;
    stage.onFrame((dt) => {
        if (!paused) fleet.step(dt);
        plant.update(paused ? 0 : dt, fleet.snapshot(), traffic.snapshot());
        hooks.onFrame?.({ fleet, plant, stage });
    });

    if (new URLSearchParams(location.search).has('debug3d')) window.__twin = { stage, fleet, traffic, plant };

    plant.update(0, fleet.snapshot(), traffic.snapshot());
    stage.renderOnce();
    if (!prefersReducedMotion()) {
        runner.register('twin', stage);
        whenVisible(view, () => runner.request('twin'), () => runner.release('twin'));
    }

    return {
        stage, fleet, plant,
        select: (id) => fleet.select(id),
        setPaused: (p) => { paused = p; },
        overview: OVERVIEW,
        fitOverview: () => { fitOverview(); controls.update(); },
        dispose: () => stage.dispose(),
    };
}
