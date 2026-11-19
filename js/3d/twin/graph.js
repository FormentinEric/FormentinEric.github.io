// Directed path graph, Dijkstra and arc-filleted polylines (pure logic, no three.js).

export function createGraph(nodes, edges) {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const out = new Map(nodes.map((n) => [n.id, []]));
    for (const e of edges) {
        const a = byId.get(e.from), b = byId.get(e.to);
        out.get(e.from).push({ ...e, length: Math.hypot(b.x - a.x, b.z - a.z) });
    }
    return { nodes: byId, out };
}

export function shortestPath(g, fromId, toId) {
    if (fromId === toId) return [fromId];
    const dist = new Map([[fromId, 0]]);
    const prev = new Map();
    const open = new Set([fromId]);
    while (open.size) {
        let u = null;
        for (const id of open) if (u === null || dist.get(id) < dist.get(u)) u = id;
        open.delete(u);
        if (u === toId) break;
        for (const e of g.out.get(u)) {
            const d = dist.get(u) + e.length;
            if (d < (dist.get(e.to) ?? Infinity)) {
                dist.set(e.to, d);
                prev.set(e.to, u);
                open.add(e.to);
            }
        }
    }
    if (!dist.has(toId)) return null;
    const path = [toId];
    while (path[0] !== fromId) path.unshift(prev.get(path[0]));
    return path;
}

export function pathLength(g, ids) {
    let L = 0;
    for (let i = 1; i < ids.length; i++) {
        const a = g.nodes.get(ids[i - 1]), b = g.nodes.get(ids[i]);
        L += Math.hypot(b.x - a.x, b.z - a.z);
    }
    return L;
}

const headingOf = (dx, dz) => Math.atan2(dx, dz);   // rotation.y that points +Z along (dx, dz)

/**
 * Polyline through `ids` with circular fillets of `cornerRadius` at every bend.
 * sample(s) → { x, z, heading, curvature, edge } with s clamped to [0, length].
 */
export function toPolyline(g, ids, { cornerRadius = 0.8 } = {}) {
    const pts = ids.map((id) => g.nodes.get(id));
    const edgeOf = (i) => g.out.get(ids[i]).find((e) => e.to === ids[i + 1]);
    if (pts.length < 2) {
        const p = pts[0];
        return { length: 0, sample: () => ({ x: p.x, z: p.z, heading: 0, curvature: 0, edge: null }) };
    }

    // trim distance at every interior vertex
    const trim = new Array(pts.length).fill(0);
    const turn = new Array(pts.length).fill(0);
    for (let i = 1; i < pts.length - 1; i++) {
        const a = pts[i - 1], b = pts[i], c = pts[i + 1];
        const h1 = headingOf(b.x - a.x, b.z - a.z), h2 = headingOf(c.x - b.x, c.z - b.z);
        let d = h2 - h1;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        turn[i] = d;
        if (Math.abs(d) < 1e-6) continue;
        const l1 = Math.hypot(b.x - a.x, b.z - a.z), l2 = Math.hypot(c.x - b.x, c.z - b.z);
        trim[i] = Math.min(cornerRadius * Math.tan(Math.abs(d) / 2), l1 / 2, l2 / 2);
    }

    const prims = [];
    for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const L = Math.hypot(b.x - a.x, b.z - a.z);
        const ux = (b.x - a.x) / L, uz = (b.z - a.z) / L;
        const s0 = trim[i], s1 = L - trim[i + 1];
        if (s1 > s0) prims.push({ kind: 'line', x: a.x + ux * s0, z: a.z + uz * s0, ux, uz, len: s1 - s0, edge: edgeOf(i) });
        const k = i + 1;
        if (k < pts.length - 1 && trim[k] > 0) {
            // fillet arc around corner pts[k]
            const r = trim[k] / Math.tan(Math.abs(turn[k]) / 2);
            const h0 = headingOf(ux, uz);
            prims.push({ kind: 'arc', x: b.x - ux * trim[k], z: b.z - uz * trim[k], h0, sweep: turn[k], r, len: r * Math.abs(turn[k]), edge: edgeOf(k) });
        }
    }
    const length = prims.reduce((t, p) => t + p.len, 0);

    function sample(s) {
        s = Math.max(0, Math.min(length, s));
        let i = 0;
        while (i < prims.length - 1 && s > prims[i].len) { s -= prims[i].len; i++; }
        const p = prims[i];
        s = Math.min(s, p.len);
        if (p.kind === 'line') {
            return { x: p.x + p.ux * s, z: p.z + p.uz * s, heading: headingOf(p.ux, p.uz), curvature: 0, edge: p.edge };
        }
        // arc: integrate heading from h0 by sweep·(s/len); position via circle centre
        const dir = Math.sign(p.sweep);
        const phi = (s / p.r) * dir;
        const h = p.h0 + phi;
        // left normal of heading h0 in (x,z) with heading = atan2(x, z): forward (sin, cos), left (cos, −sin)
        const cx = p.x + Math.cos(p.h0) * p.r * dir, cz = p.z - Math.sin(p.h0) * p.r * dir;
        const x = cx - Math.cos(h) * p.r * dir, z = cz + Math.sin(h) * p.r * dir;
        return { x, z, heading: h, curvature: 1 / p.r, edge: p.edge };
    }

    return { length, sample };
}
