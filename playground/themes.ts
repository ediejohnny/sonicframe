/**
 * The theme gallery: the twenty-four themes in three sets of eight, one row per theme, each in the
 * eight palettes, so sixty-four players at once. They all play one shared `<audio>`, so they move
 * together. The toolbar lays one drawing, font or the volume control over every player; touching a
 * player picks it, and the bar at the bottom copies its code. Run `npm run dev` and open
 * /playground/themes.html.
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
    copyOnClick,
    forget,
    pickSound,
    setupCopyButtons,
    setupHeader,
    type Sound,
} from './site';

/** Themes per set, one row each. */
const PER_SET = 8;

/** What each theme is, in a line. */
const THEME_TEXT: Record<ThemeName, string> = {
    default: 'SonicFrame as it always looked.',
    bubble: 'A chat voice note: a round button, slim bars with a dot, the time and speed underneath.',
    pill: 'A slim capsule for running text: a small button and a track with a dot.',
    blocky: 'Square everything: a square button, LED blocks, monospaced capitals.',
    card: 'A podcast card: the wave on top, skip buttons around a big play button.',
    minimal:
        'Almost nothing: an icon, thin needles and the elapsed time, on the page itself.',
    terminal:
        'A console: an outlined square button, a stepped wave from the floor, monospaced capitals.',
    pulse: 'A heartbeat monitor: a glowing line that beats with the sound.',
    scope: 'An oscilloscope: a thin trace swinging around the middle.',
    neon: 'Night lights: a glowing mirrored line and a glowing frame.',
    glass: 'Frosted glass over whatever is behind it.',
    soft: 'Soft and round: no border, a gentle shadow, thick rounded bars.',
    brutal: 'Bold lines: a thick border, a hard offset shadow, heavy capitals.',
    studio: 'A studio panel: a tall solid waveform on top, transport buttons below.',
    retro: '8-bit: chunky steps, square corners, a hard shadow.',
    dots: 'A dot matrix, round and playful.',
    paper: 'Editorial: a serif face, a fine line on the page, the time left.',
    bold: 'Big and loud, for stories and feeds.',
    stream: 'A wide bar: the time at both ends of a track, the volume at the end.',
    led: 'A level meter: LED cells rising from the floor.',
    smooth: 'A smooth filled wave in a rounded, borderless box.',
    compact: 'A row in a list of recordings: small and quiet.',
    bubbly: 'Fat round bars and a round face, for friendly apps.',
    mono: 'Black and white: outlines and hairlines.',
    classic:
        'The everyday controls: play, the time, a track with a dot, the volume.',
};

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

const gallery = byId('gallery');
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

/** The palette's name and a few of its colors. */
function paletteLabel(palette: PaletteName): HTMLElement {
    const label = document.createElement('div');
    const name = document.createElement('span');
    const swatches = document.createElement('span');
    label.className = 'cell-label';
    name.textContent = palette;
    swatches.className = 'swatches';
    swatches.setAttribute('aria-hidden', 'true');

    for (const key of SWATCHES) {
        const swatch = document.createElement('span');
        swatch.style.setProperty('background-color', PALETTES[palette][key]);
        swatches.append(swatch);
    }

    label.append(name, swatches);

    return label;
}

/** One theme: its name and what it is, then the player in every palette. */
function themeRow(theme: ThemeName, current: Sound): void {
    const section = document.createElement('section');
    const head = document.createElement('div');
    const title = document.createElement('h2');
    const text = document.createElement('p');
    const palettes = document.createElement('div');
    section.className = 'gallery-theme';
    section.setAttribute('aria-labelledby', `theme-${theme}`);
    title.id = `theme-${theme}`;
    title.textContent = theme;
    text.textContent = THEME_TEXT[theme];
    palettes.className = 'palettes';
    head.append(title, text);
    section.append(head, palettes);
    gallery.append(section);

    for (const palette of PALETTE_NAMES) {
        const colors = PALETTES[palette];
        const box = document.createElement('div');
        box.className = 'cell';
        box.dataset.theme = theme;
        box.dataset.palette = palette;
        // The palette's own colors around the player, so players without a surface stay readable.
        box.style.setProperty('background-color', colors.surface);
        box.style.setProperty('border-color', colors.border);
        box.style.setProperty('color', colors.muted);
        box.append(paletteLabel(palette));
        palettes.append(box);

        const player = createPlayer({
            container: box,
            media: audio,
            peaks: current.peaks,
            duration: current.duration,
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

/** Builds the rows of the current set; every player shares the one `<audio>`. */
function build(): void {
    for (const player of players) {
        player.destroy();
    }

    players = [];
    gallery.replaceChildren();

    if (sound === null) {
        return;
    }

    const themes = SETS[set];

    for (const theme of themes) {
        themeRow(theme, sound);
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
    for (const box of gallery.querySelectorAll<HTMLElement>('.cell')) {
        const on =
            box.dataset.theme === picked.theme &&
            box.dataset.palette === picked.palette;

        if (on) {
            box.setAttribute('aria-current', 'true');
        } else {
            box.removeAttribute('aria-current');
        }
    }

    const name = `The ${picked.theme} theme in the ${picked.palette} palette.`;
    byId('picked-name').textContent = name;
    byId('pickbar-name').textContent = name;
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
    gallery.addEventListener('pointerdown', (event) => pickFrom(event.target));
    gallery.addEventListener('focusin', (event) => pickFrom(event.target));
    copyOnClick(byId<HTMLButtonElement>('copy-js'), () => jsCode(picked));
    copyOnClick(byId<HTMLButtonElement>('copy-tag'), () => tagCode(picked));
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
