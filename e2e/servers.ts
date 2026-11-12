// Ports and path prefixes of the preview servers (playwright.config.ts starts them).
export const port = 4173;
// A second server shows the same build under another path (the repo may be renamed; Pages
// serves /<repo>/). The build uses relative URLs, so it must work under any prefix.
export const otherPort = 4174;
export const otherPrefix = '/mirror/GameCallHero/';
