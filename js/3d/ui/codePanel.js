// Code panel: illustrative C# with syntax colours; highlights the lines the selected LGV is "executing".
import { CODE_LINES, STATE_LINES } from './codeMap.js';

const TOKEN = /(\/\/.*$)|("[^"]*")|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)|(\s+)|(.)/g;
const KEYWORDS = new Set(['public', 'private', 'readonly', 'sealed', 'class', 'async', 'await', 'var', 'if', 'is',
    'not', 'null', 'return', 'break', 'case', 'switch', 'new', 'true', 'false']);

function span(cls, text) {
    const s = document.createElement('span');
    if (cls) s.className = cls;
    s.textContent = text;
    return s;
}

function highlight(line) {
    const out = [];
    for (const m of line.matchAll(TOKEN)) {
        const [text, comment, str, num, word] = m;
        if (comment) out.push(span('c-comment', text));
        else if (str) out.push(span('c-string', text));
        else if (num) out.push(span('c-number', text));
        else if (word) {
            const next = line.slice(m.index + text.length).trimStart()[0];
            if (KEYWORDS.has(word)) out.push(span('c-keyword', text));
            else if (next === '(') out.push(span('c-method', text));
            else if (/^[A-Z]/.test(word)) out.push(span('c-type', text));
            else out.push(document.createTextNode(text));
        } else out.push(document.createTextNode(text));
    }
    return out;
}

/** @param {HTMLElement} el  scrollable container */
export function createCodePanel(el) {
    const pre = document.createElement('pre');
    pre.className = 'code';
    const rows = CODE_LINES.map((line, i) => {
        const row = document.createElement('div');
        row.className = 'code-line';
        row.append(span('ln', String(i + 1)), ...highlight(line));
        pre.append(row);
        return row;
    });
    el.append(pre);
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    let current = null;

    return {
        setState(state) {
            if (state === current) return;
            current = state;
            const [a, b] = STATE_LINES[state] || [0, -1];
            rows.forEach((r, i) => r.classList.toggle('active', i + 1 >= a && i + 1 <= b));
            const first = rows[a - 1];
            // scroll inside the panel only (never the page)
            if (first) el.scrollTo({ top: Math.max(0, first.offsetTop - el.clientHeight / 3), behavior: smooth ? 'smooth' : 'auto' });
        },
    };
}
