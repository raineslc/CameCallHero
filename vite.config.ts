import { defineConfig } from 'vite';

// Relative base: the build works under any path (GitHub Pages /<repo>/, a renamed repo, a
// local folder). Hash routing keeps every screen on the one index.html, so './' always
// resolves next to it.
export default defineConfig({ base: './' });
