// Design pass check used by the e2e tests (AGENTS.md "Design"): AA contrast against each text's
// own solid background, no text on camo, 44 px tap targets, no horizontal scroll. Runs in the page.

export interface Problem { text: string; issue: string }

/** Runs in the page: checks every visible element that holds its own text. */
export function audit(): Problem[] {
  const parse = (c: string): [number, number, number, number] => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return [0, 0, 0, 0];
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  };
  const lum = ([r, g, b]: number[]) => {
    const f = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const problems: Problem[] = [];
  for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
    const ownText = Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim() !== '');
    if (!ownText || el.closest('[hidden], [disabled], [aria-hidden="true"]')) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const text = el.textContent!.trim().slice(0, 40);
    // First ancestor (or self) with an opaque background decides what the text sits on.
    let bgEl: HTMLElement | null = el;
    while (bgEl && parse(getComputedStyle(bgEl).backgroundColor)[3] < 1) bgEl = bgEl.parentElement;
    if (bgEl?.classList.contains('camo')) {
      problems.push({ text, issue: 'text on camo' });
      continue;
    }
    const bg = parse(getComputedStyle(bgEl ?? document.body).backgroundColor);
    const fg = parse(getComputedStyle(el).color);
    const [a, b] = [lum(fg) + 0.05, lum(bg) + 0.05];
    const ratio = Math.max(a, b) / Math.min(a, b);
    if (ratio < 4.5) problems.push({ text, issue: `contrast ${ratio.toFixed(2)}` });
  }
  for (const el of Array.from(document.querySelectorAll<HTMLElement>('a, button'))) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height < 44) problems.push({ text: el.textContent!.trim(), issue: `tap height ${r.height}` });
  }
  if (document.documentElement.scrollWidth > document.documentElement.clientWidth) {
    problems.push({ text: '(page)', issue: 'horizontal scroll' });
  }
  return problems;
}

