/**
 * The theme gallery: the twenty-four themes in three sets of eight columns, each in the eight
 * palettes (rows), so sixty-four players at once. They all play one shared `<audio>`, so they move
 * together. The toolbar lays one drawing, font or the volume control over every player; touching a
 * player picks it and shows its code. Run `npm run dev` and open /playground/themes.html.
 */

import { WAVE_NAMES, type WaveName } from '../src/index';
import {
    createPlayer,
    FONT_NAMES,
    PALETTE_NAMES,
    PALETTES,
    THEME_NAMES,
    type FontName,
    type PaletteName,
    type Player,
    type ThemeName,
} from '../src/player';
import {
    bundledSound,
    byId,
    forget,
    pickSound,
    setupCopyButtons,
    setupHeader,
    type Sound,
} from './site';

/** Themes per set, one column each. */
const PER_SET = 8;

const THEMES = THEME_NAMES.filter((name) => name !== 'default');

const SETS: ThemeName[][] = Array.from(
    { length: Math.ceil(THEMES.length / PER_SET) },
    (_, set) => THEMES.slice(set * PER_SET, set * PER_SET + PER_SET),
);

/** The palette colors shown next to its name. */
const SWATCHES = ['surface', 'wave', 'progress', 'marker'] as const;

type Pick = { theme: ThemeName; palette: PaletteName };

const audio = document.createElement('audio');
audio.preload = 'metadata';
document.body.append(audio);

const grid = byId('grid');
const waveSelect = byId<HTMLSelectElement>('wave');
const fontSelect = byId<HTMLSelectElement>('font');
const volumeBox = byId<HTMLInputElement>('volume');

let players: Player[] = [];
let set = 0;
let sound: Sound | null = null;
let picked: Pick = { theme: SETS[0][0], palette: 'light' };

function chosenWave(): WaveName | undefined {
    return (waveSelect.value || undefined) as WaveName | undefined;
}

function chosenFont(): FontName | undefined {
    return (fontSelect.value || undefined) as FontName | undefined;
}

function options(select: HTMLSelectElement, names: readonly string[]): void {
    const own = document.createElement('option');
    own.value = '';
    own.textContent = 'The theme’s own';
    select.append(own);

    for (const name of names) {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.append(option);
    }
}

function cell(className: string, text: string): HTMLElement {
    const element = document.createElement('div');
    element.className = className;
    element.textContent = text;
    grid.append(element);

    return element;
}

function rowHead(palette: PaletteName): void {
    const head = cell('row-head', palette);
    const swatches = document.createElement('span');
    swatches.className = 'swatches';
    swatches.setAttribute('aria-hidden', 'true');

    for (const key of SWATCHES) {
        const swatch = document.createElement('span');
        swatch.style.setProperty('background-color', PALETTES[palette][key]);
        swatches.append(swatch);
    }

    head.append(swatches);
}

/** Builds the grid for the current set; every player shares the one `<audio>`. */
function build(): void {
    for (const player of players) {
        player.destroy();
    }

    players = [];
    grid.replaceChildren();

    if (sound === null) {
        return;
    }

    const themes = SETS[set];
    cell('corner', 'Palette');

    for (const theme of themes) {
        cell('col-head', theme);
    }

    for (const palette of PALETTE_NAMES) {
        rowHead(palette);

        for (const theme of themes) {
            const box = cell('cell', '');
            box.dataset.theme = theme;
            box.dataset.palette = palette;
            // The palette's own background, so players without a surface stay readable.
            box.style.setProperty(
                'background-color',
                PALETTES[palette].surface,
            );

            const player = createPlayer({
                container: box,
                media: audio,
                peaks: sound.peaks,
                duration: sound.duration,
                theme,
                palette,
                wave: chosenWave(),
                font: chosenFont(),
                volume: volumeBox.checked,
                label: `${theme} in ${palette}`,
            });
            player.on('error', (error) => console.error(error));
            players.push(player);
        }
    }

    if (!themes.includes(picked.theme)) {
        picked = { theme: themes[0], palette: picked.palette };
    }

    showPick();
}

function jsCode(pick: Pick): string {
    const lines = [
        `    container: document.querySelector('#player'),`,
        `    src: '/voice.mp3',`,
        `    theme: '${pick.theme}',`,
        `    palette: '${pick.palette}',`,
    ];
    const wave = chosenWave();
    const font = chosenFont();

    if (wave !== undefined) {
        lines.push(`    wave: '${wave}',`);
    }

    if (font !== undefined) {
        lines.push(`    font: '${font}',`);
    }

    if (volumeBox.checked) {
        lines.push(`    volume: true,`);
    }

    return [
        `import { createPlayer } from 'sonicframe/player';`,
        '',
        'createPlayer({',
        ...lines,
        '});',
    ].join('\n');
}

function tagCode(pick: Pick): string {
    const attributes = [
        `src="/voice.mp3"`,
        `theme="${pick.theme}"`,
        `palette="${pick.palette}"`,
    ];
    const wave = chosenWave();
    const font = chosenFont();

    if (wave !== undefined) {
        attributes.push(`wave="${wave}"`);
    }

    if (font !== undefined) {
        attributes.push(`font="${font}"`);
    }

    if (volumeBox.checked) {
        attributes.push('volume');
    }

    return [
        '<sonic-player',
        ...attributes.map((attribute) => `    ${attribute}`),
        '></sonic-player>',
    ].join('\n');
}

/** Marks the picked player and shows its code. */
function showPick(): void {
    for (const box of grid.querySelectorAll<HTMLElement>('.cell')) {
        const on =
            box.dataset.theme === picked.theme &&
            box.dataset.palette === picked.palette;

        if (on) {
            box.setAttribute('aria-current', 'true');
        } else {
            box.removeAttribute('aria-current');
        }
    }

    byId('picked-name').textContent =
        `The ${picked.theme} theme in the ${picked.palette} palette.`;
    byId('picked-js').textContent = jsCode(picked);
    byId('picked-tag').textContent = tagCode(picked);
}

function pickFrom(target: EventTarget | null): void {
    const box =
        target instanceof Element ? target.closest<HTMLElement>('.cell') : null;
    const theme = box?.dataset.theme as ThemeName | undefined;
    const palette = box?.dataset.palette as PaletteName | undefined;

    if (theme !== undefined && palette !== undefined) {
        picked = { theme, palette };
        showPick();
    }
}

function setupSets(): void {
    const group = byId('sets');
    const buttons = SETS.map((themes, index) => {
        const button = document.createElement('button');
        const first = index * PER_SET + 1;
        button.type = 'button';
        button.className = 'button small';
        button.textContent = `${first}–${first + themes.length - 1}`;
        button.title = themes.join(', ');
        button.setAttribute('aria-pressed', String(index === set));
        button.addEventListener('click', () => {
            set = index;
            buttons.forEach((each, at) =>
                each.setAttribute('aria-pressed', String(at === index)),
            );
            build();
        });
        group.append(button);

        return button;
    });
}

function setupToolbar(): void {
    options(waveSelect, WAVE_NAMES);
    options(fontSelect, FONT_NAMES);

    waveSelect.addEventListener('change', () => {
        players.forEach((player) => player.setWave(chosenWave()));
        showPick();
    });
    fontSelect.addEventListener('change', () => {
        players.forEach((player) => player.setFont(chosenFont()));
        showPick();
    });
    volumeBox.addEventListener('change', () => {
        players.forEach((player) => player.setVolume(volumeBox.checked));
        showPick();
    });
    grid.addEventListener('pointerdown', (event) => pickFrom(event.target));
    grid.addEventListener('focusin', (event) => pickFrom(event.target));
}

function use(next: Sound): void {
    const previous = sound;
    sound = next;
    audio.src = next.url;
    build();
    byId('source').textContent = `Playing ${next.name}.`;

    if (previous !== null) {
        forget(previous);
    }
}

// Every player here wears its own palette, so the page's light or dark scheme repaints nothing.
setupHeader(() => undefined);
setupCopyButtons();
setupSets();
setupToolbar();
pickSound(
    byId<HTMLButtonElement>('pick'),
    byId<HTMLInputElement>('file'),
    use,
    (error: unknown) => {
        console.error(error);
        byId('source').textContent =
            'That file could not be read as audio. Try an MP3, WAV, OGG or M4A file.';
    },
);

bundledSound().then(use, (error: unknown) => {
    console.error(error);
    byId('source').textContent =
        'The page’s sound did not load. Use your own sound instead.';
});
