/**
 * The playground: the same sound in several bar styles, side by side, at the size voicechan uses, plus
 * 60 frames playing at once with a frame-rate meter. Run `npm run dev` and open /playground/.
 */

import {
    formatTime,
    markers,
    peaksFromChannel,
    SonicFrame,
    type BarStyle,
    type Colors,
} from '../src/index';
import { oldWaveform } from './old-waveform';
import { speechLike } from './synth';

type Card = {
    letter: string;
    title: string;
    bar?: Partial<BarStyle>;
    colors?: Partial<Colors>;
    marked?: boolean;
};

const PLAIN: Partial<Colors> = { hover: null, cursor: null };

const CARDS: Card[] = [
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
        title: 'bars 3 px, gap 2, radius 1.5',
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
        title: 'C growing from the base',
        bar: { width: 3, gap: 1, radius: 1.5, align: 'bottom' },
        colors: PLAIN,
    },
    {
        letter: 'G',
        title: 'C with quiet parts lifted (curve 0.7)',
        bar: { width: 3, gap: 1, radius: 1.5, curve: 0.7 },
        colors: PLAIN,
    },
    {
        letter: 'H',
        title: 'C with hover band, cursor line and two markers',
        bar: { width: 3, gap: 1, radius: 1.5 },
        colors: { hover: 'auto', cursor: 'var(--voice)' },
        marked: true,
    },
];

const SPEEDS = [1, 1.25, 1.5, 2];

const audio = document.querySelector<HTMLAudioElement>('#audio')!;
const cards = document.querySelector<HTMLElement>('#cards')!;
const grid = document.querySelector<HTMLElement>('#grid')!;
const playButton = document.querySelector<HTMLButtonElement>('#play')!;
const speedButton = document.querySelector<HTMLButtonElement>('#speed')!;
const fileInput = document.querySelector<HTMLInputElement>('#file')!;
const density = document.querySelector<HTMLElement>('#density')!;
const fps = document.querySelector<HTMLElement>('#fps')!;

const frames: SonicFrame[] = [];
const times: HTMLElement[] = [];
let stopOld: (() => void) | null = null;

function playerRow(): { row: HTMLElement; wave: HTMLElement } {
    const row = document.createElement('div');
    row.className = 'player';

    const play = document.createElement('button');
    play.type = 'button';
    play.className = 'btn play';
    play.textContent = '▶';
    play.addEventListener('click', () => toggle());

    const wave = document.createElement('div');
    wave.className = 'wave';

    const time = document.createElement('span');
    time.className = 'time';
    times.push(time);

    const speed = document.createElement('span');
    speed.className = 'btn speed';
    speed.textContent = '1×';

    row.append(play, wave, time, speed);

    return { row, wave };
}

function card(letter: string, title: string): HTMLElement {
    const box = document.createElement('article');
    box.className = 'post';

    const heading = document.createElement('h2');
    heading.textContent = `${letter} · ${title}`;
    box.append(heading);
    cards.append(box);

    return box;
}

function toggle(): void {
    if (audio.paused) {
        void audio.play();
    } else {
        audio.pause();
    }
}

function load(peaks: number[], source: string, label: string): void {
    audio.src = source;
    document.querySelector('#source')!.textContent = label;

    for (const frame of frames) {
        frame.setPeaks(
            () =>
                new Promise((resolve) => setTimeout(() => resolve(peaks), 250)),
        );
    }

    stopOld?.();
    stopOld = oldWaveform(
        document.querySelector<HTMLElement>('#old')!,
        audio,
        peaks,
    );
}

function build(): void {
    const old = card(
        'A',
        'the current voicechan waveform (SVG, 100 stretched bars)',
    );
    const oldRow = playerRow();
    oldRow.wave.id = 'old';
    old.append(oldRow.row);

    for (const item of CARDS) {
        const box = card(item.letter, item.title);
        const { row, wave } = playerRow();
        box.append(row);

        const frame = SonicFrame.create({
            container: wave,
            media: audio,
            bar: item.bar,
            colors: {
                wave: 'var(--wave-idle)',
                progress: 'var(--voice)',
                ...item.colors,
            },
            label: 'Playback position',
            rewindOnEnd: true,
            plugins: item.marked
                ? [markers({ times: [2, 7.5], color: 'var(--record)' })]
                : [],
        });
        frames.push(frame);
    }

    for (let i = 0; i < 60; i++) {
        const wave = document.createElement('div');
        wave.className = 'wave cell';
        grid.append(wave);
        frames.push(
            SonicFrame.create({
                container: wave,
                media: audio,
                bar: { width: 3, gap: 1, radius: 1.5 },
                colors: {
                    wave: 'var(--wave-idle)',
                    progress: 'var(--voice)',
                    hover: null,
                },
                rewindOnEnd: true,
            }),
        );
    }
}

function watch(): void {
    const sync = (): void => {
        const text = `${formatTime(audio.ended ? 0 : audio.currentTime)} / ${formatTime(audio.duration)}`;
        times.forEach((time) => (time.textContent = text));
        playButton.textContent = audio.paused ? 'Play all' : 'Pause all';
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

    playButton.addEventListener('click', toggle);
    speedButton.addEventListener('click', () => {
        const next =
            SPEEDS[(SPEEDS.indexOf(audio.playbackRate) + 1) % SPEEDS.length];
        audio.playbackRate = next;
        speedButton.textContent = `Speed ${next}×`;
    });

    fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];

        if (!file) {
            return;
        }

        const context = new AudioContext();
        const buffer = await context.decodeAudioData(await file.arrayBuffer());
        void context.close();
        load(
            peaksFromChannel(buffer.getChannelData(0), 1000),
            URL.createObjectURL(file),
            file.name,
        );
    });

    let count = 0;
    let since = performance.now();
    const meter = (now: number): void => {
        count++;

        if (now - since >= 1000) {
            fps.textContent = `${Math.round((count * 1000) / (now - since))} fps`;
            density.textContent = `device pixel ratio ${window.devicePixelRatio}`;
            count = 0;
            since = now;
        }

        requestAnimationFrame(meter);
    };

    requestAnimationFrame(meter);
}

build();
watch();

const sound = speechLike();
load(
    peaksFromChannel(sound.samples, 1000),
    URL.createObjectURL(sound.blob),
    'a made-up speech-like sound (14 s)',
);
