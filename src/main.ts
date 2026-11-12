import './styles/theme.css';

const calls = ['Yelp', 'Cut', 'Purr', 'Gobble', 'Kee kee run'];

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="camo"><h1>Came<span class="accent">Call</span>Hero</h1></header>
  <main>
    <h2>Wild turkey</h2>
    <ul class="calls">${calls.map((c) => `<li>${c}</li>`).join('')}</ul>
    <p class="muted">Practice screens are under construction.</p>
  </main>
`;
