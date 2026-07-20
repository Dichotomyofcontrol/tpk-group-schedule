// Recurrence engine for the Schedule flow (3e). Pure, timezone-safe (local Date parts).
export function fmtDate(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function parseDateLocal(s) { const [y,m,d] = String(s).split('-').map(Number); return new Date(y, m-1, d); }
export function ordinalOfWeekdayInMonth(date) { return Math.floor((date.getDate() - 1) / 7) + 1; } // 1..5
export function nthWeekdayOfMonth(year, month, weekday, nth) {
    // month 0-based; nth 1..4 or -1 (last); returns Date or null if that occurrence doesn't exist
    if (nth === -1) {
        const last = new Date(year, month + 1, 0);
        const offset = (last.getDay() - weekday + 7) % 7;
        return new Date(year, month, last.getDate() - offset);
    }
    const first = new Date(year, month, 1);
    const offset = (weekday - first.getDay() + 7) % 7;
    const day = 1 + offset + (nth - 1) * 7;
    const d = new Date(year, month, day);
    return d.getMonth() === month ? d : null;
}
// opts: { start:'YYYY-MM-DD', freq:'weeks'|'months', interval:N,
//         monthlyMode:'date'|'weekday', end:{type:'until',date} | {type:'count',n} }
export function generateSessionDates(opts) {
    const CAP = 200;
    const start = parseDateLocal(opts.start);
    if (isNaN(start)) return [];
    const interval = Math.max(1, Math.floor(opts.interval || 1));
    const until = opts.end && opts.end.type === 'until' && opts.end.date ? parseDateLocal(opts.end.date) : null;
    const maxCount = opts.end && opts.end.type === 'count' ? Math.max(1, Math.floor(opts.end.n || 1)) : Infinity;
    const limit = Math.min(maxCount, CAP);
    const out = [];
    if (opts.freq === 'weeks') {
        let cur = new Date(start);
        while (out.length < limit) {
            if (until && cur > until) break;
            out.push(fmtDate(cur));
            cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + interval * 7);
        }
    } else { // months
        const weekday = start.getDay();
        let ordinal = ordinalOfWeekdayInMonth(start);
        if (ordinal > 4) ordinal = -1;          // 5th occurrence → treat as "last"
        const dayOfMonth = start.getDate();
        let y = start.getFullYear(), m = start.getMonth(), steps = 0;
        while (out.length < limit && steps < CAP) {
            let d;
            if (opts.monthlyMode === 'weekday') {
                d = nthWeekdayOfMonth(y, m, weekday, ordinal);
            } else {
                const lastDay = new Date(y, m + 1, 0).getDate();
                d = new Date(y, m, Math.min(dayOfMonth, lastDay));
            }
            if (d) {
                if (until && d > until) break;
                out.push(fmtDate(d));
            }
            m += interval; while (m > 11) { m -= 12; y++; }
            steps++;
        }
    }
    return out;
}
