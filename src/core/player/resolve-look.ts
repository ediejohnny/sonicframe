/**
 * Reading a look: `resolveLook` lays a partial look over a base and keeps only known names and
 * numbers in range, so a look can come from anywhere (an attribute, a stored setting) without
 * surprises. An old name is read as its new one until 2.0.
 */

import { isOneOf, oneOf, within } from '../shared/checked';
import { backgroundOver } from './background';
import { animationOver } from './background-animation';
import { isFontName } from './fonts';
import { PART_NAMES, type Part, type PlayerLook, type RemSize } from './look';

/** The most parts on one line. */
const MAX_PARTS = 12;

/** The most speeds the speed button steps through. */
const MAX_SPEEDS = 6;

function isPart(value: unknown): value is Part {
    return isOneOf(value, PART_NAMES);
}

/** Known parts only (an old name read as the new one), each once (spacers may repeat), at most `MAX_PARTS`. */
function parts(value: unknown, fallback: readonly Part[]): Part[] {
    if (!Array.isArray(value)) {
        return [...fallback];
    }

    const kept: Part[] = [];

    for (const given of value) {
        const part = given === 'prevChapter' ? 'previousChapter' : given;

        if (isPart(part) && (part === 'spacer' || !kept.includes(part))) {
            kept.push(part);
        }
    }

    return kept.slice(0, MAX_PARTS);
}

/** A play button size: pixels kept from 16 to 96, rem (`'2.5rem'`) from 1 to 6; anything else, `base`. */
function buttonSize(value: unknown, base: number | RemSize): number | RemSize {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return within(value, 36, 16, 96);
    }

    const rem =
        typeof value === 'string'
            ? /^(\d+(?:\.\d+)?)rem$/.exec(value.trim())
            : null;

    return rem === null ? base : `${within(Number(rem[1]), 1, 1, 6)}rem`;
}

/** The first of the given values that is a boolean, or `base`. */
function flag(base: boolean, ...given: unknown[]): boolean {
    const found = given.find((value) => typeof value === 'boolean');

    return typeof found === 'boolean' ? found : base;
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
    // Each renamed name: the new one wins, the old one is read when it is alone (`marqueePause` in
    // milliseconds), and both are given back with the same value until 2.0.
    const waveMinWidth = within(
        given.waveMinWidth ?? given.waveMin,
        base.waveMinWidth,
        0,
        40,
    );
    const narrowWidth = within(
        given.narrowWidth ?? given.narrow,
        base.narrowWidth,
        0,
        60,
    );
    const fontWeight =
        Math.round(
            within(
                given.fontWeight ?? given.weight,
                base.fontWeight,
                100,
                900,
            ) / 100,
        ) * 100;
    const marqueePauseOnHover = flag(
        base.marqueePauseOnHover,
        given.marqueePauseOnHover,
        given.marqueeHoverPause,
    );
    const marqueePauseSeconds = within(
        given.marqueePauseSeconds ??
            (typeof given.marqueePause === 'number'
                ? given.marqueePause / 1000
                : undefined),
        base.marqueePauseSeconds,
        0,
        10,
    );
    const volumeSlider = oneOf(
        given.volumeSlider ?? given.volume,
        ['always', 'hover'] as const,
        base.volumeSlider,
    );

    return {
        line,
        meta,
        metaWrap:
            typeof given.metaWrap === 'boolean'
                ? given.metaWrap
                : base.metaWrap,
        wavePlace,
        time: oneOf(
            given.time,
            ['elapsed', 'remaining', 'duration', 'both'] as const,
            base.time,
        ),
        timeAlign: oneOf(
            given.timeAlign,
            ['auto', 'start', 'center', 'end'] as const,
            base.timeAlign,
        ),
        underStart: oneOf(
            given.underStart,
            ['wave', 'line'] as const,
            base.underStart,
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
            size: buttonSize(button.size, base.button.size),
        },
        waveHeight: within(given.waveHeight, base.waveHeight, 0.5, 12),
        minimapHeight: within(given.minimapHeight, base.minimapHeight, 0.5, 6),
        minimapGap: within(given.minimapGap, base.minimapGap, 0, 2),
        waveMinWidth,
        waveMin: waveMinWidth,
        narrowWidth,
        narrow: narrowWidth,
        narrowLine: parts(given.narrowLine, base.narrowLine),
        narrowStart: parts(given.narrowStart, base.narrowStart),
        narrowGap: within(given.narrowGap, base.narrowGap, 0, 3),
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
        fontWeight,
        weight: fontWeight,
        uppercase:
            typeof given.uppercase === 'boolean'
                ? given.uppercase
                : base.uppercase,
        nameOverflow: oneOf(
            given.nameOverflow,
            ['ellipsis', 'fade', 'clip'] as const,
            base.nameOverflow,
        ),
        nameFade: within(given.nameFade, base.nameFade, 0.25, 6),
        nameFadeStart:
            typeof given.nameFadeStart === 'boolean'
                ? given.nameFadeStart
                : base.nameFadeStart,
        nameTooltip:
            typeof given.nameTooltip === 'boolean'
                ? given.nameTooltip
                : base.nameTooltip,
        marquee:
            typeof given.marquee === 'boolean' ? given.marquee : base.marquee,
        marqueeType: oneOf(
            given.marqueeType,
            ['loop', 'restart', 'bounce'] as const,
            base.marqueeType,
        ),
        marqueeGap: within(given.marqueeGap, base.marqueeGap, 0.5, 10),
        marqueePauseOnHover,
        marqueeHoverPause: marqueePauseOnHover,
        marqueeSpeed: within(given.marqueeSpeed, base.marqueeSpeed, 0.25, 20),
        marqueePauseSeconds,
        marqueePause: marqueePauseSeconds * 1000,
        skip: within(given.skip, base.skip, 1, 120),
        speeds: speeds(given.speeds, base.speeds),
        volumeSlider,
        volume: volumeSlider,
        background: backgroundOver(base.background, given.background),
        backgroundAnimation: animationOver(
            base.backgroundAnimation,
            given.backgroundAnimation,
        ),
    };
}
