// Hash routing: #/ home, #/mic mic check, #/call/<id> call detail, #/practice/<id> practice. The first path segment
// picks the route; the rest is passed to the screen as `param` ('' if none). A screen renders
// into `root` and may return a cleanup function, called when the user leaves the screen
// (releases mic, audio, timers, URLs).

export type Screen = (root: HTMLElement, param: string) => (() => void) | void;

/** Splits '/call/gobble' into ['/call', 'gobble'] and '/' into ['/', '']. */
export function matchRoute(path: string, routes: Record<string, unknown>, fallback: string): [string, string] {
  const [, first = '', ...rest] = path.split('/');
  const key = `/${first}`;
  return key in routes ? [key, rest.join('/')] : [fallback, ''];
}

/** Where the header's back button goes from a route: practice → its call, other inner screens → home, home → none. */
export function backHref(route: string, param: string): string | null {
  if (route === '/') return null;
  if (route === '/practice' && param) return `#/call/${param}`;
  return '#/';
}

export function startRouter(
  root: HTMLElement,
  routes: Record<string, Screen>,
  fallback = '/',
  onRender?: (route: string, param: string) => void,
): void {
  let cleanup: (() => void) | undefined;
  const leave = () => {
    const done = cleanup;
    cleanup = undefined;
    done?.();
  };
  const render = () => {
    leave();
    const path = location.hash.replace(/^#/, '') || fallback;
    const [route, param] = matchRoute(path, routes, fallback);
    onRender?.(route, param);
    root.replaceChildren();
    window.scrollTo(0, 0);
    cleanup = routes[route](root, param) ?? undefined;
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
