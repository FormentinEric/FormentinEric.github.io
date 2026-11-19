// Watch panel: live variables of the selected LGV (updated at most 5 times per second).
const FIELDS = [
    ['id', 'LGV'], ['state', 'State'], ['mission', 'Mission'], ['zone', 'Zone'],
    ['pos', 'Position'], ['speed', 'Speed'], ['battery', 'Battery'], ['load', 'Load'],
];

export function createWatch(el) {
    const dl = document.createElement('dl');
    dl.className = 'watch';
    const values = {};
    for (const [key, label] of FIELDS) {
        const dt = document.createElement('dt');
        dt.textContent = label;
        const dd = document.createElement('dd');
        dd.dataset.key = key;
        values[key] = dd;
        dl.append(dt, dd);
    }
    const bar = document.createElement('span');
    bar.className = 'battery-bar';
    const fill = document.createElement('span');
    bar.append(fill);
    const pct = document.createElement('span');
    values.battery.append(bar, pct);
    el.append(dl);
    let last = 0;

    return {
        update(s, force = false) {
            const now = performance.now();
            if (!s || (!force && now - last < 200)) return;
            last = now;
            values.id.textContent = `LGV-${s.id}`;
            values.state.textContent = s.state;
            values.state.dataset.state = s.state;
            values.mission.textContent = s.missionId ? `${s.missionId} ${s.missionType}` : '—';
            values.zone.textContent = s.zone ?? (s.station ? `docked @ ${s.station}` : '—');
            values.pos.textContent = `(${s.x.toFixed(1)}, ${s.z.toFixed(1)})`;
            values.speed.textContent = `${Math.abs(s.speed).toFixed(2)} m/s`;
            const b = Math.max(0, Math.min(1, s.battery));
            fill.style.width = `${Math.round(b * 100)}%`;
            fill.classList.toggle('low', b < 0.3);
            pct.textContent = ` ${Math.round(b * 100)}%`;
            values.load.textContent = s.loaded ? 'pallet' : 'empty';
        },
    };
}
