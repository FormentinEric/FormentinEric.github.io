// LGV fleet simulation: per-vehicle state machine, zone traffic, station reservations,
// docking, pick/drop, parking and charging (pure logic, no three.js, deterministic).
import { shortestPath, toPolyline } from './graph.js';
import { CHARGE_THRESHOLD } from './missions.js';

export const STATES = ['Idle', 'GoToPick', 'Docking', 'Lifting', 'Undocking', 'GoToDrop', 'DockingDrop', 'Lowering',
    'UndockingDrop', 'WaitZone', 'GoToCharge', 'Charging', 'Alarm', 'GoToPark'];

const V_MAX = 1.5, V_CURVE = 0.6, V_DOCK = 0.3, ACC = 0.8, TURN = 1.2;
const STEP = 0.05, CAP = 0.5;
const REQUEST_AHEAD = 4.0, STOP_BEFORE = 1.0, RELEASE_AFTER = 2.2;
const DRAIN_M = 0.0015, DRAIN_S = 0.0002, CHARGE_RATE = 0.02, CHARGE_FULL = 0.95;
const LIFT_TRAVEL = 0.12, LIFT_UP = 0.32, LIFT_DOWN = 0.06, HANDLE_TIME = 1.5;
const REST = ['P1', 'P2', 'C1'];

const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const approach = (v, target, max) => (v < target ? Math.min(target, v + max) : Math.max(target, v - max));

function zoneSegments(route) {
    const segs = [];
    for (let s = 0; s <= route.length; s += 0.05) {
        const zone = route.sample(s).edge.zone;
        if (!segs.length || segs.at(-1).zone !== zone) segs.push({ zone, s0: s, s1: s });
        segs.at(-1).s1 = s;
    }
    if (segs.length) segs.at(-1).s1 = route.length;
    for (let i = 1; i < segs.length; i++) segs[i].s0 = segs[i - 1].s1;
    return segs;
}

/**
 * @param {{graph, traffic, missions, stations, lgvIds: string[], batteries?: number[], seed?: number, onEvent?: Function}} opts
 */
export function createFleet({ graph, traffic, missions, stations, lgvIds, batteries = [], seed = 1, onEvent = () => {} }) {
    let time = 0;
    let selected = lgvIds[0];
    let rngState = seed >>> 0;
    const rng = () => ((rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0) / 4294967296);
    const stationRes = new Map();            // station name → lgv id
    const nodeZone = new Map();              // node → zone of its (single) incoming edge
    for (const [, list] of graph.out) for (const e of list) nodeZone.set(e.to, e.zone);
    const emit = (type, lgv, text, extra = {}) => onEvent({ t: time, type, lgv, text, ...extra });
    const label = (v) => `LGV-${v.id}`;

    const fleet = lgvIds.map((id, i) => {
        const home = REST[i % REST.length];
        const st = stations[home];
        stationRes.set(home, id);
        return {
            id, x: st.dock.x, z: st.dock.z, heading: st.heading, speed: 0, lift: LIFT_TRAVEL, loaded: false,
            battery: batteries[i] ?? 0.9, state: 'Idle', mission: null, station: home, node: st.node,
            onLane: false, held: new Set(), actions: [], cur: null, waitingFor: null,
        };
    });

    // ---------- reservations ----------
    function reserve(v, zone) {
        if (v.held.has(zone)) return true;
        if (traffic.tryReserve(zone, v.id)) {
            v.held.add(zone);
            if (v.waitingFor === zone) v.waitingFor = null;
            emit('zone', v.id, `Zone ${zone} reserved by ${label(v)}`, { zone });
            return true;
        }
        if (v.waitingFor !== zone) {
            v.waitingFor = zone;
            emit('wait', v.id, `${label(v)} waiting for zone ${zone}`, { zone });
        }
        return false;
    }
    function release(v, zone) {
        if (!v.held.delete(zone)) return;
        traffic.release(zone, v.id);
        emit('zone', v.id, `Zone ${zone} released by ${label(v)}`, { zone });
    }
    const stationFree = (name, v) => !stationRes.has(name) || stationRes.get(name) === v.id;

    // ---------- action helpers ----------
    function rotateTowards(v, target, h) {
        const d = wrap(target - v.heading);
        const step = TURN * h;
        if (Math.abs(d) <= step) { v.heading = target; return true; }
        v.heading = wrap(v.heading + Math.sign(d) * step);
        return false;
    }
    function moveStraight(v, tx, tz, sign, h) {
        const dx = tx - v.x, dz = tz - v.z, d = Math.hypot(dx, dz);
        v.speed = approach(Math.abs(v.speed), Math.min(V_DOCK, Math.sqrt(2 * ACC * d)), ACC * h) * sign;
        const ds = Math.min(d, Math.abs(v.speed) * h);
        v.battery -= ds * DRAIN_M;
        if (d < 1e-4 || ds >= d - 1e-6) { v.x = tx; v.z = tz; v.speed = 0; return true; }
        v.x += (dx / d) * ds;
        v.z += (dz / d) * ds;
        return false;
    }

    function planMission(v, mission) {
        v.mission = mission;
        const a = [];
        if (mission.type === 'CHARGE') {
            a.push({ type: 'reserve', name: 'C1' }, { type: 'undock', state: 'Undocking' }, { type: 'travel', to: 'C1', state: 'GoToCharge' },
                { type: 'dock', name: 'C1', state: 'GoToCharge' }, { type: 'charge' }, { type: 'done' });
        } else {
            a.push({ type: 'reserve', name: mission.from }, { type: 'undock', state: 'UndockingDrop' },
                { type: 'travel', to: mission.from, state: 'GoToPick' }, { type: 'dock', name: mission.from, state: 'Docking' },
                { type: 'handle', kind: 'pick', state: 'Lifting' },
                { type: 'reserve', name: mission.to }, { type: 'undock', state: 'Undocking' },
                { type: 'travel', to: mission.to, state: 'GoToDrop' }, { type: 'dock', name: mission.to, state: 'DockingDrop' },
                { type: 'handle', kind: 'drop', state: 'Lowering' }, { type: 'done' });
        }
        v.actions = a;
        emit('mission', v.id, `${mission.id} ${mission.type} → ${label(v)}`, { mission: mission.id });
    }

    function planRest(v, name) {
        const travelState = name === 'C1' ? 'GoToCharge' : 'GoToPark';
        v.actions = [{ type: 'reserve', name }, { type: 'undock', state: 'UndockingDrop' }, { type: 'travel', to: name, state: travelState },
            { type: 'dock', name, state: travelState }];
        if (name === 'C1') v.actions.push({ type: 'charge' });
        v.actions.push({ type: 'done' });
    }

    // ---------- one action, one sub-step ----------
    function run(v, h) {
        if (!v.cur) {
            v.cur = v.actions.shift() || null;
            if (!v.cur) {
                v.state = 'Idle';
                v.battery -= DRAIN_S * h;
                return;
            }
        }
        const a = v.cur;
        let finished = false;

        if (a.type === 'reserve') {
            if (stationFree(a.name, v)) {
                stationRes.set(a.name, v.id);
                finished = true;
            } else v.state = 'WaitZone';
        } else if (a.type === 'undock') {
            if (!v.station) finished = true;
            else {
                const st = stations[v.station];
                if (!v.onLane) {
                    if (reserve(v, nodeZone.get(st.node))) { v.onLane = true; v.state = a.state; }
                    else v.state = 'WaitZone';
                }
                if (v.onLane) {
                    const n = graph.nodes.get(st.node);
                    v.state = a.state;
                    if (moveStraight(v, n.x, n.z, -1, h)) {
                        if (stationRes.get(v.station) === v.id) stationRes.delete(v.station);
                        v.station = null;
                        v.node = st.node;
                        finished = true;
                    }
                }
            }
        } else if (a.type === 'travel') {
            finished = travel(v, a, h);
        } else if (a.type === 'dock') {
            const st = stations[a.name];
            v.state = a.state;
            if (!a.turned) a.turned = rotateTowards(v, st.heading, h);
            else if (moveStraight(v, st.dock.x, st.dock.z, 1, h)) {
                for (const z of [...v.held]) release(v, z);
                v.onLane = false;
                v.station = a.name;
                finished = true;
            }
        } else if (a.type === 'handle') {
            v.state = a.state;
            a.t = (a.t || 0) + h;
            v.lift = approach(v.lift, a.kind === 'pick' ? LIFT_UP : LIFT_DOWN, 0.4 * h);
            if (a.t >= HANDLE_TIME) {
                v.loaded = a.kind === 'pick';
                v.lift = a.kind === 'pick' ? LIFT_UP : LIFT_TRAVEL;
                emit(a.kind, v.id, `${label(v)} ${a.kind === 'pick' ? 'picked' : 'dropped'} pallet at ${v.station}`,
                    { station: v.station, mission: v.mission?.id });
                finished = true;
            }
        } else if (a.type === 'charge') {
            if (!a.started) { a.started = true; emit('charge', v.id, `${label(v)} charging (${Math.round(v.battery * 100)}%)`); }
            v.state = 'Charging';
            v.battery = Math.min(1, v.battery + CHARGE_RATE * h);
            if (v.battery >= CHARGE_FULL) {
                emit('charge', v.id, `${label(v)} charged (${Math.round(v.battery * 100)}%)`);
                finished = true;
            }
        } else if (a.type === 'done') {
            v.mission = null;
            v.state = 'Idle';
            finished = true;
        }
        if (a.type !== 'charge') v.battery -= DRAIN_S * h;
        if (finished) v.cur = null;
    }

    function travel(v, a, h) {
        const target = stations[a.to].node;
        if (!a.route) {
            const ids = shortestPath(graph, v.node, target);
            a.route = toPolyline(graph, ids);
            a.segs = zoneSegments(a.route);
            a.s = 0;
            a.startZone = nodeZone.get(v.node);
            a.turned = a.route.length === 0;
        }
        if (a.route.length === 0) { v.node = target; return true; }
        const { route, segs } = a;
        if (!a.turned) {
            v.state = a.state;
            a.turned = rotateTowards(v, route.sample(0).heading, h);
            return false;
        }
        // current segment and zone look-ahead
        let i = 0;
        while (i < segs.length - 1 && a.s >= segs[i].s1) i++;
        let limit = route.length;
        if (!reserve(v, segs[i].zone)) limit = a.s;                 // cannot even enter the current segment
        else if (i + 1 < segs.length && segs[i + 1].s0 - a.s < REQUEST_AHEAD && !reserve(v, segs[i + 1].zone)) {
            limit = Math.max(a.s, segs[i + 1].s0 - STOP_BEFORE);
        }
        // speed profile: curve limit, then braking distance to the limit
        const ahead = route.sample(Math.min(route.length, a.s + 1.5)).curvature > 0.3 || route.sample(a.s).curvature > 0.3;
        const vCap = Math.min(ahead ? V_CURVE : V_MAX, Math.sqrt(2 * ACC * Math.max(0, limit - a.s)));
        v.speed = approach(v.speed, vCap, ACC * h);
        const ds = Math.min(v.speed * h, Math.max(0, limit - a.s));
        a.s += ds;
        v.battery -= ds * DRAIN_M;
        const p = route.sample(a.s);
        v.x = p.x; v.z = p.z; v.heading = p.heading;
        v.state = limit < route.length && v.speed < 0.02 && a.s >= limit - 0.02 ? 'WaitZone' : a.state;
        // release zones the whole vehicle has left
        const keep = new Set([segs[i].zone, segs[i + 1]?.zone]);
        if (a.s > RELEASE_AFTER && a.startZone && !keep.has(a.startZone)) release(v, a.startZone);
        for (let j = 0; j < i; j++) if (a.s > segs[j].s1 + RELEASE_AFTER && !keep.has(segs[j].zone)) release(v, segs[j].zone);
        if (a.s >= route.length - 1e-6) {
            v.speed = 0;
            v.node = target;
            return true;
        }
        return false;
    }

    // ---------- assignment ----------
    function assign() {
        const free = fleet.filter((v) => !v.cur && v.actions.length === 0);
        if (free.length) {
            const chargerFree = !stationRes.has('C1') || free.some((v) => v.station === 'C1' && v.battery >= CHARGE_FULL - 0.01);
            // a mission whose pick station is still occupied by another LGV waits in the queue:
            // otherwise the free LGV would reserve its own station while waiting for that one (circular wait)
            const canStart = (m) => !stationRes.has(m.from);
            for (const { lgvId, mission } of missions.next(free.map((v) => ({ id: v.id, node: v.node, battery: v.battery })), { chargerFree, canStart })) {
                const v = fleet.find((f) => f.id === lgvId);
                // a full LGV resting on the charger makes room for one that needs it
                if (mission.type === 'CHARGE' && stationRes.get('C1') && stationRes.get('C1') !== v.id) {
                    const blocker = fleet.find((f) => f.id === stationRes.get('C1'));
                    const park = ['P1', 'P2'].find((p) => !stationRes.has(p));
                    if (blocker && park && !blocker.cur && blocker.actions.length === 0) planRest(blocker, park);
                }
                planMission(v, mission);
            }
        }
        // free LGVs docked at a work station go back to rest
        for (const v of fleet) {
            if (v.cur || v.actions.length || !v.station || REST.includes(v.station)) continue;
            const order = v.battery < 0.6 ? ['C1', 'P1', 'P2'] : ['P1', 'P2', 'C1'];
            const spot = order.find((s) => !stationRes.has(s));
            if (spot) planRest(v, spot);
        }
        // an LGV resting on the charger below full keeps charging
        for (const v of fleet) {
            if (!v.cur && !v.actions.length && v.station === 'C1' && v.battery < CHARGE_FULL - 0.05) v.actions = [{ type: 'charge' }];
        }
    }

    function tick(h) {
        time += h;
        assign();
        for (const v of fleet) run(v, h);
    }

    return {
        step(dt) {
            let remaining = Math.min(dt, CAP);
            while (remaining > 1e-9) {
                const h = Math.min(STEP, remaining);
                tick(h);
                remaining -= h;
            }
        },
        time: () => time,
        select(id) { selected = id; },
        selected: () => selected,
        rng,
        snapshot: () => fleet.map((v) => ({
            id: v.id, x: v.x, z: v.z, heading: v.heading, speed: v.speed, lift: v.lift, loaded: v.loaded,
            state: v.state, zone: v.onLane ? currentZone(v) : null, missionId: v.mission?.id ?? null,
            missionType: v.mission?.type ?? null, battery: v.battery, station: v.station,
        })),
    };

    function currentZone(v) {
        const a = v.cur;
        if (a && a.type === 'travel' && a.route && a.route.length > 0) {
            const z = a.route.sample(a.s).edge.zone;
            if (v.held.has(z)) return z;
        }
        return nodeZone.get(v.node) ?? [...v.held][0] ?? null;
    }
}
