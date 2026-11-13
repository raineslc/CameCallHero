// Hash routing: #/ home, #/mic mic check, #/call/<id> call detail, #/practice/<id> practice. The first path segment
// picks the route; the rest is passed to the screen as `param` ('' if none). A first segment
// that is a scope (a species id) is moved into the param: #/<scope> is home with param
// '<scope>', #/<scope>/call/<id> is the call route with param '<scope>/<id>'. A screen renders
// into `root` and may return a cleanup function, called when the user leaves the screen
// (releases mic, audio, timers, URLs). After each render the page title names the screen (its
// first h2), and on every navigation after the first that heading takes the focus, so a screen
// reader announces the new screen and keyboard focus starts at its top.

export type Screen = (root: HTMLElement, param: string) => (() => void) | void;

/**
 * Splits '/call/gobble' into ['/call', 'gobble'] and '/' into ['/', '']. With scope 'barred-owl',
 * '/barred-owl/call/x' gives ['/call', 'barred-owl/x'] and '/barred-owl' gives ['/', 'barred-owl'].
 */
export function matchRoute(path: string, routes: Record<string, unknown>, fallback: string, scopes: readonly string[] = []): [string, string] {
  const [, first = '', ...rest] = path.split('/');
  if (scopes.includes(first)) {
    const [second = '', ...more] = rest;
    if (second === '') return ['/', first];
    const key = `/${second}`;
    return key in routes && key !== '/' ? [key, [first, ...more].join('/')] : [fallback, ''];
  }
  const key = `/${first}`;
  return key in routes ? [key, rest.join('/')] : [fallback, ''];
}

/**
 * Where the header's back button goes from a route: practice → its call, a species' challenge →
 * its home, other inner screens → home (the scope's home for a scoped param such as 'barred-owl/x'), home → none.
 */
export function backHref(route: string, param: string): string | null {
  if (route === '/') return null;
  const slash = param.indexOf('/');
  const scope = slash < 0 ? '' : param.slice(0, slash);
  if (route === '/practice' && param) return scope ? `#/${scope}/call/${param.slice(slash + 1)}` : `#/call/${param}`;
  if (route === '/call' && scope) return `#/${scope}`;
  // The challenge param is the species id ('' for turkey): back to that species' home.
  if (route === '/challenge' && param) return `#/${param}`;
  return '#/';
}

export function startRouter(
  root: HTMLElement,
  routes: Record<string, Screen>,
  fallback = '/',
  onRender?: (route: string, param: string) => void,
  scopes: readonly string[] = [],
): void {
  let cleanup: (() => void) | undefined;
  let first = true;
  const appName = document.title;
  const leave = () => {
    const done = cleanup;
    cleanup = undefined;
    done?.();
  };
  const render = () => {
    leave();
    const path = location.hash.replace(/^#/, '') || fallback;
    const [route, param] = matchRoute(path, routes, fallback, scopes);
    onRender?.(route, param);
    root.replaceChildren();
    window.scrollTo(0, 0);
    cleanup = routes[route](root, param) ?? undefined;
    const heading = root.querySelector<HTMLElement>('h2');
    document.title = heading?.textContent ? `${heading.textContent} · ${appName}` : appName;
    if (heading && !first) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
    first = false;
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
