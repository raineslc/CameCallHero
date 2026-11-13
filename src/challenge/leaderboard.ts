// Pass-the-phone leaderboard: the top challenge scores on this device, in localStorage.
// Nothing leaves the phone. Storage can be missing, throw or hold anything (another version,
// a hand edit): every read is validated, every access is wrapped, and a failure only means
// the board is not remembered. Names are plain text: shown with textContent and drawn on a
// canvas, never parsed as HTML.

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Same prefix as the practice storage (src/practice/storage.ts). */
export const BOARD_KEY = 'camecallhero.challenge.board';
export const BOARD_SIZE = 10;
export const NAME_MAX = 20;

export interface BoardEntry {
  name: string;
  /** Whole points, 0-100. */
  score: number;
  /** Local date of the take, YYYY-MM-DD. */
  date: string;
}

function defaultStore(): Store | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

// Control characters and bidirectional overrides (they would reorder the rest of a line).
const STRIP = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;

/** A player name as stored and shown: no control characters, single spaces, trimmed, at most NAME_MAX characters. */
export function cleanName(raw: unknown): string {
  const s = String(raw ?? '').replace(/\s+/g, ' ').replace(STRIP, '').replace(/ {2,}/g, ' ').trim();
  return Array.from(s).slice(0, NAME_MAX).join('').trim();
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Today's local date as YYYY-MM-DD. */
export function today(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function valid(e: unknown): BoardEntry | null {
  if (typeof e !== 'object' || e === null) return null;
  const { name, score, date } = e as Record<string, unknown>;
  const n = cleanName(typeof name === 'string' ? name : '');
  if (!n || typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 100) return null;
  if (typeof date !== 'string' || !DATE.test(date)) return null;
  return { name: n, score: Math.round(score), date };
}

/** Highest score first; equal scores keep their order (the earlier entry stays ahead). */
const sortBoard = (b: BoardEntry[]) => b.map((e, i) => [e, i] as const).sort((x, y) => y[0].score - x[0].score || x[1] - y[1]).map(([e]) => e);

export function loadBoard(store: Store | null = defaultStore()): BoardEntry[] {
  try {
    const raw = store?.getItem(BOARD_KEY);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return sortBoard(data.map(valid).filter((e): e is BoardEntry => e !== null)).slice(0, BOARD_SIZE);
  } catch {
    return [];
  }
}

export interface AddResult {
  board: BoardEntry[];
  /** 0-based place of the new entry, or -1 if it did not make the top BOARD_SIZE. */
  place: number;
  /** False when the browser would not store it (the board shown is still updated). */
  saved: boolean;
}

/** Adds a score. Returns null if the name is empty after cleaning or the score is not 0-100. */
export function addEntry(name: string, score: number, date = today(), store: Store | null = defaultStore()): AddResult | null {
  const entry = valid({ name, score, date });
  if (!entry) return null;
  const old = loadBoard(store);
  const board = sortBoard([...old, entry]).slice(0, BOARD_SIZE);
  const place = board.indexOf(entry);
  let saved = false;
  try {
    if (store) {
      store.setItem(BOARD_KEY, JSON.stringify(board));
      saved = true;
    }
  } catch {
    saved = false;
  }
  return { board, place, saved };
}

/** Removes every entry. Returns false if the browser would not. */
export function clearBoard(store: Store | null = defaultStore()): boolean {
  try {
    if (!store) return false;
    store.removeItem(BOARD_KEY);
    return true;
  } catch {
    return false;
  }
}
