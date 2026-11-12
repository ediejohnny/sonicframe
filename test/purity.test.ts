/**
 * Guards for how the package is built: the core never touches the page (so it runs anywhere and is
 * tested here, in Node), and nothing is imported from outside the package (no runtime dependency).
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';
import { VERSION } from '../src/index';

const root = join(import.meta.dirname, '..');

function sources(folder: string): string[] {
    return readdirSync(join(root, folder), {
        recursive: true,
        encoding: 'utf8',
    })
        .filter((file) => file.endsWith('.ts'))
        .map((file) => join(root, folder, file));
}

/** The code without comments and strings, so prose that mentions "the page" does not count. */
function code(file: string): string {
    return readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
        .replace(/'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g, "''");
}

/** Every module a file imports or re-exports from, side-effect imports included. */
function imports(file: string): string[] {
    const text = readFileSync(file, 'utf8');

    return [
        ...text.matchAll(/^\s*(?:import|export)\b[^;]*?\bfrom\s+'([^']+)'/gm),
        ...text.matchAll(/^\s*import\s+'([^']+)'/gm),
    ].map((match) => match[1]);
}

/**
 * The layers each layer of src/ may import, besides itself and the package's types (src/types.ts):
 * core <- dom <- controls and plugins <- player <- record and playlist <- the entries. A layer never
 * reaches up or sideways, so the core runs anywhere, a plugin never needs the player, and only the
 * recorder (which plays back what it recorded on a player) and the playlist (a player for each track)
 * reach the player.
 */
const LAYERS: Readonly<Record<string, readonly string[]>> = {
    core: [],
    dom: ['core'],
    controls: ['core', 'dom'],
    plugins: ['core', 'dom'],
    player: ['core', 'dom', 'controls', 'plugins'],
    record: ['core', 'dom', 'controls', 'plugins', 'player'],
    playlist: ['core', 'dom', 'controls', 'plugins', 'player'],
};

/** The folders under `folder`, by name. */
function folders(folder: string): string[] {
    return readdirSync(join(root, folder), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
}

// The core must not reach for anything only the page has. This grew in 0.2.0 with the Web Audio,
// media-recording, worker, timer and blob names the new features use in the DOM layer only.
// `URL`, `Intl` and `queueMicrotask` stay allowed: they are standard in Node as well.
const DOM_NAMES =
    /\b(window|document|navigator|globalThis|location|HTMLElement|HTMLMediaElement|HTMLCanvasElement|CanvasRenderingContext2D|OffscreenCanvas|Path2D|ImageData|requestAnimationFrame|cancelAnimationFrame|setTimeout|setInterval|ResizeObserver|IntersectionObserver|matchMedia|getComputedStyle|devicePixelRatio|addEventListener|Event|AudioContext|OfflineAudioContext|AnalyserNode|MediaRecorder|MediaStream|Worker|Blob)\b/;

describe('package boundaries', () => {
    it('keeps the core free of the page', () => {
        const files = sources('src/core');
        expect(files.length).toBeGreaterThan(5);

        for (const file of files) {
            expect(code(file), relative(root, file)).not.toMatch(DOM_NAMES);
        }
    });

    it('lets the core import only the core and shared types', () => {
        // The core is in subject folders: a file imports its own folder, another subject's folder,
        // or the package's types (src/types.ts) two folders up.
        for (const file of sources('src/core')) {
            for (const target of imports(file)) {
                expect(target, relative(root, file)).toMatch(
                    /^(\.\/[\w-]+|\.\.\/[\w-]+\/[\w-]+|\.\.\/\.\.\/types)$/,
                );
            }
        }
    });

    it('imports nothing from outside the package', () => {
        for (const file of sources('src')) {
            for (const target of imports(file)) {
                expect(target, relative(root, file)).toMatch(/^\.\.?\//);
            }
        }

        const manifest = JSON.parse(
            readFileSync(join(root, 'package.json'), 'utf8'),
        );
        expect(manifest.dependencies ?? {}).toEqual({});
        expect(manifest.peerDependencies ?? {}).toEqual({});
        expect(manifest.optionalDependencies ?? {}).toEqual({});
    });

    it('keeps each layer to the layers under it', () => {
        const source = join(root, 'src');
        expect(Object.keys(LAYERS).sort()).toEqual(folders('src').sort());

        for (const [layer, below] of Object.entries(LAYERS)) {
            for (const file of sources(`src/${layer}`)) {
                for (const target of imports(file)) {
                    const reached = relative(
                        source,
                        resolve(dirname(file), target),
                    ).split(sep)[0];

                    expect(
                        [layer, ...below, 'types'],
                        `${relative(root, file)} imports ${target}`,
                    ).toContain(reached);
                }
            }
        }
    });

    it('keeps every file of a layer in a subject folder', () => {
        for (const layer of Object.keys(LAYERS)) {
            const loose = readdirSync(join(root, 'src', layer), {
                withFileTypes: true,
            })
                .filter((entry) => entry.isFile())
                .map((entry) => entry.name);

            expect(loose, `src/${layer}`).toEqual([]);
        }
    });

    it('keeps every test where a test project runs it', () => {
        // vite.config.ts runs test/*.test.ts and test/core/ in Node, and test/dom, controls, plugins,
        // player, record, playlist and site under happy-dom: a test anywhere else would never run.
        const stray = sources('test')
            .map((file) =>
                relative(join(root, 'test'), file).split(sep).join('/'),
            )
            .filter(
                (file) =>
                    file.endsWith('.test.ts') &&
                    file.includes('/') &&
                    !/^(core|dom|controls|plugins|player|record|playlist|site)\//.test(
                        file,
                    ),
            );

        expect(stray).toEqual([]);
    });

    it('keeps the analysis entry importing only the core', () => {
        // src/analysis.ts is the `sonicframe/analysis` subpath: pure functions, safe in Node and in a
        // worker, so its import graph must stay inside the core.
        const file = join(root, 'src/analysis.ts');

        for (const target of imports(file)) {
            expect(target, 'src/analysis.ts').toMatch(
                /^\.\/core\/[\w-]+\/[\w-]+$/,
            );
        }
    });

    it('keeps the player entry to the player and the core', () => {
        // src/player.ts is the `sonicframe/player` subpath: it re-exports the player and the pure pieces
        // it is described by (looks, palettes, fonts), so the main entry never has to carry them.
        for (const target of imports(join(root, 'src/player.ts'))) {
            expect(target, 'src/player.ts').toMatch(
                /^\.\/(player|core)\/[\w-]+\/[\w-]+$/,
            );
        }
    });

    it('keeps the record entry to the recorder and the core', () => {
        // src/record.ts is the `sonicframe/record` subpath: an app that never records never loads it.
        for (const target of imports(join(root, 'src/record.ts'))) {
            expect(target, 'src/record.ts').toMatch(
                /^\.\/(record|core)\/[\w-]+\/[\w-]+$/,
            );
        }
    });

    it('keeps the playlist entry to the playlist and the core', () => {
        // src/playlist.ts is the `sonicframe/playlist` subpath: an app without a list never loads it.
        for (const target of imports(join(root, 'src/playlist.ts'))) {
            expect(target, 'src/playlist.ts').toMatch(
                /^\.\/(playlist|core)\/[\w-]+\/[\w-]+$/,
            );
        }
    });

    it('reports the version of the package', () => {
        const manifest = JSON.parse(
            readFileSync(join(root, 'package.json'), 'utf8'),
        );

        expect(VERSION).toBe(manifest.version);
    });
});
