import './styles/theme.css';
import { SPECIES } from './calls/species';
import { backHref, startRouter } from './router';
import { callDetailScreen } from './screens/call-detail';
import { homeScreen } from './screens/home';
import { micCheckScreen } from './screens/mic-check';
import { practiceScreen } from './screens/practice';

// Slim sticky header on the camo band. Every piece of text sits on its own solid plate.
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="camo topbar">
    <a class="plate icon-btn" id="nav-back" href="#/" aria-label="Back" hidden><span aria-hidden="true">←</span></a>
    <h1 class="plate brand">Game <span class="accent">Call</span> Hero</h1>
    <nav><a class="plate" href="#/">Calls</a><a class="plate" href="#/mic">Mic check</a></nav>
  </header>
  <main id="screen"></main>
  <footer>
    <p class="muted">Practice tool. Check your state's rules on electronic calls.</p>
    <p><a class="footer-link" href="https://github.com/raineslc/GameCallHero/issues/new?template=feedback.yml" target="_blank" rel="noopener">Send feedback</a></p>
  </footer>
`;

const back = document.querySelector<HTMLAnchorElement>('#nav-back')!;

startRouter(
  document.querySelector<HTMLElement>('#screen')!,
  {
    '/': homeScreen,
    '/mic': micCheckScreen,
    '/call': callDetailScreen,
    '/practice': practiceScreen,
  },
  '/',
  (route, param) => {
    const href = backHref(route, param);
    back.hidden = href === null;
    if (href) back.href = href;
  },
  SPECIES.map((s) => s.id),
);
