// Hero background: the LGV as a point cloud that assembles from disorder while the hero scrolls away.
// Pure WebGL2 (no three.js): one program, points sized and faded by depth. Loaded after the `load` event.
import { COUNT, BBOX, POINTS_B64 } from './hero-points.js';

const COLOR = [0x22 / 255, 0xd3 / 255, 0xee / 255];   // #22d3ee

const VS = `#version 300 es
in vec3 aTarget;
in vec3 aScatter;
in float aOrder;            // 0 = lowest point, 1 = highest: the shape assembles bottom to top
uniform mat4 uProj;
uniform mat4 uView;
uniform float uAssemble;
uniform float uTime;
uniform float uSize;
out float vAlpha;
void main() {
    float d = clamp(uAssemble * 1.4 - aOrder * 0.4, 0.0, 1.0);
    float k = d * d * (3.0 - 2.0 * d);
    vec3 drift = vec3(sin(uTime * 0.7 + aOrder * 41.0), cos(uTime * 0.6 + aOrder * 29.0), sin(uTime * 0.5 + aOrder * 17.0));
    vec3 p = mix(aScatter, aTarget, k) + drift * 0.07 * (1.0 - k);
    vec4 mv = uView * vec4(p, 1.0);
    gl_Position = uProj * mv;
    float depth = -mv.z;
    gl_PointSize = uSize * 6.5 / depth;
    vAlpha = clamp(1.7 - depth * 0.16, 0.25, 1.0) * mix(0.42, 0.85, k);
}`;

const FS = `#version 300 es
precision mediump float;
in float vAlpha;
uniform vec3 uColor;
out vec4 outColor;
void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = dot(c, c);
    if (r > 0.25) discard;
    float a = vAlpha * smoothstep(0.25, 0.02, r);
    outColor = vec4(uColor * a, a);      // premultiplied, blended additively
}`;

function shader(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);           // status is read only once the driver is done (no blocking query here)
    return sh;
}

function perspective(fovY, aspect, near, far) {
    const f = 1 / Math.tan(fovY / 2), nf = 1 / (near - far);
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}

/** View matrix: model rotated by yaw/pitch, seen from `dist` on the +Z axis (column-major). */
function view(yaw, pitch, dist) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    // R = Rx(pitch) · Ry(yaw), then translate by −dist along z
    return new Float32Array([
        cy, sp * sy, -cp * sy, 0,
        0, cp, sp, 0,
        sy, -sp * cy, cp * cy, 0,
        0, 0, -dist, 1,
    ]);
}

function decode(step) {
    const bin = atob(POINTS_B64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const q = new Int16Array(bytes.buffer);
    const n = Math.floor(COUNT / step);
    const target = new Float32Array(n * 3), scatter = new Float32Array(n * 3), order = new Float32Array(n);
    const c = [0, 1, 2].map((a) => (BBOX.min[a] + BBOX.max[a]) / 2);
    let seed = 7;
    const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < n; i++) {
        const src = i * step;
        for (let a = 0; a < 3; a++) {
            const v = BBOX.min[a] + ((q[src * 3 + a] + 32767) / 65534) * (BBOX.max[a] - BBOX.min[a]);
            target[i * 3 + a] = v - c[a];
        }
        // disorder: a loose, flattened cloud around the shape
        const u = rnd() * 2 - 1, t = rnd() * Math.PI * 2, r = 1.3 + Math.cbrt(rnd()) * 2.2;
        const s = Math.sqrt(1 - u * u);
        scatter[i * 3] = r * s * Math.cos(t) * 1.25;
        scatter[i * 3 + 1] = r * u * 0.6;
        scatter[i * 3 + 2] = r * s * Math.sin(t);
        order[i] = src / COUNT;
    }
    return { n, target, scatter, order };
}

/**
 * @param {HTMLElement} section  #hero; must contain <canvas class="hero-canvas">
 * @param {{register, request, release}} [runner]  exclusive WebGL runner shared with the 3D sections
 * @returns {{ready: Promise<boolean>, dispose(): void}}  ready: true once the cloud is drawing, false if it never will
 */
export function mountHero(section, runner = null) {
    const canvas = section && section.querySelector('.hero-canvas');
    // failIfMajorPerformanceCaveat: no hero on software rendering (no GPU) — a decorative animation is not
    // worth a busy CPU there; the CSS background stays.
    const gl = canvas && canvas.getContext('webgl2', {
        antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'low-power', failIfMajorPerformanceCaveat: true,
    });
    if (!gl) { canvas?.remove(); return { ready: Promise.resolve(false), dispose() {} }; }   // CSS background only

    // Shaders compile and link off the main thread (KHR_parallel_shader_compile, polled); without the
    // extension the blocking link waits for an idle moment. Either way no long task right after load.
    const prog = gl.createProgram();
    gl.attachShader(prog, shader(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, shader(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    const parallel = gl.getExtension('KHR_parallel_shader_compile');
    let disposed = false;
    let teardown = () => canvas.remove();
    const ready = new Promise((resolve) => {
        const check = () => {
            if (disposed) return resolve(false);
            if (gl.isContextLost()) { canvas.remove(); return resolve(false); }
            if (parallel && !gl.getProgramParameter(prog, parallel.COMPLETION_STATUS_KHR)) { setTimeout(check, 16); return; }
            if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return resolve(false); }
            teardown = run(section, canvas, gl, prog, runner);
            resolve(true);
        };
        if (parallel) setTimeout(check, 16);
        else if (window.requestIdleCallback) requestIdleCallback(check, { timeout: 2000 });
        else setTimeout(check, 200);
    });
    return { ready, dispose() { disposed = true; teardown(); } };
}

/** Uploads the points and runs the render loop; returns its teardown. */
function run(section, canvas, gl, prog, runner) {
    const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 768;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dprCap = mobile ? 1 : 2;

    const { n, target, scatter, order } = decode(mobile ? 2 : 1);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    for (const [name, data, size] of [['aTarget', target, 3], ['aScatter', scatter, 3], ['aOrder', order, 1]]) {
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, name);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    }
    gl.useProgram(prog);
    const U = Object.fromEntries(['uProj', 'uView', 'uAssemble', 'uTime', 'uSize', 'uColor'].map((k) => [k, gl.getUniformLocation(prog, k)]));
    gl.uniform3fv(U.uColor, COLOR);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.clearColor(0, 0, 0, 0);

    let width = 1, height = 1, dpr = 1;
    function resize() {
        dpr = Math.min(devicePixelRatio || 1, dprCap);
        width = Math.max(1, section.clientWidth);
        height = Math.max(1, section.clientHeight);
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        gl.viewport(0, 0, canvas.width, canvas.height);
    }

    /** 0 with the whole hero in view → 1 when its bottom reaches the middle of the viewport. */
    function assembly() {
        if (reduced) return 1;
        const r = section.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight * 0.5)));
        return p * p * (3 - 2 * p);
    }

    // mouse parallax (smoothed)
    let mx = 0, my = 0, px = 0, py = 0;
    const onMove = (e) => { mx = (e.clientX / innerWidth) * 2 - 1; my = (e.clientY / innerHeight) * 2 - 1; };
    if (!reduced && !mobile) addEventListener('pointermove', onMove, { passive: true });

    let raf = 0, running = false, lost = false;
    const t0 = performance.now();
    function draw(now) {
        const t = (now - t0) / 1000;
        px += (mx - px) * 0.05;
        py += (my - py) * 0.05;
        const aspect = width / height;
        const dist = 6.2 / Math.min(1, Math.pow(aspect, 0.85));
        const yaw = (reduced ? 0.6 : 0.6 + t * 0.12) + px * 0.25;
        const pitch = 0.22 + py * 0.12;
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniformMatrix4fv(U.uProj, false, perspective(0.62, aspect, 0.1, 50));
        gl.uniformMatrix4fv(U.uView, false, view(yaw, pitch, dist));
        gl.uniform1f(U.uAssemble, assembly());
        gl.uniform1f(U.uTime, reduced ? 0 : t);
        gl.uniform1f(U.uSize, (mobile ? 2.6 : 3.1) * dpr);
        gl.drawArrays(gl.POINTS, 0, n);
    }
    let lastDraw = 0;
    function loop(now) {
        if (!running) return;
        raf = requestAnimationFrame(loop);
        if (mobile && now - lastDraw < 30) return;       // phones: ~30 fps is plenty for a slow background
        lastDraw = now;
        draw(now);
    }
    const start = () => { if (running || lost || reduced) return; running = true; raf = requestAnimationFrame(loop); };
    const stop = () => { running = false; cancelAnimationFrame(raf); };

    const ro = new ResizeObserver(() => { if (lost) return; resize(); if (!running) draw(performance.now()); });
    ro.observe(section);
    resize();
    draw(performance.now());           // reduced motion: this single assembled frame is all there is
    canvas.classList.add('is-on');     // fades in (CSS)

    // draw only while the hero is on screen, and never together with a 3D section: through the shared
    // runner the twin stops the hero while it runs and hands back when it leaves
    if (runner && !reduced) runner.register('hero', { start, stop });
    const onScreen = () => (runner && !reduced ? runner.request('hero') : start());
    const offScreen = () => (runner && !reduced ? runner.release('hero') : stop());
    const io = new IntersectionObserver((entries) => { if (entries[entries.length - 1].isIntersecting) onScreen(); else offScreen(); });
    io.observe(section);

    canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        lost = true;
        offScreen();
        stop();
        canvas.remove();               // back to the CSS background
    });

    return () => {
        offScreen();
        stop();
        io.disconnect();
        ro.disconnect();
        removeEventListener('pointermove', onMove);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        canvas.remove();
    };
}
