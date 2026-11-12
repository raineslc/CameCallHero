import './styles/theme.css';
import { startRouter } from './router';
import { homeScreen } from './screens/home';
import { micCheckScreen } from './screens/mic-check';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="camo">
    <h1>Came<span class="accent">Call</span>Hero</h1>
    <nav><a href="#/">Calls</a><a href="#/mic">Mic check</a></nav>
  </header>
  <main id="screen"></main>
`;

startRouter(document.querySelector<HTMLElement>('#screen')!, { '/': homeScreen, '/mic': micCheckScreen });
