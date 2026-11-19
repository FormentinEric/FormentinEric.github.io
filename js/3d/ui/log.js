// Event log: newest first, at most `max` lines; time is simulated time mm:ss.
const fmt = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export function createLog(el, { max = 8 } = {}) {
    return {
        push(e) {
            const li = document.createElement('li');
            li.className = `log-${e.type || 'info'}`;
            const time = document.createElement('time');
            time.textContent = fmt(e.t || 0);
            li.append(time, document.createTextNode(` ${e.text}`));
            el.prepend(li);
            while (el.children.length > max) el.lastElementChild.remove();
        },
    };
}
