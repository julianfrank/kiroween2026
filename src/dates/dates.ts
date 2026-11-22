// All dates in the app are Indian Standard Time (Asia/Kolkata) calendar dates.
// Stored and exchanged as ISO "YYYY-MM-DD". Shown to the user as "DD/MMM/YYYY".

export const IST = 'Asia/Kolkata';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const istParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: IST,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's date in IST, as YYYY-MM-DD, regardless of the computer's time zone. */
export function todayIso(now: Date = new Date()): string {
  return istParts.format(now); // en-CA formats as YYYY-MM-DD
}

function isRealDate(y: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** "2026-11-22" -> "22/Nov/2026". Returns the input unchanged if it is not an ISO date. */
export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${MONTHS[Number(m[2]) - 1]}/${m[1]}`;
}

/**
 * Read a date the user typed. Accepts DD/MMM/YYYY (22/Nov/2026), DD-MMM-YYYY, DD/MM/YYYY and
 * ISO YYYY-MM-DD. Returns ISO or null.
 */
export function parseDisplayDate(text: string): string | null {
  const t = text.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  let y: number, mo: number, d: number;
  if (iso) {
    [y, mo, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else {
    const m = /^(\d{1,2})[/\-. ]([A-Za-z]{3,9}|\d{1,2})[/\-. ](\d{4})$/.exec(t);
    if (!m) return null;
    d = Number(m[1]);
    y = Number(m[3]);
    if (/^\d+$/.test(m[2])) mo = Number(m[2]);
    else {
      mo = MONTHS.findIndex((x) => m[2].toLowerCase().startsWith(x.toLowerCase())) + 1;
      if (mo === 0) return null;
    }
  }
  if (!isRealDate(y, mo, d)) return null;
  return `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
