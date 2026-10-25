/**
 * The playground: play buttons and bar styles side by side at the size voicechan uses, a real voice
 * playing in all of them, colors to try, and 60 frames playing at once with a frame-rate meter.
 * Run `npm run dev` and open /playground/.
 */

import {
    caption,
    formatTime,
    markers,
    peaksFromChannel,
    PlayButton,
    SonicFrame,
    type BarStyle,
    type ButtonFill,
    type ButtonShape,
    type Colors,
} from '../src/index';
import { oldWaveform } from './old-waveform';

type ButtonCard = {
    title: string;
    shape: ButtonShape;
    fill: ButtonFill;
    size?: number;
    radius?: number;
};

type BarCard = {
    letter: string;
    title: string;
    bar: Partial<BarStyle>;
    colors?: Partial<Colors>;
    marked?: boolean;
};

/** His pick for voicechan: D bars, quiet parts lifted, hover band. */
const CHOSEN: Partial<BarStyle> = { width: 3, gap: 2, radius: 1.5, curve: 0.7 };

const BUTTONS: ButtonCard[] = [
    { title: 'circle, solid', shape: 'circle', fill: 'solid' },
    { title: 'circle, outline', shape: 'circle', fill: 'outline' },
    { title: 'rounded, solid', shape: 'rounded', fill: 'solid' },
    { title: 'rounded, outline', shape: 'rounded', fill: 'outline' },
    { title: 'square, solid', shape: 'square', fill: 'solid' },
    { title: 'square, outline', shape: 'square', fill: 'outline' },
    {
        title: 'square corners of 0.2rem, solid',
        shape: 'square',
        fill: 'solid',
        radius: 3,
    },
    { title: 'ghost (icon only)', shape: 'circle', fill: 'ghost' },
    { title: 'circle, solid, 28 px', shape: 'circle', fill: 'solid', size: 28 },
];

const PLAIN: Partial<Colors> = { hover: null, cursor: null };

const BARS: BarCard[] = [
    {
        letter: 'B',
        title: 'bars 2 px, gap 1, radius 1',
        bar: { width: 2, gap: 1, radius: 1 },
        colors: PLAIN,
    },
    {
        letter: 'C',
        title: 'bars 3 px, gap 1, radius 1.5',
        bar: { width: 3, gap: 1, radius: 1.5 },
        colors: PLAIN,
    },
    {
        letter: 'D',
        title: 'bars 3 px, gap 2, radius 1.5 (chosen)',
        bar: { width: 3, gap: 2, radius: 1.5 },
        colors: PLAIN,
    },
    {
        letter: 'E',
        title: 'bars 4 px, gap 2, radius 1.5',
        bar: { width: 4, gap: 2, radius: 1.5 },
        colors: PLAIN,
    },
    {
        letter: 'F',
        title: 'D growing from the base',
        bar: { width: 3, gap: 2, radius: 1.5, align: 'bottom' },
        colors: PLAIN,
    },
    {
        letter: 'G',
        title: 'D with quiet parts lifted (curve 0.7)',
        bar: CHOSEN,
        colors: PLAIN,
    },
    {
        letter: 'H',
        title: 'G with hover band, cursor line and two markers',
        bar: CHOSEN,
        colors: { hover: 'auto', cursor: 'var(--voice)' },
        marked: true,
    },
    {
        letter: 'I',
        title: 'the bars recolor under the pointer (hover colors, auto)',
        bar: CHOSEN,
        colors: { hover: 'auto', waveHover: 'auto', progressHover: 'auto' },
    },
];

const DEFAULT_COLORS = { wave: '#c2cad6', voice: '#4d6d94', button: '#4d6d94' };
const SPEEDS = [1, 1.25, 1.5, 2];

const audio = document.querySelector<HTMLAudioElement>('#audio')!;
const root = document.documentElement;
const frames: SonicFrame[] = [];
const times: HTMLElement[] = [];
let stopOld: (() => void) | null = null;

function section(id: string): HTMLElement {
    return document.querySelector<HTMLElement>(id)!;
}

function card(parent: HTMLElement, title: string): HTMLElement {
    const box = document.createElement('article');
    box.className = 'post';

    const heading = document.createElement('h3');
    heading.textContent = title;
    box.append(heading);
    parent.append(box);

    return box;
}

/** A player row like voicechan's: button, waveform, time. */
function playerRow(
    box: HTMLElement,
    button: Omit<ButtonCard, 'title'>,
): HTMLElement {
    const row = document.createElement('div');
    row.className = 'player';

    const wave = document.createElement('div');
    wave.className = 'wave';

    const time = document.createElement('span');
    time.className = 'time';
    times.push(time);

    box.append(row);
    PlayButton.create({
        container: row,
        media: audio,
        shape: button.shape,
        fill: button.fill,
        size: button.size ?? 32,
        radius: button.radius ?? null,
        colors: { background: 'var(--button)', icon: '#fff' },
    });
    row.append(wave, time);

    return wave;
}

function frame(
    container: HTMLElement,
    bar: Partial<BarStyle>,
    colors: Partial<Colors> = {},
    marked = false,
): void {
    frames.push(
        SonicFrame.create({
            container,
            media: audio,
            bar,
            colors: {
                wave: 'var(--wave-idle)',
                progress: 'var(--voice)',
                ...colors,
            },
            label: 'Playback position',
            rewindOnEnd: true,
            plugins: marked
                ? [markers({ times: [4, 21], color: 'var(--record)' })]
                : [],
        }),
    );
}

function build(): void {
    BUTTONS.forEach((item, index) => {
        const box = card(section('#buttons'), `${index + 1} · ${item.title}`);
        frame(playerRow(box, item), CHOSEN);
    });

    const old = card(
        section('#bars'),
        'A · the current voicechan waveform (SVG, 100 stretched bars)',
    );
    playerRow(old, { shape: 'circle', fill: 'solid' }).id = 'old';

    for (const item of BARS) {
        const box = card(section('#bars'), `${item.letter} · ${item.title}`);
        frame(
            playerRow(box, { shape: 'circle', fill: 'solid' }),
            item.bar,
            item.colors,
            item.marked,
        );
    }

    const captionBox = card(
        section('#bars'),
        'Caption · a line that fades out, a badge, and a tooltip on hover or tap',
    );
    frames.push(
        SonicFrame.create({
            container: playerRow(captionBox, {
                shape: 'circle',
                fill: 'solid',
            }),
            media: audio,
            bar: CHOSEN,
            colors: { wave: 'var(--wave-idle)', progress: 'var(--voice)' },
            label: 'Playback position',
            rewindOnEnd: true,
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
    );

    for (let i = 0; i < 60; i++) {
        const wave = document.createElement('div');
        wave.className = 'wave cell';
        section('#grid').append(wave);
        frame(wave, CHOSEN, { hover: null });
    }
}

function load(peaks: number[], source: string, label: string): void {
    audio.src = source;
    section('#source').textContent = label;

    for (const each of frames) {
        each.setPeaks(() => Promise.resolve(peaks));
    }

    stopOld?.();
    stopOld = oldWaveform(section('#old'), audio, peaks);
}

async function decode(data: ArrayBuffer): Promise<number[]> {
    const context = new AudioContext();

    try {
        const buffer = await context.decodeAudioData(data);

        return peaksFromChannel(buffer.getChannelData(0), 1000);
    } finally {
        void context.close();
    }
}

/** Canvas colors are read once; after a CSS variable changes, every frame reads them again. */
function refreshFrames(): void {
    for (const each of frames) {
        each.refresh();
    }
}

function setColor(name: string, value: string): void {
    root.style.setProperty(name, value);
    refreshFrames();
}

function watch(): void {
    const playAll = section('#play') as HTMLButtonElement;
    const speed = section('#speed') as HTMLButtonElement;
    const pickers = {
        wave: section('#color-wave') as HTMLInputElement,
        voice: section('#color-voice') as HTMLInputElement,
        button: section('#color-button') as HTMLInputElement,
    };

    const sync = (): void => {
        const text = `${formatTime(audio.ended ? 0 : audio.currentTime)} / ${formatTime(audio.duration)}`;
        times.forEach((time) => (time.textContent = text));
        playAll.textContent = audio.paused ? 'Play all' : 'Pause all';
    };

    for (const type of [
        'timeupdate',
        'durationchange',
        'play',
        'pause',
        'ended',
    ]) {
        audio.addEventListener(type, sync);
    }

    playAll.addEventListener('click', () =>
        audio.paused ? void audio.play() : audio.pause(),
    );
    speed.addEventListener('click', () => {
        const next =
            SPEEDS[(SPEEDS.indexOf(audio.playbackRate) + 1) % SPEEDS.length];
        audio.playbackRate = next;
        speed.textContent = `Speed ${next}×`;
    });

    pickers.wave.addEventListener('input', () =>
        setColor('--wave-idle', pickers.wave.value),
    );
    pickers.voice.addEventListener('input', () => {
        root.style.setProperty('--wave-progress', pickers.voice.value);
        setColor('--voice', pickers.voice.value);
    });
    pickers.button.addEventListener('input', () =>
        setColor('--button', pickers.button.value),
    );
    section('#reset').addEventListener('click', () => {
        pickers.wave.value = DEFAULT_COLORS.wave;
        pickers.voice.value = DEFAULT_COLORS.voice;
        pickers.button.value = DEFAULT_COLORS.button;
        for (const name of [
            '--wave-idle',
            '--voice',
            '--wave-progress',
            '--button',
        ]) {
            root.style.removeProperty(name);
        }
        refreshFrames();
    });

    const file = section('#file') as HTMLInputElement;
    file.addEventListener('change', async () => {
        const chosen = file.files?.[0];

        if (chosen) {
            load(
                await decode(await chosen.arrayBuffer()),
                URL.createObjectURL(chosen),
                chosen.name,
            );
        }
    });

    let count = 0;
    let since = performance.now();
    const meter = (now: number): void => {
        count++;

        if (now - since >= 1000) {
            section('#fps').textContent =
                `${Math.round((count * 1000) / (now - since))} fps`;
            section('#density').textContent =
                `device pixel ratio ${window.devicePixelRatio}`;
            count = 0;
            since = now;
        }

        requestAnimationFrame(meter);
    };

    requestAnimationFrame(meter);
}

build();
watch();

// Fetched once: the same bytes give the peaks and play (a hidden tab would not load the address).
const sound = await (await fetch('./sounds/little-elf.mp3')).blob();
load(
    await decode(await sound.arrayBuffer()),
    URL.createObjectURL(sound),
    '“The Little Elf” (see the credits below)',
);
