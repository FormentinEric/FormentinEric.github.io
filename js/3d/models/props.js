// Euro pallet (EPAL 1200x800x144 mm), cartons and stretch-wrapped loads.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { materials } from '../core/materials.js';
import { mergeStatic } from '../core/merge.js';

let palletGeometry = null;

/** Real EPAL layout: 3 bottom boards, 9 blocks, 3 stringer boards, 5 top boards. Long side along Z. */
function buildPalletGeometry() {
    const parts = [];
    const box = (w, h, d, x, y, z) => {
        const g = new THREE.BoxGeometry(w, h, d);
        g.translate(x, y, z);
        parts.push(g);
    };
    const T = 0.022;          // board thickness
    const B = 0.078;          // block height
    const xs = [-0.3275, 0, 0.3275];
    const zs = [-0.5275, 0, 0.5275];
    // bottom boards (along Z)
    box(0.100, T, 1.2, xs[0], T / 2, 0);
    box(0.145, T, 1.2, xs[1], T / 2, 0);
    box(0.100, T, 1.2, xs[2], T / 2, 0);
    // blocks
    for (const x of xs) for (const z of zs) {
        box(x === 0 ? 0.145 : 0.100, B, 0.145, x, T + B / 2, z);
    }
    // stringer boards (across X)
    for (const z of zs) box(0.8, T, 0.145, 0, T + B + T / 2, z);
    // top deck (along Z)
    const tops = [[-0.3275, 0.145], [-0.165, 0.100], [0, 0.145], [0.165, 0.100], [0.3275, 0.145]];
    for (const [x, w] of tops) box(w, T, 1.2, x, T + B + T + T / 2, 0);
    return mergeGeometries(parts);
}

export const PALLET_HEIGHT = 0.144;

export function createPallet() {
    if (!palletGeometry) palletGeometry = buildPalletGeometry();
    const mesh = new THREE.Mesh(palletGeometry, materials().wood);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

export const CARTON = { w: 0.4, h: 0.28, d: 0.4 };
let cartonGeometry = null;

export function createCarton(variant = 0) {
    if (!cartonGeometry) cartonGeometry = new RoundedBoxGeometry(CARTON.w, CARTON.h, CARTON.d, 2, 0.012);
    const m = materials();
    const mesh = new THREE.Mesh(cartonGeometry, m.cartons[variant % m.cartons.length]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

/** Pallet + cartons (cols × rows × layers) + optional stretch wrap. Long side along Z. */
export function createLoadedPallet({ cols = 2, rows = 3, layers = 3, wrap = true, seed = 0 } = {}) {
    const group = new THREE.Group();
    group.add(createPallet());
    let k = seed;
    for (let l = 0; l < layers; l++) {
        for (let c = 0; c < cols; c++) {
            for (let r = 0; r < rows; r++) {
                const carton = createCarton(k++);
                carton.position.set(
                    (c - (cols - 1) / 2) * CARTON.w,
                    PALLET_HEIGHT + CARTON.h / 2 + l * CARTON.h,
                    (r - (rows - 1) / 2) * CARTON.d,
                );
                group.add(carton);
            }
        }
    }
    if (wrap) {
        const h = layers * CARTON.h + 0.03;
        const film = new THREE.Mesh(
            new RoundedBoxGeometry(cols * CARTON.w + 0.02, h, rows * CARTON.d + 0.02, 3, 0.02),
            materials().stretchWrap,
        );
        film.position.y = PALLET_HEIGHT + h / 2 - 0.01;
        film.renderOrder = 2;
        film.name = 'film';
        group.add(film);
    }
    // pallet + cartons → one mesh per material (the film stays separate so it can be toggled)
    mergeStatic(group, [group.getObjectByName('film')].filter(Boolean));
    return group;
}
