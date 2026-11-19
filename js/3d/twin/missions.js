// Mission manager: turns plant events into missions and assigns them to free LGVs (pure logic).
import { shortestPath, pathLength } from './graph.js';

const BAYS = ['B1', 'B2', 'B3'];
export const CHARGE_THRESHOLD = 0.30;

/**
 * @param {{graph: object, stations: Record<string,{node:string}>}} opts
 */
export function createMissionManager({ graph, stations }) {
    const queue = [];
    let nextId = 1040;
    let bay = 0;
    const make = (type, from, to) => ({ id: `M${nextId++}`, type, from, to });

    function distance(fromNode, toNode) {
        const p = shortestPath(graph, fromNode, toNode);
        return p ? pathLength(graph, p) : Infinity;
    }

    return {
        palletReady(stationId) {
            queue.push(make(`${stationId}→IN`, stationId, 'ASRS_IN'));
        },
        palletAvailableAtOut() {
            const to = BAYS[bay++ % BAYS.length];
            queue.push(make(`OUT→${to}`, 'ASRS_OUT', to));
        },
        pending: () => [...queue],

        /**
         * @param {{id:string, node:string, battery:number}[]} free  LGVs able to take work now
         * @param {{chargerFree:boolean, canStart?:(mission)=>boolean}} ctx  canStart: false keeps a mission queued
         *        (e.g. its pick station is still occupied by another LGV)
         * @returns {{lgvId:string, mission:{id:string,type:string,from:string|null,to:string}}[]}
         */
        next(free, { chargerFree, canStart = () => true }) {
            const out = [];
            const available = [...free];
            // low batteries first: they go charging instead of taking work
            if (chargerFree) {
                const low = available.filter((l) => l.battery < CHARGE_THRESHOLD).sort((a, b) => a.battery - b.battery)[0];
                if (low) {
                    out.push({ lgvId: low.id, mission: make('CHARGE', null, 'C1') });
                    available.splice(available.indexOf(low), 1);
                }
            }
            const workers = available.filter((l) => l.battery >= CHARGE_THRESHOLD);
            for (let i = 0; i < queue.length && workers.length;) {
                const mission = queue[i];
                if (!canStart(mission)) { i++; continue; }
                const pick = stations[mission.from].node;
                workers.sort((a, b) => distance(a.node, pick) - distance(b.node, pick));
                const lgv = workers.shift();
                queue.splice(i, 1);
                out.push({ lgvId: lgv.id, mission });
            }
            return out;
        },
    };
}
