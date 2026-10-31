/**
 * The pure parts of exporting a clip: choosing a container/codec the browser can record, clamping
 * the time range to a safe length, and the bars of that range. The recording itself (canvas +
 * MediaRecorder) lives in the DOM layer; this is tested in Node.
 */

import type { BarStyle, WaveStyle } from '../types';
import { barValues, buildDetail } from './detail';
import { barMetrics, barWindow, type BarWindow } from './layout';
import { resample } from './peaks';
import { waveShape, type WaveShape } from './shapes';
import { fitView } from './view';
import { MAX_ZOOM } from './zoom';

/** Container/codec candidates, in order of preference (MP4/H.264 first, then WebM). */
export const DEFAULT_CLIP_TYPES: readonly string[] = [
    'video/mp4;codecs=avc1',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
];

/** The longest clip, in seconds. */
export const MAX_CLIP_SECONDS = 120;

/**
 * The longest source decoded for a clip unless the app sets its own, in seconds. A source is decoded
 * whole before the clip is cut, about 23 MB of memory per minute of stereo audio, so 10 minutes stays
 * near 230 MB.
 */
export const DEFAULT_MAX_SOURCE_SECONDS = 600;

/** The first candidate the browser says it can record, or null. */
export function pickMimeType(
    candidates: readonly string[],
    isSupported: (type: string) => boolean,
): string | null {
    for (const candidate of candidates) {
        if (isSupported(candidate)) {
            return candidate;
        }
    }

    return null;
}

/**
 * Orders and clamps the range to the sound and to `maxSeconds`. A start or end that is not a finite
 * number means the sound's own start or end, so the plan is always made of finite numbers.
 */
export function clipPlan(
    start: number,
    end: number,
    duration: number,
    maxSeconds: number = MAX_CLIP_SECONDS,
): { start: number; end: number; seconds: number } {
    const length = Number.isFinite(duration) ? Math.max(0, duration) : 0;
    const first = Number.isFinite(start) ? start : 0;
    const last = Number.isFinite(end) ? end : length;
    const from = Math.max(0, Math.min(Math.min(first, last), length));
    const limit = Math.min(length, from + Math.max(0, maxSeconds));
    const to = Math.max(from, Math.min(Math.max(first, last), limit));

    return { start: from, end: to, seconds: to - from };
}

/**
 * The bars of a clip of `start`..`end` seconds of a sound `duration` long, `width` device pixels
 * wide: only the range, across the whole width, so the played part runs over the bars it plays.
 * The whole sound (or one of unknown length) is laid as the frame lays it, one value per bar.
 */
export function clipBars(
    peaks: readonly number[],
    start: number,
    end: number,
    duration: number,
    width: number,
    bar: BarStyle,
): { values: number[]; grid: BarWindow | undefined } {
    const values = peaks.map((value) => Math.min(1, Math.abs(value)));

    if (!(duration > 0) || (start <= 0 && end >= duration)) {
        return {
            values: resample(values, barMetrics(width, bar, 1).count),
            grid: undefined,
        };
    }

    const view = fitView(start / duration, end / duration, MAX_ZOOM);
    const grid = barWindow(width, view, bar, 1);

    return {
        values: barValues(
            buildDetail(values),
            grid.total,
            grid.first,
            grid.count,
        ),
        grid,
    };
}

/** The drawing of a clip's bars (see `clipBars`), `width` × `height` device pixels. */
export function clipShape(
    peaks: readonly number[],
    range: { start: number; end: number },
    duration: number,
    width: number,
    height: number,
    bar: BarStyle,
    wave: WaveStyle,
): WaveShape {
    const { values, grid } = clipBars(
        peaks,
        range.start,
        range.end,
        duration,
        width,
        bar,
    );

    return waveShape(values, width, height, bar, wave, 1, grid);
}
