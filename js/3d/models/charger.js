// LGV charging station: column with display and cable, floor contact plate that glows while charging.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { materials } from '../core/materials.js';
import { screenTexture } from '../core/textures.js';
import { mergeStatic } from '../core/merge.js';

function mesh(geo, mat, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
}

/** Group origin = centre of the floor contacts (under the docked LGV). The column stands at +x/−z. */
export function createCharger() {
    const M = materials();
    const group = new THREE.Group();
    group.name = 'Charger';

    // floor contact plate with two copper rails
    group.add(mesh(new RoundedBoxGeometry(1.0, 0.03, 0.6, 2, 0.01), M.steelDark, 0, 0.015, 0));
    const copper = new THREE.MeshStandardMaterial({ color: 0xc77b4a, metalness: 0.9, roughness: 0.3 });
    for (const z of [-0.12, 0.12]) group.add(mesh(new THREE.BoxGeometry(0.8, 0.012, 0.06), copper, 0, 0.034, z));
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x22ee77, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8).rotateX(-Math.PI / 2), glowMat);
    glow.position.y = 0.04;
    group.add(glow);

    // column
    const col = new THREE.Group();
    col.add(mesh(new RoundedBoxGeometry(0.46, 1.5, 0.32, 3, 0.05), M.cabinetGrey, 0, 0.75, 0));
    col.add(mesh(new THREE.BoxGeometry(0.5, 0.06, 0.36), M.steelDark, 0, 0.03, 0));
    col.add(mesh(new THREE.BoxGeometry(0.47, 0.06, 0.33), M.ledCyan, 0, 1.42, 0));
    for (let i = 0; i < 6; i++) col.add(mesh(new THREE.BoxGeometry(0.3, 0.012, 0.01), M.plasticBlack, 0, 0.35 + i * 0.04, 0.162));
    const scr = screenTexture(256, 160);
    const display = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.19),
        new THREE.MeshStandardMaterial({ map: scr.texture, emissiveMap: scr.texture, emissive: 0xffffff, emissiveIntensity: 0.9 }));
    display.position.set(0, 1.08, 0.161);
    col.add(display);
    // cable from the column to the floor plate
    const cable = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.5, 0.17), new THREE.Vector3(0, 0.12, 0.45), new THREE.Vector3(-0.35, 0.03, 0.8),
    ]), 20, 0.025, 8);
    col.add(mesh(cable, M.hose));
    col.position.set(0.55, 0, -0.75);
    group.add(col);

    mergeStatic(group, [glow, col]);
    mergeStatic(col, [display]);

    let charging = false, t = 0, last = '';
    function update(dt, battery = null) {
        t += dt;
        glowMat.opacity = charging ? 0.18 + Math.sin(t * 3) * 0.08 : 0;
        const label = charging ? `CHARGING ${Math.round((battery ?? 0) * 100)}%` : 'READY';
        if (label !== last) {
            last = label;
            scr.draw({ title: 'CHARGER C1', state: charging ? 'ON' : 'READY', battery: battery ?? 1, line: label });
        }
    }
    update(0);
    return { group, update, setCharging: (on) => { charging = on; } };
}
