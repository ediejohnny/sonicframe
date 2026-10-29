/**
 * How a player is put together, without the page: which parts sit on its main line and on the small
 * line under the wave, where the wave goes, how the time reads, the button, the sizes (in rem, so a
 * player grows with the page's text) and the finish. `resolveLook` lays a partial look over a base and
 * keeps only known names and numbers in range, so a look can come from anywhere (an attribute, a
 * stored setting) without surprises.
 */

import type { ButtonFill, ButtonShape } from './button';
import { isFontName, type FontName } from './fonts';
import { formatTime } from './timing';

/** A piece of the player. `wave` takes the free space; `spacer` pushes the next parts to the end. */
export type Part =
    | 'play'
    | 'wave'
    | 'time'
    | 'elapsed'
    | 'remaining'
    | 'duration'
    | 'speed'
    | 'back'
    | 'forward'
    | 'volume'
    | 'slot'
    | 'spacer';

export type PlayerLook = {
    /** The parts of the main line, in order. */
    line: Part[];
    /** A small line right under the wave (a voice note's duration, say). */
    meta: Part[];
    /** The wave inside the main line, or on its own line above it. */
    wavePlace: 'inline' | 'top';
    /** How the `time` part reads. */
    time: 'elapsed' | 'remaining' | 'duration' | 'both';
    /** The play button; `size` in CSS pixels. */
    button: { shape: ButtonShape; fill: ButtonFill; size: number };
    /** Height of the wave, in rem. */
    waveHeight: number;
    /** Corner radius of the player, in rem. */
    corner: number;
    /** Space inside the player, in rem. */
    padding: number;
    /** Space between parts, in rem. */
    gap: number;
    /** Border width in CSS pixels; 0 draws none. */
    border: number;
    /** No shadow, a soft one, a hard offset one, or a glow in the played color. */
    shadow: 'none' | 'soft' | 'hard' | 'glow';
    /** A solid background, frosted glass, or none (the page shows through). */
    surface: 'solid' | 'glass' | 'none';
    font: FontName;
    /** Text size, in rem. */
    fontSize: number;
    /** Text weight, 100 to 900. */
    weight: number;
    uppercase: boolean;
    /** Seconds moved by the back and forward buttons. */
    skip: number;
    /** The speeds the speed button steps through. */
    speeds: number[];
    /** How the volume bar shows, when the volume part is on. */
    volume: 'always' | 'hover';
};

export const PART_NAMES: readonly Part[] = Object.freeze([
    'play',
    'wave',
    'time',
    'elapsed',
    'remaining',
    'duration',
    'speed',
    'back',
    'forward',
    'volume',
    'slot',
    'spacer',
] as const);

export const DEFAULT_LOOK: Readonly<PlayerLook> = Object.freeze<PlayerLook>({
    line: ['play', 'wave', 'time'],
    meta: [],
    wavePlace: 'inline',
    time: 'both',
    button: { shape: 'circle', fill: 'solid', size: 36 },
    waveHeight: 2.5,
    corner: 0.75,
    padding: 0.5,
    gap: 0.625,
    border: 1,
    shadow: 'none',
    surface: 'solid',
    font: 'system',
    fontSize: 0.8125,
    weight: 500,
    uppercase: false,
    skip: 10,
    speeds: [1, 1.5, 2],
    volume: 'hover',
});

/** The most parts on one line. */
const MAX_PARTS = 12;

/** The most speeds the speed button steps through. */
const MAX_SPEEDS = 6;

function oneOf<Value extends string>(
    value: unknown,
    allowed: readonly Value[],
    fallback: Value,
): Value {
    return typeof value === 'string' &&
        (allowed as readonly string[]).includes(value)
        ? (value as Value)
        : fallback;
}

function within(
    value: unknown,
    fallback: number,
    lo: number,
    hi: number,
): number {
    return typeof value === 'number' && Number.isFinite(value)
        ? Math.min(hi, Math.max(lo, value))
        : fallback;
}

function isPart(value: unknown): value is Part {
    return (PART_NAMES as readonly unknown[]).includes(value);
}

/** Known parts only, each once (spacers may repeat), at most `MAX_PARTS`. */
function parts(value: unknown, fallback: readonly Part[]): Part[] {
    if (!Array.isArray(value)) {
        return [...fallback];
    }

    const kept: Part[] = [];

    for (const part of value) {
        if (isPart(part) && (part === 'spacer' || !kept.includes(part))) {
            kept.push(part);
        }
    }

    return kept.slice(0, MAX_PARTS);
}

function speeds(value: unknown, fallback: readonly number[]): number[] {
    if (!Array.isArray(value)) {
        return [...fallback];
    }

    const kept = value
        .filter(
            (speed): speed is number =>
                typeof speed === 'number' &&
                Number.isFinite(speed) &&
                speed >= 0.25 &&
                speed <= 4,
        )
        .slice(0, MAX_SPEEDS);

    return kept.length > 0 ? kept : [...fallback];
}

/** `input` laid over `base`: unknown names fall back, numbers stay in range, the wave is always there. */
export function resolveLook(
    base: PlayerLook,
    input: Partial<PlayerLook> | undefined,
): PlayerLook {
    const given: Partial<PlayerLook> = input ?? {};
    const wavePlace = oneOf(
        given.wavePlace,
        ['inline', 'top'] as const,
        base.wavePlace,
    );
    let line = parts(given.line, base.line);

    if (wavePlace === 'top') {
        line = line.filter((part) => part !== 'wave');
    } else if (!line.includes('wave')) {
        const play = line.indexOf('play');
        line.splice(play + 1, 0, 'wave');
        line = line.slice(0, MAX_PARTS);
    }

    const meta = parts(given.meta, base.meta).filter(
        (part) =>
            part === 'spacer' || (part !== 'wave' && !line.includes(part)),
    );
    const button: Partial<PlayerLook['button']> = given.button ?? {};

    return {
        line,
        meta,
        wavePlace,
        time: oneOf(
            given.time,
            ['elapsed', 'remaining', 'duration', 'both'] as const,
            base.time,
        ),
        button: {
            shape: oneOf(
                button.shape,
                ['circle', 'rounded', 'square'] as const,
                base.button.shape,
            ),
            fill: oneOf(
                button.fill,
                ['solid', 'outline', 'ghost'] as const,
                base.button.fill,
            ),
            size: within(button.size, base.button.size, 16, 96),
        },
        waveHeight: within(given.waveHeight, base.waveHeight, 0.5, 12),
        corner: within(given.corner, base.corner, 0, 4),
        padding: within(given.padding, base.padding, 0, 3),
        gap: within(given.gap, base.gap, 0, 3),
        border: within(given.border, base.border, 0, 4),
        shadow: oneOf(
            given.shadow,
            ['none', 'soft', 'hard', 'glow'] as const,
            base.shadow,
        ),
        surface: oneOf(
            given.surface,
            ['solid', 'glass', 'none'] as const,
            base.surface,
        ),
        font: isFontName(given.font) ? given.font : base.font,
        fontSize: within(given.fontSize, base.fontSize, 0.5, 2),
        weight:
            Math.round(within(given.weight, base.weight, 100, 900) / 100) * 100,
        uppercase:
            typeof given.uppercase === 'boolean'
                ? given.uppercase
                : base.uppercase,
        skip: within(given.skip, base.skip, 1, 120),
        speeds: speeds(given.speeds, base.speeds),
        volume: oneOf(given.volume, ['always', 'hover'] as const, base.volume),
    };
}

/** The time as the look asks: elapsed, remaining (with a minus), the duration, or both. */
export function timeText(
    format: PlayerLook['time'],
    time: number | null,
    duration: number | null,
): string {
    const now = time ?? 0;
    const total = duration ?? 0;

    switch (format) {
        case 'elapsed':
            return formatTime(now);
        case 'remaining':
            return `-${formatTime(Math.max(0, total - now))}`;
        case 'duration':
            return formatTime(total);
        default:
            return `${formatTime(now)} / ${formatTime(total)}`;
    }
}

/** The speed after `rate`, wrapping around; the first one when `rate` is not in the list. */
export function nextSpeed(rate: number, list: readonly number[]): number {
    const at = list.findIndex((speed) => Math.abs(speed - rate) < 0.01);

    return list[at < 0 ? 0 : (at + 1) % list.length] ?? 1;
}

/** A speed in words: `1×`, `1.5×`. */
export function speedText(rate: number): string {
    return `${Number(rate.toFixed(2))}×`;
}
