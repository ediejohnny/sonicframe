/**
 * The playground: SonicFrame's own page. Every player has its own `<audio>` on the same sound, so
 * only the one pressed plays (the play buttons are exclusive); the sound is decoded once and every
 * player is given its peaks and duration. Picking another sound builds every player again.
 * Run `npm run dev` and open /playground/.
 */

import {
    caption,
    liveFrequency,
    markers,
    PlayButton,
    regions,
    silencesFromPeaks,
    skipSilences,
    SonicFrame,
    timeline,
    type BarStyle,
    type ButtonFill,
    type ButtonShape,
    type WaveName,
    type WaveStyle,
} from '../src/index';
import {
    createPlayer,
    defineSonicPlayer,
    type PlayerOptions,
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

/** Builds something for a sound; returns what takes it down. */
type Build = (host: HTMLElement, sound: Sound) => () => void;

type Drawing = {
    name: WaveName;
    text: string;
    wave?: Partial<WaveStyle>;
    bar?: Partial<BarStyle>;
};

type PluginCard = {
    title: string;
    text: string;
    build: Build;
};

const DRAWINGS: Drawing[] = [
    { name: 'bars', text: 'Rounded bars, the default.' },
    {
        name: 'needles',
        text: 'One hairline per peak.',
        bar: { width: 1, gap: 2 },
    },
    {
        name: 'blocks',
        text: 'Stacked cells, like a level meter.',
        bar: { width: 4, gap: 2, radius: 0 },
    },
    { name: 'dots', text: 'A matrix of dots.', bar: { width: 4, gap: 2 } },
    {
        name: 'steps',
        text: 'An 8-bit staircase from the floor.',
        bar: { width: 3, gap: 0, radius: 0, align: 'bottom' },
    },
    {
        name: 'line',
        text: 'One line along the peaks, mirrored.',
        bar: { width: 2, gap: 1 },
    },
    {
        name: 'area',
        text: 'The same outline, filled.',
        bar: { width: 2, gap: 1 },
    },
    {
        name: 'scope',
        text: 'A trace swinging around the middle.',
        bar: { width: 2, gap: 1 },
    },
    {
        name: 'pulse',
        text: 'A heartbeat monitor; silence stays flat.',
        wave: { glow: 4 },
    },
    {
        name: 'track',
        text: 'Only a track and a knob; it needs no peaks.',
        wave: { knob: 12, lineWidth: 4 },
    },
];

const THEME_PREVIEW: [ThemeName, string][] = [
    [
        'card',
        'A podcast card: the wave on top, skip buttons around a big play button.',
    ],
    [
        'bubble',
        'A chat voice note: a round button, slim bars with a dot, the time and speed underneath.',
    ],
    ['pulse', 'A heartbeat monitor: a glowing line that beats with the sound.'],
    ['glass', 'Frosted glass over whatever is behind it.'],
    ['retro', '8-bit: chunky steps, square corners and a hard shadow.'],
    [
        'brutal',
        'Bold lines: a thick border, a hard offset shadow and heavy capitals.',
    ],
];

const BUTTON_KINDS: [ButtonShape, ButtonFill][] = [
    ['circle', 'solid'],
    ['circle', 'outline'],
    ['rounded', 'solid'],
    ['rounded', 'outline'],
    ['square', 'solid'],
    ['circle', 'ghost'],
];

/** The sixty waves of the load test. */
const CROWD = 60;

/** The clip the export card records, in seconds. */
const CLIP_SECONDS = 5;

/** Everything drawn on a canvas, repainted when the page switches between light and dark. */
const painted = new Set<() => void>();
const mounts: { host: HTMLElement; build: Build }[] = [];
let teardowns: (() => void)[] = [];
let current: Sound | null = null;

function mount(host: HTMLElement, build: Build): void {
    mounts.push({ host, build });
}

/** A player on its own `<audio>`, with the sound's peaks and duration; errors go to the console and `failed`. */
function player(
    host: HTMLElement,
    sound: Sound,
    options: Omit<PlayerOptions, 'container' | 'src' | 'peaks' | 'duration'>,
    failed?: (error: unknown) => void,
): () => void {
    const made = createPlayer({
        container: host,
        src: sound.url,
        peaks: sound.peaks,
        duration: sound.duration,
        ...options,
    });
    const repaint = (): void => made.frame.refresh();
    const stopErrors = made.on('error', (error) => {
        console.error(error);
        failed?.(error);
    });
    painted.add(repaint);

    return () => {
        painted.delete(repaint);
        stopErrors();
        made.destroy();
    };
}

/** A figure on a shelf: the player, then its option in code and a few words. */
function figure(shelf: HTMLElement, option: string, text: string): HTMLElement {
    const box = document.createElement('figure');
    const host = document.createElement('div');
    const caption = document.createElement('figcaption');
    const code = document.createElement('code');
    const words = document.createElement('span');

    code.textContent = option;
    words.textContent = text;
    caption.append(code, words);
    box.append(host, caption);
    shelf.append(box);

    return host;
}

/**
 * The wave in words: a player with every extra of the description on, its text shown under it, and
 * buttons that build it again in another language.
 */
function wordsDemo(host: HTMLElement, sound: Sound): () => void {
    const text = byId('words-text');
    const status = byId('words-status');
    const choices = Array.from(
        document.querySelectorAll<HTMLButtonElement>('[data-words-lang]'),
    );
    let stop = (): void => undefined;

    const build = (lang: string): void => {
        stop();

        for (const choice of choices) {
            choice.setAttribute(
                'aria-pressed',
                String(choice.dataset.wordsLang === lang),
            );
        }

        status.textContent = '';
        stop = player(
            host,
            sound,
            {
                label:
                    lang === 'pt' ? 'A onda em palavras' : 'The wave in words',
                a11y: {
                    lang,
                    description: {
                        target: text,
                        keys: true,
                        pauseInValue: true,
                        button: { animation: true, animationType: 'pulse' },
                    },
                },
            },
            (error) => {
                if (error instanceof Error && /voice/.test(error.message)) {
                    status.textContent =
                        'Your browser has no voice on this device for this language. Online voices are left out on purpose: they would send the text to a server.';
                }
            },
        );
    };

    const listeners = choices.map((choice) => {
        const pick = (): void => build(choice.dataset.wordsLang ?? 'en');
        choice.addEventListener('click', pick);

        return () => choice.removeEventListener('click', pick);
    });
    const pressed = choices.find(
        (choice) => choice.getAttribute('aria-pressed') === 'true',
    );
    build(pressed?.dataset.wordsLang ?? 'en');

    return () => {
        listeners.forEach((remove) => remove());
        stop();
    };
}

function clipCard(): PluginCard {
    return {
        title: 'Export a clip',
        text: `Records a stretch of the wave and its sound as a video file, in the player's drawing and colors.`,
        build(host, sound) {
            const status = document.createElement('p');
            const button = document.createElement('button');
            const wave = document.createElement('div');
            const row = document.createElement('div');
            row.className = 'buttons';
            button.type = 'button';
            button.className = 'button small';
            button.textContent = `Export the first ${CLIP_SECONDS} seconds`;
            row.append(button, status);
            host.append(row, wave);

            const made = createPlayer({
                container: wave,
                src: sound.url,
                peaks: sound.peaks,
                duration: sound.duration,
                wave: 'line',
                bar: { width: 2, gap: 1 },
                label: 'Clip source',
            });
            const repaint = (): void => made.frame.refresh();
            painted.add(repaint);

            button.addEventListener('click', () => {
                button.disabled = true;
                status.textContent = 'Recording…';
                made.frame
                    .exportClip({
                        start: 0,
                        end: CLIP_SECONDS,
                        caption: sound.name,
                    })
                    .then(({ blob, mimeType }) => {
                        const name = mimeType.startsWith('video/mp4')
                            ? 'sonicframe-clip.mp4'
                            : 'sonicframe-clip.webm';
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = name;
                        link.click();
                        // The download reads the blob after the click returns, so the URL outlives it a little.
                        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                        status.textContent = `Saved ${name}.`;
                    })
                    .catch((error: unknown) => {
                        status.textContent =
                            error instanceof Error
                                ? error.message
                                : 'The clip could not be recorded.';
                    })
                    .finally(() => {
                        button.disabled = false;
                    });
            });

            return () => {
                painted.delete(repaint);
                made.destroy();
                row.remove();
                wave.remove();
            };
        },
    };
}

function buttonsCard(): PluginCard {
    return {
        title: 'Play buttons and a bare wave',
        text: 'The core pieces without the player: three shapes and three fills, all on one sound.',
        build(host, sound) {
            const audio = document.createElement('audio');
            const row = document.createElement('div');
            const wave = document.createElement('div');
            audio.preload = 'metadata';
            audio.src = sound.url;
            row.className = 'buttons';
            wave.className = 'bare-wave';
            host.append(audio, row, wave);

            const buttons = BUTTON_KINDS.map(([shape, fill]) =>
                PlayButton.create({
                    container: row,
                    media: audio,
                    shape,
                    fill,
                    size: 36,
                }),
            );
            const frame = SonicFrame.create({
                container: wave,
                media: audio,
                peaks: sound.peaks,
                duration: sound.duration,
                label: 'Playback position',
                rewindOnEnd: true,
            });
            const repaint = (): void => frame.refresh();
            painted.add(repaint);

            return () => {
                painted.delete(repaint);
                buttons.forEach((button) => button.destroy());
                frame.destroy();
                audio.pause();
                audio.removeAttribute('src');
                audio.remove();
                row.remove();
                wave.remove();
            };
        },
    };
}

function pluginCards(): PluginCard[] {
    const simple = (
        title: string,
        text: string,
        options: (
            sound: Sound,
        ) => Omit<PlayerOptions, 'container' | 'src' | 'peaks' | 'duration'>,
    ): PluginCard => ({
        title,
        text,
        build: (host, sound) => player(host, sound, options(sound)),
    });

    return [
        simple(
            'Markers',
            'Labeled moments on the wave. Hover one to read it, click it to jump there.',
            () => ({
                label: 'Markers',
                plugins: [
                    markers({
                        marks: [
                            { time: 4, label: 'The elf' },
                            { time: 21, label: 'His reply' },
                        ],
                    }),
                ],
            }),
        ),
        simple(
            'Regions',
            'Shift-drag to mark a stretch and drag an edge to resize it. With the wave focused, R selects, Enter plays and L loops.',
            () => ({
                label: 'Regions',
                plugins: [
                    regions({ items: [{ start: 5, end: 12, label: 'Verse' }] }),
                ],
            }),
        ),
        simple(
            'Timeline',
            'A ruler of minutes and seconds under the wave.',
            () => ({ label: 'Timeline', plugins: [timeline()] }),
        ),
        simple(
            'Caption',
            'A line of text with badges, and the whole text in a tooltip on hover or tap.',
            () => ({
                label: 'Caption',
                plugins: [
                    caption({
                        // "The Little Elf" by John Kendrick Bangs (public domain; see the page credits).
                        text: 'I met a little Elf-man once, down where the lilies blow.',
                        badges: ['auto', 'en'],
                        tooltip:
                            'I met a little Elf-man once, down where the lilies blow. ' +
                            "I asked him why he was so small, and why he didn't grow.",
                    }),
                ],
            }),
        ),
        simple(
            'Spectrogram',
            'Frequencies over time, computed in the browser and drawn in the player’s colors.',
            () => ({
                label: 'Spectrogram',
                spectrogram: true,
                look: { waveHeight: 4 },
                wave: 'line',
            }),
        ),
        simple(
            'Live frequency',
            'Press play: the bars follow the frequencies of what is playing.',
            () => ({
                label: 'Live frequency',
                bar: { align: 'bottom' },
                plugins: [liveFrequency()],
            }),
        ),
        simple(
            'Skip silences',
            'Quiet stretches are found from the peaks, dimmed, and skipped while playing.',
            (sound) => ({
                label: 'Skip silences',
                plugins: [
                    skipSilences({
                        silences: silencesFromPeaks(
                            sound.peaks,
                            sound.duration,
                        ),
                        dim: true,
                    }),
                ],
            }),
        ),
        simple(
            'Volume',
            'A speaker button and a volume bar, kept in step with the media. Off unless you turn it on.',
            () => ({
                label: 'Volume',
                volume: true,
                look: { volume: 'always' },
            }),
        ),
        clipCard(),
        buttonsCard(),
    ];
}

function setupPage(): void {
    mount(byId('hero-player'), (host, sound) =>
        player(host, sound, {
            label: sound.name,
            look: {
                waveHeight: 5,
                button: { shape: 'circle', fill: 'solid', size: 52 },
                padding: 0,
                border: 0,
                gap: 1,
                surface: 'none',
                fontSize: 0.9375,
            },
            plugins: [timeline()],
        }),
    );

    const tag = byId('tag-player');
    mount(tag, (host, sound) => {
        host.setAttribute('src', sound.url);

        return () => host.removeAttribute('src');
    });
    tag.addEventListener('sonicframe:error', (event) =>
        console.error((event as CustomEvent<unknown[]>).detail[0]),
    );

    const drawings = byId('drawing-shelf');

    for (const drawing of DRAWINGS) {
        const host = figure(drawings, `wave: '${drawing.name}'`, drawing.text);
        mount(host, (box, sound) =>
            player(box, sound, {
                label: `Drawn as ${drawing.name}`,
                wave: { style: drawing.name, ...drawing.wave },
                bar: drawing.bar,
            }),
        );
    }

    const themes = byId('theme-shelf');

    for (const [name, text] of THEME_PREVIEW) {
        const host = figure(themes, `theme: '${name}'`, text);
        mount(host, (box, sound) =>
            player(box, sound, { label: `The ${name} theme`, theme: name }),
        );
    }

    mount(byId('words-player'), wordsDemo);

    const cards = byId('plugin-cards');

    for (const card of pluginCards()) {
        const box = document.createElement('article');
        const title = document.createElement('h3');
        const text = document.createElement('p');
        const demo = document.createElement('div');
        box.className = 'plugin';
        demo.className = 'demo';
        title.textContent = card.title;
        text.textContent = card.text;
        box.append(title, text, demo);
        cards.append(box);
        mount(demo, card.build);
    }
}

/** The load test: sixty bare waves on one `<audio>`, with one play button and a frame-rate readout. */
function crowd(sound: Sound): () => void {
    const host = byId('crowd');
    const playHost = byId('crowd-play');
    const fps = byId('fps');
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.src = sound.url;
    playHost.append(audio);

    const button = PlayButton.create({
        container: playHost,
        media: audio,
        size: 40,
        labels: { play: 'Play all sixty', pause: 'Pause all sixty' },
    });
    const frames: SonicFrame[] = [];

    for (let i = 0; i < CROWD; i++) {
        const wave = document.createElement('div');
        wave.className = 'bare-wave';
        host.append(wave);
        frames.push(
            SonicFrame.create({
                container: wave,
                media: audio,
                peaks: sound.peaks,
                duration: sound.duration,
                label: `Wave ${i + 1} of ${CROWD}`,
                rewindOnEnd: true,
            }),
        );
    }

    const repaint = (): void => frames.forEach((frame) => frame.refresh());
    painted.add(repaint);

    let count = 0;
    let since = performance.now();
    let loop = 0;
    const meter = (now: number): void => {
        count++;

        if (now - since >= 1000) {
            fps.textContent = `${Math.round((count * 1000) / (now - since))} fps`;
            count = 0;
            since = now;
        }

        loop = requestAnimationFrame(meter);
    };
    loop = requestAnimationFrame(meter);

    return () => {
        cancelAnimationFrame(loop);
        painted.delete(repaint);
        frames.forEach((frame) => frame.destroy());
        button.destroy();
        audio.pause();
        audio.removeAttribute('src');
        audio.remove();
        host.replaceChildren();
        fps.textContent = '';
    };
}

let stopCrowd: (() => void) | null = null;

function setupCrowd(): void {
    const toggle = byId<HTMLButtonElement>('crowd-toggle');

    toggle.addEventListener('click', () => {
        if (stopCrowd !== null) {
            stopCrowd();
            stopCrowd = null;
            toggle.textContent = `Draw ${CROWD} waves`;
        } else if (current !== null) {
            stopCrowd = crowd(current);
            toggle.textContent = 'Remove them';
        }
    });
}

function render(sound: Sound): void {
    const previous = current;

    for (const stop of teardowns) {
        stop();
    }

    current = sound;
    teardowns = mounts.map(({ host, build }) => build(host, sound));

    if (stopCrowd !== null) {
        stopCrowd();
        stopCrowd = crowd(sound);
    }

    byId('source').textContent = `Playing ${sound.name}.`;

    if (previous !== null) {
        forget(previous);
    }
}

function showError(error: unknown): void {
    console.error(error);
    byId('source').textContent =
        current === null
            ? 'That file could not be read as audio. Try an MP3, WAV, OGG or M4A file.'
            : `That file could not be read as audio, so the page still plays ${current.name}. Try an MP3, WAV, OGG or M4A file.`;
}

defineSonicPlayer();
setupHeader(() => painted.forEach((repaint) => repaint()));
setupCopyButtons();
setupPage();
setupCrowd();
pickSound(
    byId<HTMLButtonElement>('pick'),
    byId<HTMLInputElement>('file'),
    render,
    showError,
);

bundledSound().then(render, (error: unknown) => {
    console.error(error);
    byId('source').textContent =
        'The page’s sound did not load. Use your own sound instead.';
});
