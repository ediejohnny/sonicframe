/**
 * Loading a font the app brings: a font file through `FontFace`, or a stylesheet that declares it (as
 * online font services give) through a `<link>`. Each one loads once per page; a failure is forgotten
 * so a later player can try again. The addresses arrive already checked (`safeFontUrl`), and the
 * page's Content-Security-Policy still decides what may load.
 */

import type { FontLoad } from '../core/fonts';

const loads = new Map<string, Promise<void>>();

/** Loads what `load` names, once per page; resolves when it is ready to use. */
export function loadFont(load: FontLoad): Promise<void> {
    const key = `${load.family}\n${load.src ?? ''}\n${load.stylesheet ?? ''}`;
    let pending = loads.get(key);

    if (pending === undefined) {
        pending = start(load);
        loads.set(key, pending);
        pending.catch(() => loads.delete(key));
    }

    return pending;
}

async function start(load: FontLoad): Promise<void> {
    if (load.stylesheet !== undefined) {
        await linkStylesheet(load.stylesheet);
    }

    if (
        load.src === undefined ||
        typeof FontFace !== 'function' ||
        document.fonts === undefined
    ) {
        return;
    }

    // The address holds no quote, parenthesis, backslash or space, so it cannot leave url("…").
    const face = new FontFace(load.family, `url("${load.src}")`);
    document.fonts.add(face);
    await face.load();
}

function linkStylesheet(href: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.addEventListener('load', () => resolve(), { once: true });
        link.addEventListener(
            'error',
            () =>
                reject(
                    new Error(
                        `sonicframe: could not load the font stylesheet ${href}`,
                    ),
                ),
            { once: true },
        );
        document.head.append(link);
    });
}
