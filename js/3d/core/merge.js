// Merge static meshes of a container by material → far fewer draw calls (shadow + AO + main passes).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function flipWinding(geo) {
    // non-indexed geometry: swap 2nd and 3rd vertex of every triangle for every attribute
    for (const name of Object.keys(geo.attributes)) {
        const a = geo.attributes[name];
        const s = a.itemSize;
        for (let i = 0; i < a.count; i += 3) {
            for (let k = 0; k < s; k++) {
                const i1 = (i + 1) * s + k, i2 = (i + 2) * s + k;
                const t = a.array[i1];
                a.array[i1] = a.array[i2];
                a.array[i2] = t;
            }
        }
        a.needsUpdate = true;
    }
}

/**
 * Merges every plain Mesh under `container` (skipping `exclude` objects and their subtrees,
 * InstancedMesh, Lines and multi-material meshes) into one mesh per material.
 */
export function mergeStatic(container, exclude = []) {
    const skip = new Set(exclude);
    container.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(container.matrixWorld).invert();
    const buckets = new Map();
    const victims = [];

    (function walk(obj) {
        for (const child of obj.children) {
            if (skip.has(child)) continue;
            if (child.isMesh && !child.isInstancedMesh && !Array.isArray(child.material) && child.geometry.attributes.position) {
                const rel = new THREE.Matrix4().multiplyMatrices(inv, child.matrixWorld);
                let g = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
                for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
                if (!g.attributes.normal) g.computeVertexNormals();
                if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
                g.applyMatrix4(rel);
                if (rel.determinant() < 0) flipWinding(g);
                const key = child.material.uuid + (child.castShadow ? 's' : '');
                if (!buckets.has(key)) buckets.set(key, { material: child.material, cast: child.castShadow, geos: [] });
                buckets.get(key).geos.push(g);
                victims.push(child);
            }
            walk(child);
        }
    })(container);

    for (const v of victims) v.parent.remove(v);
    for (const { material, cast, geos } of buckets.values()) {
        const merged = new THREE.Mesh(mergeGeometries(geos), material);
        merged.castShadow = cast;
        merged.receiveShadow = true;
        container.add(merged);
    }
    return { merged: victims.length, meshes: buckets.size };
}
