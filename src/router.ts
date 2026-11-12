// Hash routing: #/ home, #/mic mic check. A screen renders into `root` and may return a
// cleanup function, called when the user leaves the screen (releases mic, timers, URLs).

export type Screen = (root: HTMLElement) => (() => void) | void;

export function startRouter(root: HTMLElement, routes: Record<string, Screen>, fallback = '/'): void {
  let cleanup: (() => void) | undefined;
  const leave = () => {
    const done = cleanup;
    cleanup = undefined;
    done?.();
  };
  const render = () => {
    leave();
    const path = location.hash.replace(/^#/, '') || fallback;
    const route = path in routes ? path : fallback;
    root.replaceChildren();
    cleanup = routes[route](root) ?? undefined;
    document.querySelectorAll<HTMLAnchorElement>('nav a').forEach((a) => {
      if (a.getAttribute('href') === `#${route}`) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  };
  window.addEventListener('hashchange', render);
  window.addEventListener('pagehide', leave);
  // Back/forward cache restores the page after pagehide ran the cleanup: render afresh.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) render();
  });
  render();
}
