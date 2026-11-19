// SCADA bar: plant KPIs.
export function createScadaBar(el) {
    const items = {};
    for (const [key, label] of [['missionsPerHour', 'Missions/h'], ['online', 'LGV online'], ['alarms', 'Alarms'], ['asrsFill', 'AS/RS fill']]) {
        const item = document.createElement('div');
        item.className = 'kpi';
        const v = document.createElement('strong');
        v.textContent = '—';
        const l = document.createElement('span');
        l.textContent = label;
        item.append(v, l);
        el.append(item);
        items[key] = { item, v };
    }
    let last = 0, lastAlarms = -1;
    return {
        /** Refreshes twice a second, and at once when the number of alarms changes. */
        update({ missionsPerHour, online, alarms, asrsFill }) {
            const now = performance.now();
            if (now - last < 500 && alarms === lastAlarms) return;
            last = now;
            lastAlarms = alarms;
            items.missionsPerHour.v.textContent = String(Math.round(missionsPerHour));
            items.online.v.textContent = online;
            items.alarms.v.textContent = String(alarms);
            items.alarms.item.classList.toggle('alarm', alarms > 0);
            items.asrsFill.v.textContent = `${Math.round(asrsFill * 100)}%`;
        },
    };
}
