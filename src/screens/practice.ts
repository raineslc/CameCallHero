// Practice screen placeholder; Phase 5 replaces it with the game.

import { TURKEY_CALLS } from '../calls/turkey';

export function practiceScreen(root: HTMLElement, id: string): void {
  const call = TURKEY_CALLS.find((c) => c.id === id);
  root.innerHTML = `
    <h2>Practice${call ? `: ${call.name}` : ''}</h2>
    <p>Practice is coming in the next update.</p>
    <a class="btn" href="${call ? `#/call/${call.id}` : '#/'}">Back</a>
  `;
}
