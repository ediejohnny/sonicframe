/**
 * Known XSS payloads, and the check that none of them became a page element: what a CMS's author
 * or a hostile file could put in any text SonicFrame shows.
 */

import { expect } from 'vite-plus/test';

/** Payloads that would run if read as HTML (none holds " - ", which an M3U reads as "artist - title"). */
export const PAYLOADS: readonly string[] = [
    '<img src=x onerror=alert(1)>',
    '"><svg onload=alert(2)>',
    '<script>alert(3)</script>',
    '&amp;lt;script&amp;gt;',
    "' onmouseover='alert(4)",
];

/** An address scheme that runs code or carries a document. */
const UNSAFE_SCHEME = /^\s*(?:javascript|vbscript|data):/i;

/** The attributes that hold an address. */
const ADDRESSES = new Set([
    'href',
    'src',
    'xlink:href',
    'action',
    'formaction',
    'poster',
]);

/**
 * Inside `root`: no script, frame or plugin element, no `on…` attribute, and no address with a scheme
 * that runs code; so no payload became an element or a handler.
 */
export function expectNothingInjected(root: ParentNode): void {
    expect(
        root.querySelectorAll('script, iframe, frame, object, embed'),
        'script-like elements',
    ).toHaveLength(0);

    for (const element of root.querySelectorAll('*')) {
        for (const { name, value } of element.attributes) {
            expect(name.startsWith('on'), `${element.tagName} ${name}`).toBe(
                false,
            );

            if (ADDRESSES.has(name)) {
                expect(
                    UNSAFE_SCHEME.test(value),
                    `${element.tagName} ${name}="${value}"`,
                ).toBe(false);
            }
        }
    }
}
