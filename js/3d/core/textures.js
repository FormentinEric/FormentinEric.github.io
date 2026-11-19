// Procedural canvas textures: no image downloads, everything generated at runtime.
import * as THREE from 'three';

export function rng(seed = 1) {
    let s = seed >>> 0;
    return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

export function canvasTexture(w, h, draw, { srgb = true, repeat = null, anisotropy = 8 } = {}) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    draw(g, w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = anisotropy;
    if (repeat) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(repeat[0], repeat[1]);
    }
    return t;
}

function addNoise(g, w, h, amount, r) {
    const img = g.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
        const n = (r() - 0.5) * amount;
        d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
}

function stains(g, w, h, r, count, dark, light) {
    for (let i = 0; i < count; i++) {
        const x = r() * w, y = r() * h, rad = 30 + r() * 180;
        const grd = g.createRadialGradient(x, y, 0, x, y, rad);
        grd.addColorStop(0, r() > 0.45 ? `rgba(0,0,0,${dark})` : `rgba(255,255,255,${light})`);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd;
        g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
}

/** Sealed industrial concrete floor: colour + roughness maps (tileable 4 m panels). */
export function concreteMaps(repeat = 10) {
    const map = canvasTexture(1024, 1024, (g, w, h) => {
        const r = rng(11);
        g.fillStyle = '#4a4f57';
        g.fillRect(0, 0, w, h);
        stains(g, w, h, r, 70, 0.10, 0.05);
        // tyre marks
        g.strokeStyle = 'rgba(0,0,0,0.06)';
        for (let i = 0; i < 14; i++) {
            g.lineWidth = 6 + r() * 10;
            g.beginPath();
            const y = r() * h;
            g.moveTo(0, y);
            g.bezierCurveTo(w * 0.3, y + (r() - 0.5) * 200, w * 0.7, y + (r() - 0.5) * 200, w, y + (r() - 0.5) * 60);
            g.stroke();
        }
        addNoise(g, w, h, 18, r);
        // saw-cut joints on the tile border
        g.fillStyle = 'rgba(0,0,0,0.55)';
        g.fillRect(0, 0, w, 3);
        g.fillRect(0, 0, 3, h);
    }, { repeat: [repeat, repeat] });

    const roughnessMap = canvasTexture(512, 512, (g, w, h) => {
        const r = rng(23);
        g.fillStyle = '#b8b8b8';
        g.fillRect(0, 0, w, h);
        stains(g, w, h, r, 50, 0.22, 0.12);
        addNoise(g, w, h, 40, r);
    }, { srgb: false, repeat: [repeat, repeat] });

    return { map, roughnessMap };
}

/** Black/yellow safety stripes. */
export function hazardTexture(repeatX = 4, repeatY = 1) {
    return canvasTexture(256, 64, (g, w, h) => {
        g.fillStyle = '#f2b20f';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#15161a';
        for (let x = -h; x < w + h; x += 64) {
            g.beginPath();
            g.moveTo(x, h); g.lineTo(x + 32, h); g.lineTo(x + 32 + h, 0); g.lineTo(x + h, 0);
            g.closePath();
            g.fill();
        }
        addNoise(g, w, h, 14, rng(5));
    }, { repeat: [repeatX, repeatY] });
}

/** Text decal on transparent background (vehicle numbers, labels). */
export function labelTexture(text, { w = 512, h = 256, color = '#15161a', font = '900 190px Outfit, Arial, sans-serif', stroke = null } = {}) {
    return canvasTexture(w, h, (g) => {
        g.clearRect(0, 0, w, h);
        g.font = font;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        if (stroke) { g.lineWidth = 10; g.strokeStyle = stroke; g.strokeText(text, w / 2, h / 2 + 8); }
        g.fillStyle = color;
        g.fillText(text, w / 2, h / 2 + 8);
    });
}

/** Small HMI display, redrawn on demand. */
export function screenTexture(w = 512, h = 256) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    function draw({ title = 'LGV-02', state = 'AUTO', battery = 0.87, line = 'MISSION 1042' } = {}) {
        g.fillStyle = '#06121f';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#0ea5e9';
        g.fillRect(0, 0, w, 46);
        g.fillStyle = '#04121e';
        g.font = '700 30px Consolas, monospace';
        g.fillText(title, 16, 33);
        g.fillStyle = '#22d3ee';
        g.font = '700 44px Consolas, monospace';
        g.fillText(state, 16, 108);
        g.fillStyle = '#9fb3c8';
        g.font = '26px Consolas, monospace';
        g.fillText(line, 16, 150);
        // battery
        g.strokeStyle = '#9fb3c8'; g.lineWidth = 4;
        g.strokeRect(16, 180, 300, 46);
        g.fillStyle = battery > 0.3 ? '#10b981' : '#f59e0b';
        g.fillRect(22, 186, 288 * battery, 34);
        g.fillStyle = '#e2e8f0';
        g.font = '700 30px Consolas, monospace';
        g.fillText(`${Math.round(battery * 100)}%`, 332, 214);
        texture.needsUpdate = true;
    }
    draw();
    return { texture, draw };
}

/** Corrugated cardboard with tape and shipping label. */
export function cartonTexture(seed = 3, tint = '#b9895a') {
    return canvasTexture(512, 512, (g, w, h) => {
        const r = rng(seed);
        g.fillStyle = tint;
        g.fillRect(0, 0, w, h);
        // fibres
        g.strokeStyle = 'rgba(90,55,25,0.10)';
        for (let i = 0; i < 400; i++) {
            g.lineWidth = 1;
            g.beginPath();
            const x = r() * w, y = r() * h;
            g.moveTo(x, y);
            g.lineTo(x + (r() - 0.5) * 40, y + (r() - 0.5) * 6);
            g.stroke();
        }
        addNoise(g, w, h, 16, r);
        // edge darkening
        const grd = g.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.75);
        grd.addColorStop(0, 'rgba(0,0,0,0)');
        grd.addColorStop(1, 'rgba(60,30,10,0.25)');
        g.fillStyle = grd;
        g.fillRect(0, 0, w, h);
        // tape
        g.fillStyle = 'rgba(214,180,120,0.85)';
        g.fillRect(w * 0.44, 0, w * 0.12, h);
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.fillRect(w * 0.46, 0, w * 0.02, h);
        // label with barcode
        g.fillStyle = '#f4f1ea';
        g.fillRect(w * 0.08, h * 0.62, w * 0.3, h * 0.22);
        g.fillStyle = '#1a1a1a';
        for (let x = 0; x < 34; x++) {
            if (r() > 0.4) g.fillRect(w * 0.1 + x * 4, h * 0.67, r() > 0.5 ? 2 : 3, h * 0.1);
        }
        g.font = '700 18px Arial';
        g.fillText('EF-' + Math.floor(1000 + r() * 8999), w * 0.1, h * 0.82);
        // "this way up" arrows
        g.strokeStyle = '#2a1a0e'; g.lineWidth = 6;
        for (const dx of [0, 34]) {
            g.beginPath();
            g.moveTo(w * 0.7 + dx, h * 0.84); g.lineTo(w * 0.7 + dx, h * 0.66);
            g.moveTo(w * 0.7 + dx - 12, h * 0.71); g.lineTo(w * 0.7 + dx, h * 0.66); g.lineTo(w * 0.7 + dx + 12, h * 0.71);
            g.stroke();
        }
    });
}

/** Pallet wood planks. */
export function woodTexture() {
    return canvasTexture(512, 128, (g, w, h) => {
        const r = rng(9);
        g.fillStyle = '#c9a26b';
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 60; i++) {
            g.strokeStyle = `rgba(110,70,30,${0.05 + r() * 0.12})`;
            g.lineWidth = 1 + r() * 2;
            g.beginPath();
            const y = r() * h;
            g.moveTo(0, y);
            g.bezierCurveTo(w * 0.3, y + (r() - 0.5) * 10, w * 0.6, y + (r() - 0.5) * 10, w, y + (r() - 0.5) * 6);
            g.stroke();
        }
        // knots
        for (let i = 0; i < 3; i++) {
            const x = r() * w, y = r() * h;
            g.fillStyle = 'rgba(90,55,20,0.35)';
            g.beginPath(); g.ellipse(x, y, 7, 4, 0, 0, Math.PI * 2); g.fill();
        }
        addNoise(g, w, h, 14, r);
    });
}

/** Welded wire mesh for safety fences (use with alphaTest). */
export function wireMeshTexture(repeatX = 1, repeatY = 2) {
    return canvasTexture(256, 256, (g, w, h) => {
        g.clearRect(0, 0, w, h);
        g.strokeStyle = '#4a515c';
        g.lineWidth = 4;
        for (let i = 0; i <= w; i += 64) {
            g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke();
            g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke();
        }
    }, { repeat: [repeatX, repeatY] });
}

/** Stripes used as bump map for corrugated cable hoses. */
export function corrugationTexture(repeat = 60) {
    return canvasTexture(64, 8, (g, w, h) => {
        const grd = g.createLinearGradient(0, 0, w, 0);
        grd.addColorStop(0, '#000'); grd.addColorStop(0.5, '#fff'); grd.addColorStop(1, '#000');
        g.fillStyle = grd;
        g.fillRect(0, 0, w, h);
    }, { srgb: false, repeat: [repeat, 1] });
}

/** Painted floor text, e.g. "LGV ONLY". */
export function floorTextTexture(text) {
    return canvasTexture(1024, 256, (g, w, h) => {
        g.clearRect(0, 0, w, h);
        g.font = '900 170px Outfit, Arial, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = 'rgba(242,178,15,0.92)';
        g.fillText(text, w / 2, h / 2 + 10);
        // worn paint
        g.globalCompositeOperation = 'destination-out';
        const r = rng(4);
        for (let i = 0; i < 900; i++) {
            g.fillStyle = `rgba(0,0,0,${r() * 0.6})`;
            g.fillRect(r() * w, r() * h, 2 + r() * 6, 2 + r() * 4);
        }
        g.globalCompositeOperation = 'source-over';
    });
}
