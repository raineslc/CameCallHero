import './styles/theme.css';
import { startRouter } from './router';
import { callDetailScreen } from './screens/call-detail';
import { homeScreen } from './screens/home';
import { micCheckScreen } from './screens/mic-check';
import { practiceScreen } from './screens/practice';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="camo">
    <h1>Came<span class="accent">Call</span>Hero</h1>
    <nav><a href="#/">Calls</a><a href="#/mic">Mic check</a></nav>
  </header>
  <main id="screen"></main>
  <footer>
    <p class="muted">Practice tool. Check your state's rules on electronic calls.</p>
    <p><a class="footer-link" href="https://github.com/raineslc/CameCallHero/issues/new?template=feedback.yml" target="_blank" rel="noopener">Send feedback</a></p>
  </footer>
`;

startRouter(document.querySelector<HTMLElement>('#screen')!, {
  '/': homeScreen,
  '/mic': micCheckScreen,
  '/call': callDetailScreen,
  '/practice': practiceScreen,
});
