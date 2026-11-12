// Ports and path prefixes of the preview servers (playwright.config.ts starts them).
export const port = 4173;
// A second server shows the same build under another path (Pages serves /<repo>/, and the repo was
// renamed once). The build uses relative URLs, so it must work under any prefix.
export const otherPort = 4174;
export const otherPrefix = '/mirror/OtherName/';
