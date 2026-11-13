// Minimal types for the Node APIs the tests use.
// shortcut: hand-written instead of adding @types/node; add that package if tests need more of Node.
declare module 'node:fs' {
  export function readFileSync(path: string | URL): Uint8Array;
  export function readFileSync(path: string | URL, encoding: 'utf8'): string;
  export function readdirSync(path: string | URL): string[];
  export function existsSync(path: string | URL): boolean;
}
declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string;
}
declare module 'node:fs' {
  export function writeFileSync(path: string | URL, data: Uint8Array): void;
  export function mkdirSync(path: string | URL, options?: { recursive?: boolean }): void;
}
declare const process: { env: Record<string, string | undefined> };
