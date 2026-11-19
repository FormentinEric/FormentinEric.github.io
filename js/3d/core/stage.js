// WebGL stage: renderer + scene + camera + composer configured by quality profile.
// Throws if WebGL is unavailable (callers show a fallback).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { PROFILES, pickInitialProfile, createGovernor } from './quality.js';

function detectProfile(renderer) {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null;
    const isMobile = matchMedia('(pointer: coarse)').matches || innerWidth < 768;
    return pickInitialProfile({ isMobile, gpu, cores: navigator.hardwareConcurrency || 4 });
}

/**
 * @param {HTMLElement} container  element that receives the canvas (its size drives the canvas)
 * @param {{profile?: 'auto'|'high'|'medium'|'low', background?: number, fov?: number, orbit?: boolean, post?: boolean}} opts
 */
export function createStage(container, { profile = 'auto', background = 0x0a0f18, fov = 38, orbit = false, post = true } = {}) {
    const canvas = document.createElement('canvas');
    canvas.className = 'stage-canvas';
    container.appendChild(canvas);
    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    } catch (err) {
        canvas.remove();
        throw err;
    }
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.info.autoReset = false;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(background);
    const camera = new THREE.PerspectiveCamera(fov, 1, 0.05, 150);
    const controls = orbit ? new OrbitControls(camera, canvas) : null;
    if (controls) controls.enableDamping = true;

    let current = profile === 'auto' ? detectProfile(renderer) : profile;
    let cfg = PROFILES[current];
    let composer = null;
    const governor = createGovernor({ initial: current });

    function buildComposer() {
        if (composer) {
            composer.renderTarget1.dispose();
            composer.renderTarget2.dispose();
            composer = null;
        }
        if (!post) return;
        const size = renderer.getDrawingBufferSize(new THREE.Vector2());
        const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: cfg.msaa });
        composer = new EffectComposer(renderer, target);
        composer.setPixelRatio(renderer.getPixelRatio());
        composer.addPass(new RenderPass(scene, camera));
        if (cfg.ao) {
            const gtao = new GTAOPass(scene, camera, size.x, size.y);
            gtao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: 16 });
            gtao.blendIntensity = 0.9;
            composer.addPass(gtao);
        }
        if (cfg.bloom) composer.addPass(new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.38, 0.32, 1.15));
        if (cfg.fxaa) composer.addPass(new FXAAPass());
        composer.addPass(new OutputPass());
        resize();
    }

    function resize() {
        const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        if (composer) composer.setSize(w, h);
    }

    function setProfile(p) {
        current = p;
        cfg = PROFILES[p];
        renderer.setPixelRatio(Math.min(devicePixelRatio, cfg.dpr));
        scene.traverse((o) => {
            if (o.isLight && o.castShadow && o.shadow) {
                o.shadow.mapSize.set(cfg.shadow, cfg.shadow);
                if (o.shadow.map) { o.shadow.map.dispose(); o.shadow.map = null; }
            }
        });
        resize();
        buildComposer();
    }

    const frameFns = [];
    const lostFns = [];
    let running = false, last = 0, raf = 0;

    function draw() {
        renderer.info.reset();
        if (composer) composer.render();
        else renderer.render(scene, camera);
    }

    function loop(now) {
        if (!running) return;
        raf = requestAnimationFrame(loop);
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        if (governor.sample(Math.max(dt, 1e-3)) === 'low') setProfile('low');
        for (const fn of frameFns) fn(dt);
        if (controls) controls.update();
        draw();
    }

    const ro = new ResizeObserver(() => { resize(); if (!running) draw(); });
    ro.observe(container);

    canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        running = false;
        cancelAnimationFrame(raf);
        for (const fn of lostFns) fn();
    });

    setProfile(current);

    return {
        renderer, scene, camera, controls, canvas,
        profile: () => current,
        setProfile,
        onFrame: (fn) => frameFns.push(fn),
        onLost: (fn) => lostFns.push(fn),
        start() {
            if (running) return;
            running = true;
            last = performance.now();
            raf = requestAnimationFrame(loop);
        },
        stop() {
            running = false;
            cancelAnimationFrame(raf);
        },
        renderOnce: draw,
        resize,
        dispose() {
            running = false;
            cancelAnimationFrame(raf);
            ro.disconnect();
            if (composer) { composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); }
            renderer.dispose();
            canvas.remove();
        },
    };
}
