const calls = ['Yelp', 'Cut', 'Purr', 'Gobble', 'Kee kee run'];

export function homeScreen(root: HTMLElement): void {
  root.innerHTML = `
    <h2>Wild turkey</h2>
    <ul class="calls">${calls.map((c) => `<li>${c}</li>`).join('')}</ul>
    <p class="muted">Practice screens are under construction. Check your microphone first:</p>
    <a class="btn primary" href="#/mic">Mic check</a>
  `;
}
