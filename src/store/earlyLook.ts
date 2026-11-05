// Build-out item 1.5.2c: a reload in a dark look must never flash a light page. main.tsx applies
// the saved look before React draws anything, but the browser can paint the page before the app's
// module (and, while developing, its styles) has loaded. So vite.config.ts puts the small script
// below into index.html's <head>: it runs before the page's body exists and, when the saved look
// is a dark one, sets data-look on <html> and asks for a dark canvas. main.tsx then applies the
// look again with the full checks (src/store/look.ts).
//
// Pure: it builds the script's text; nothing here touches the page. It imports nothing, so
// vite.config.ts can load it as it is.

/** The looks drawn on a dark page (theme.css sets color-scheme: dark in each; src/store/look.ts). */
export const DARK_LOOKS: readonly string[] = ['night']

/**
 * The script's text. `lookKey` is this build's look key (keys.ts). Only a dark look needs to be
 * applied this early; any other saved value is left to main.tsx, so the page starts light.
 * It never throws: blocked storage leaves the page as it is.
 */
export function earlyLookScript(lookKey: string, darkLooks: readonly string[] = DARK_LOOKS): string {
  return [
    '(function () {',
    '  try {',
    `    var look = localStorage.getItem(${JSON.stringify(lookKey)});`,
    `    if (${JSON.stringify(darkLooks)}.indexOf(look) < 0) return;`,
    "    document.documentElement.setAttribute('data-look', look);",
    "    var meta = document.querySelector('meta[name=\"color-scheme\"]');",
    "    if (meta) meta.setAttribute('content', 'dark');",
    '  } catch (e) {}',
    '})();',
  ].join('\n')
}
