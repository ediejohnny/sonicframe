/**
 * The built-in themes: `default` (SonicFrame as it always looked) and twenty-four more, from a chat
 * voice note to a heartbeat monitor. Each names its own palette, used unless the player picks
 * another, so any theme can wear any palette. They follow familiar kinds of players without copying
 * any product.
 */

import type { Theme } from './theme';

export type ThemeName =
    | 'default'
    | 'bubble'
    | 'pill'
    | 'blocky'
    | 'card'
    | 'minimal'
    | 'terminal'
    | 'pulse'
    | 'scope'
    | 'neon'
    | 'glass'
    | 'soft'
    | 'brutal'
    | 'studio'
    | 'retro'
    | 'dots'
    | 'paper'
    | 'bold'
    | 'stream'
    | 'led'
    | 'smooth'
    | 'compact'
    | 'bubbly'
    | 'mono'
    | 'classic';

export const THEMES: Readonly<Record<ThemeName, Readonly<Theme>>> =
    Object.freeze({
        /**
         * SonicFrame as it always looked: the default look and bars, and its own colors, which leave
         * every `--sonicframe-*` variable to the page. No theme, or an unknown one, means this one.
         */
        default: {
            look: {},
            palette: 'default',
            wave: { style: 'bars' },
            bar: {},
        },
        /** A chat voice note: a round button, slim bars with a dot, the time and speed underneath. */
        bubble: {
            look: {
                line: ['play', 'wave'],
                meta: ['elapsed', 'spacer', 'speed'],
                time: 'elapsed',
                button: { shape: 'circle', fill: 'solid', size: 40 },
                waveHeight: 2,
                corner: 1.25,
                padding: 0.5,
                gap: 0.5,
                border: 0,
                shadow: 'soft',
                fontSize: 0.75,
            },
            palette: 'light',
            wave: { style: 'bars', knob: 12 },
            bar: { width: 2, gap: 2, radius: 1 },
        },
        /** A slim capsule for running text: a small button and a track with a dot. */
        pill: {
            look: {
                line: ['play', 'wave', 'remaining'],
                time: 'remaining',
                button: { shape: 'circle', fill: 'solid', size: 28 },
                waveHeight: 1.5,
                corner: 4,
                padding: 0.25,
                gap: 0.5,
                border: 0,
                fontSize: 0.75,
            },
            palette: 'light',
            wave: { style: 'track', knob: 10, lineWidth: 3 },
            bar: {},
        },
        /** Square everything: a square button, LED blocks, monospaced capitals. */
        blocky: {
            look: {
                button: { shape: 'square', fill: 'solid', size: 36 },
                corner: 0,
                border: 2,
                font: 'mono',
                uppercase: true,
                fontSize: 0.75,
                weight: 700,
            },
            palette: 'light',
            wave: { style: 'blocks' },
            bar: { width: 4, gap: 2, radius: 0, curve: 0.8 },
        },
        /** A podcast card: the wave on top, skip buttons around a big play button. */
        card: {
            look: {
                wavePlace: 'top',
                line: ['back', 'play', 'forward', 'spacer', 'time', 'speed'],
                button: { shape: 'circle', fill: 'solid', size: 44 },
                waveHeight: 3.5,
                corner: 1,
                padding: 1,
                gap: 0.75,
                shadow: 'soft',
                font: 'humanist',
                fontSize: 0.875,
            },
            palette: 'light',
            wave: { style: 'area' },
            bar: { width: 2, gap: 1, curve: 0.8 },
        },
        /** Almost nothing: an icon, thin needles and the elapsed time, on the page itself. */
        minimal: {
            look: {
                line: ['play', 'wave', 'elapsed'],
                button: { shape: 'circle', fill: 'ghost', size: 28 },
                waveHeight: 2,
                corner: 0,
                padding: 0,
                gap: 0.5,
                border: 0,
                surface: 'none',
                fontSize: 0.75,
                weight: 400,
            },
            palette: 'light',
            wave: { style: 'needles' },
            bar: { width: 1, gap: 2, curve: 0.8 },
        },
        /** A console: an outlined square button, a stepped wave from the floor, monospaced capitals. */
        terminal: {
            look: {
                button: { shape: 'square', fill: 'outline', size: 32 },
                waveHeight: 2,
                corner: 0.25,
                font: 'mono',
                uppercase: true,
                fontSize: 0.75,
                weight: 400,
            },
            palette: 'dark',
            wave: { style: 'steps' },
            bar: { width: 3, gap: 0, radius: 0, align: 'bottom', curve: 0.8 },
        },
        /** A heartbeat monitor: a glowing line that beats with the sound. */
        pulse: {
            look: {
                line: ['play', 'wave', 'elapsed'],
                button: { shape: 'circle', fill: 'outline', size: 32 },
                corner: 0.5,
                font: 'mono',
                fontSize: 0.75,
            },
            palette: 'dark',
            wave: { style: 'pulse', glow: 6, lineWidth: 2 },
            bar: { width: 3, gap: 2, curve: 1 },
        },
        /** An oscilloscope: a thin trace swinging around the middle. */
        scope: {
            look: {
                button: { shape: 'rounded', fill: 'outline', size: 32 },
                corner: 0.5,
                font: 'mono',
                fontSize: 0.75,
            },
            palette: 'dark',
            wave: { style: 'scope', glow: 4, lineWidth: 1.5 },
            bar: { width: 2, gap: 1, curve: 0.8 },
        },
        /** Night lights: a glowing mirrored line and a glowing frame. */
        neon: {
            look: {
                button: { shape: 'circle', fill: 'outline', size: 36 },
                corner: 1,
                shadow: 'glow',
                font: 'geometric',
                fontSize: 0.75,
                weight: 600,
            },
            palette: 'dark',
            wave: { style: 'line', glow: 10, lineWidth: 2 },
            bar: { width: 2, gap: 2 },
        },
        /** Frosted glass over whatever is behind it. */
        glass: {
            look: {
                waveHeight: 2.25,
                corner: 1.25,
                padding: 0.625,
                shadow: 'soft',
                surface: 'glass',
                fontSize: 0.75,
            },
            palette: 'light',
            wave: { style: 'bars' },
            bar: { width: 3, gap: 3, radius: 1.5 },
        },
        /** Soft and round: no border, a gentle shadow, thick rounded bars. */
        soft: {
            look: {
                button: { shape: 'circle', fill: 'solid', size: 40 },
                corner: 1.5,
                padding: 0.75,
                border: 0,
                shadow: 'soft',
                font: 'rounded',
            },
            palette: 'light',
            wave: { style: 'bars' },
            bar: { width: 4, gap: 3, radius: 2, curve: 0.6 },
        },
        /** Bold lines: a thick border, a hard offset shadow, heavy capitals. */
        brutal: {
            look: {
                button: { shape: 'square', fill: 'solid', size: 40 },
                corner: 0,
                padding: 0.75,
                border: 3,
                shadow: 'hard',
                font: 'industrial',
                uppercase: true,
                fontSize: 0.875,
                weight: 800,
            },
            palette: 'sunset',
            wave: { style: 'blocks' },
            bar: { width: 5, gap: 3, radius: 0, curve: 0.8 },
        },
        /** A studio panel: a tall solid waveform on top, transport buttons below. */
        studio: {
            look: {
                wavePlace: 'top',
                line: ['play', 'back', 'forward', 'spacer', 'time'],
                button: { shape: 'rounded', fill: 'solid', size: 32 },
                waveHeight: 4,
                corner: 0.25,
                font: 'mono',
                fontSize: 0.75,
            },
            palette: 'dark',
            wave: { style: 'area', smooth: false },
            bar: { width: 1, gap: 0, curve: 1 },
        },
        /** 8-bit: chunky steps, square corners, a hard shadow. */
        retro: {
            look: {
                button: { shape: 'square', fill: 'solid', size: 32 },
                corner: 0,
                border: 2,
                shadow: 'hard',
                font: 'mono',
                uppercase: true,
                fontSize: 0.75,
                weight: 700,
            },
            palette: 'contrast',
            wave: { style: 'steps' },
            bar: { width: 4, gap: 0, radius: 0, align: 'bottom', curve: 0.8 },
        },
        /** A dot matrix, round and playful. */
        dots: {
            look: {
                corner: 2,
                padding: 0.625,
                border: 0,
                shadow: 'soft',
                font: 'rounded',
            },
            palette: 'berry',
            wave: { style: 'dots' },
            bar: { width: 4, gap: 2, curve: 0.8 },
        },
        /** Editorial: a serif face, a fine line on the page, the time left. */
        paper: {
            look: {
                line: ['play', 'wave', 'remaining'],
                time: 'remaining',
                button: { shape: 'circle', fill: 'ghost', size: 32 },
                waveHeight: 2,
                corner: 0,
                padding: 0.25,
                border: 0,
                surface: 'none',
                font: 'serif',
                fontSize: 0.875,
                weight: 400,
            },
            palette: 'paper',
            wave: { style: 'line', mirror: false, lineWidth: 1.5 },
            bar: { width: 3, gap: 1, align: 'bottom', curve: 0.8 },
        },
        /** Big and loud, for stories and feeds. */
        bold: {
            look: {
                button: { shape: 'circle', fill: 'solid', size: 48 },
                waveHeight: 3.5,
                corner: 1.5,
                padding: 0.75,
                border: 0,
                shadow: 'soft',
                font: 'geometric',
                fontSize: 1,
                weight: 700,
            },
            palette: 'berry',
            wave: { style: 'bars' },
            bar: { width: 6, gap: 3, radius: 3, curve: 0.6 },
        },
        /** A wide bar: the time at both ends of a track, the volume at the end. */
        stream: {
            look: {
                line: ['play', 'elapsed', 'wave', 'duration', 'volume'],
                button: { shape: 'circle', fill: 'solid', size: 36 },
                waveHeight: 1.5,
                corner: 0.5,
                border: 0,
                fontSize: 0.75,
            },
            palette: 'dark',
            wave: { style: 'track', knob: 12, lineWidth: 4 },
            bar: {},
        },
        /** A level meter: LED cells rising from the floor. */
        led: {
            look: {
                button: { shape: 'rounded', fill: 'solid', size: 32 },
                corner: 0.375,
                font: 'industrial',
                uppercase: true,
                fontSize: 0.75,
            },
            palette: 'dark',
            wave: { style: 'blocks' },
            bar: { width: 3, gap: 1, radius: 0, align: 'bottom', curve: 0.8 },
        },
        /** A smooth filled wave in a rounded, borderless box. */
        smooth: {
            look: {
                button: { shape: 'circle', fill: 'solid', size: 40 },
                corner: 2,
                padding: 0.625,
                border: 0,
                shadow: 'soft',
                font: 'rounded',
            },
            palette: 'ocean',
            wave: { style: 'area', smooth: true },
            bar: { width: 2, gap: 1, curve: 0.6 },
        },
        /** A row in a list of recordings: small and quiet. */
        compact: {
            look: {
                line: ['play', 'wave', 'duration'],
                button: { shape: 'circle', fill: 'ghost', size: 24 },
                waveHeight: 1.25,
                corner: 0.375,
                padding: 0.25,
                gap: 0.375,
                border: 0,
                surface: 'none',
                fontSize: 0.75,
            },
            palette: 'light',
            wave: { style: 'bars' },
            bar: { width: 2, gap: 1, radius: 1 },
        },
        /** Fat round bars and a round face, for friendly apps. */
        bubbly: {
            look: {
                button: { shape: 'circle', fill: 'solid', size: 44 },
                waveHeight: 3,
                corner: 2,
                padding: 0.75,
                border: 0,
                shadow: 'soft',
                font: 'rounded',
                fontSize: 0.875,
                weight: 700,
            },
            palette: 'sunset',
            wave: { style: 'bars' },
            bar: { width: 5, gap: 4, radius: 2.5, curve: 0.5 },
        },
        /** Black and white: outlines and hairlines. */
        mono: {
            look: {
                button: { shape: 'square', fill: 'outline', size: 32 },
                waveHeight: 2,
                corner: 0,
                font: 'mono',
                fontSize: 0.75,
                weight: 400,
            },
            palette: 'light',
            wave: { style: 'needles' },
            bar: { width: 1, gap: 1, curve: 0.9 },
        },
        /** The everyday controls: play, the time, a track with a dot, the volume. */
        classic: {
            look: {
                line: ['play', 'time', 'wave', 'volume'],
                button: { shape: 'circle', fill: 'ghost', size: 32 },
                waveHeight: 1.5,
                corner: 2,
                padding: 0.375,
                gap: 0.5,
                border: 0,
                fontSize: 0.75,
            },
            palette: 'light',
            wave: { style: 'track', knob: 12, lineWidth: 4 },
            bar: {},
        },
    });

export const THEME_NAMES: readonly ThemeName[] = Object.freeze(
    Object.keys(THEMES) as ThemeName[],
);

export function isThemeName(value: unknown): value is ThemeName {
    return (
        typeof value === 'string' &&
        (THEME_NAMES as readonly string[]).includes(value)
    );
}
