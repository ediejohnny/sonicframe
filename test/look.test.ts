import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';
import {
    DEFAULT_LOOK,
    nextSpeed,
    resolveLook,
    speedText,
    timeMold,
    timeText,
    type Part,
    type PlayerLook,
} from '../src/core/look';

describe('resolveLook', () => {
    it('keeps the base when nothing is given', () => {
        expect(resolveLook(DEFAULT_LOOK, undefined)).toEqual(DEFAULT_LOOK);
    });

    it('drops unknown and repeated parts, and keeps a part on one line only', () => {
        const look = resolveLook(DEFAULT_LOOK, {
            line: ['play', 'wave', 'flute' as Part, 'play', 'time'],
            meta: ['time', 'speed', 'wave'],
        });

        expect(look.line).toEqual(['play', 'wave', 'time']);
        expect(look.meta).toEqual(['speed']);
    });

    it('always has the wave: in the line, or on top and out of the line', () => {
        expect(
            resolveLook(DEFAULT_LOOK, { line: ['play', 'time'] }).line,
        ).toEqual(['play', 'wave', 'time']);
        expect(
            resolveLook(DEFAULT_LOOK, {
                wavePlace: 'top',
                line: ['play', 'wave', 'time'],
            }).line,
        ).toEqual(['play', 'time']);
    });

    it('keeps numbers in range and names to the known ones', () => {
        const look = resolveLook(DEFAULT_LOOK, {
            waveHeight: 500,
            corner: -3,
            weight: 1234,
            skip: Number.NaN,
            shadow: 'neon' as PlayerLook['shadow'],
            button: { shape: 'star' as 'circle', fill: 'outline', size: 1000 },
            speeds: [0.01, 1, Number.POSITIVE_INFINITY, 3],
        });

        expect(look.waveHeight).toBe(12);
        expect(look.corner).toBe(0);
        expect(look.weight).toBe(900);
        expect(look.skip).toBe(DEFAULT_LOOK.skip);
        expect(look.shadow).toBe(DEFAULT_LOOK.shadow);
        expect(look.button).toEqual({
            shape: DEFAULT_LOOK.button.shape,
            fill: 'outline',
            size: 96,
        });
        expect(look.speeds).toEqual([1, 3]);
    });

    it('knows the zoom buttons as parts, and keeps the minimap height in range', () => {
        const look = resolveLook(DEFAULT_LOOK, {
            line: ['play', 'zoomOut', 'wave', 'zoomIn'],
            meta: ['zoomReset'],
            minimapHeight: 40,
        });

        expect(look.line).toEqual(['play', 'zoomOut', 'wave', 'zoomIn']);
        expect(look.meta).toEqual(['zoomReset']);
        expect(look.minimapHeight).toBe(6);
        expect(DEFAULT_LOOK.minimapHeight).toBe(1.5);
        expect(
            resolveLook(DEFAULT_LOOK, { minimapHeight: Number.NaN })
                .minimapHeight,
        ).toBe(1.5);
        expect(
            resolveLook(DEFAULT_LOOK, { minimapHeight: 0.1 }).minimapHeight,
        ).toBe(0.5);
    });

    it('keeps the least width of a wave beside zoom buttons in range', () => {
        expect(DEFAULT_LOOK.waveMin).toBe(8);
        expect(resolveLook(DEFAULT_LOOK, { waveMin: 12 }).waveMin).toBe(12);
        expect(resolveLook(DEFAULT_LOOK, { waveMin: 99 }).waveMin).toBe(40);
        expect(resolveLook(DEFAULT_LOOK, { waveMin: -2 }).waveMin).toBe(0);
        expect(resolveLook(DEFAULT_LOOK, { waveMin: Number.NaN }).waveMin).toBe(
            8,
        );
    });

    it('keeps the voice-note width in range, with 0 turning it off', () => {
        expect(DEFAULT_LOOK.narrow).toBe(22);
        expect(resolveLook(DEFAULT_LOOK, { narrow: 0 }).narrow).toBe(0);
        expect(resolveLook(DEFAULT_LOOK, { narrow: 30 }).narrow).toBe(30);
        expect(resolveLook(DEFAULT_LOOK, { narrow: 999 }).narrow).toBe(60);
        expect(resolveLook(DEFAULT_LOOK, { narrow: -5 }).narrow).toBe(0);
        expect(resolveLook(DEFAULT_LOOK, { narrow: Number.NaN }).narrow).toBe(
            22,
        );
    });

    it('keeps the space between the parts under a voice note’s wave in range', () => {
        expect(DEFAULT_LOOK.narrowGap).toBe(0.5);
        expect(resolveLook(DEFAULT_LOOK, { narrowGap: 0 }).narrowGap).toBe(0);
        expect(resolveLook(DEFAULT_LOOK, { narrowGap: 1 }).narrowGap).toBe(1);
        expect(resolveLook(DEFAULT_LOOK, { narrowGap: 9 }).narrowGap).toBe(3);
        expect(resolveLook(DEFAULT_LOOK, { narrowGap: -1 }).narrowGap).toBe(0);
        expect(
            resolveLook(DEFAULT_LOOK, { narrowGap: Number.NaN }).narrowGap,
        ).toBe(0.5);
    });

    it('aligns the time by its place unless the look names a side', () => {
        expect(DEFAULT_LOOK.timeAlign).toBe('auto');

        for (const side of ['start', 'center', 'end'] as const) {
            expect(
                resolveLook(DEFAULT_LOOK, { timeAlign: side }).timeAlign,
            ).toBe(side);
        }

        expect(
            resolveLook(DEFAULT_LOOK, { timeAlign: 'left' as never }).timeAlign,
        ).toBe('auto');
    });

    it('starts the rows under the wave at the wave by default, at the line when asked, and nowhere else', () => {
        expect(DEFAULT_LOOK.underStart).toBe('wave');
        expect(
            resolveLook(DEFAULT_LOOK, { underStart: 'line' }).underStart,
        ).toBe('line');
        expect(
            resolveLook(DEFAULT_LOOK, { underStart: 'left' as never })
                .underStart,
        ).toBe('wave');
    });

    it('keeps the small line on one line unless asked to let it break', () => {
        expect(DEFAULT_LOOK.metaWrap).toBe(false);
        expect(resolveLook(DEFAULT_LOOK, { metaWrap: true }).metaWrap).toBe(
            true,
        );
        expect(
            resolveLook(DEFAULT_LOOK, { metaWrap: 1 as never }).metaWrap,
        ).toBe(false);
    });

    it('ends a long name in an ellipsis unless the look asks for a fade or a cut, with a fade in range', () => {
        expect(DEFAULT_LOOK.nameOverflow).toBe('ellipsis');
        expect(DEFAULT_LOOK.nameFade).toBe(1.5);
        expect(DEFAULT_LOOK.nameTooltip).toBe(false);

        for (const end of ['fade', 'clip'] as const) {
            expect(
                resolveLook(DEFAULT_LOOK, { nameOverflow: end }).nameOverflow,
            ).toBe(end);
        }

        expect(
            resolveLook(DEFAULT_LOOK, { nameOverflow: 'blur' as never })
                .nameOverflow,
        ).toBe('ellipsis');
        expect(resolveLook(DEFAULT_LOOK, { nameFade: 3 }).nameFade).toBe(3);
        expect(resolveLook(DEFAULT_LOOK, { nameFade: 0 }).nameFade).toBe(0.25);
        expect(resolveLook(DEFAULT_LOOK, { nameFade: 40 }).nameFade).toBe(6);
        expect(
            resolveLook(DEFAULT_LOOK, { nameTooltip: true }).nameTooltip,
        ).toBe(true);
        expect(
            resolveLook(DEFAULT_LOOK, { nameTooltip: 'on' as never })
                .nameTooltip,
        ).toBe(false);
    });

    it('keeps a long name still unless asked to walk it, at a speed and pauses in range', () => {
        expect(DEFAULT_LOOK.marquee).toBe(false);
        expect(DEFAULT_LOOK.marqueeSpeed).toBe(2);
        expect(DEFAULT_LOOK.marqueePause).toBe(1500);
        expect(DEFAULT_LOOK.marqueeType).toBe('restart');
        expect(
            resolveLook(DEFAULT_LOOK, { marqueeType: 'bounce' }).marqueeType,
        ).toBe('bounce');
        expect(
            resolveLook(DEFAULT_LOOK, { marqueeType: 'loop' as never })
                .marqueeType,
        ).toBe('restart');
        expect(resolveLook(DEFAULT_LOOK, { marquee: true }).marquee).toBe(true);
        expect(
            resolveLook(DEFAULT_LOOK, { marquee: 'yes' as never }).marquee,
        ).toBe(false);
        expect(
            resolveLook(DEFAULT_LOOK, { marqueeSpeed: 5 }).marqueeSpeed,
        ).toBe(5);
        expect(
            resolveLook(DEFAULT_LOOK, { marqueeSpeed: 0 }).marqueeSpeed,
        ).toBe(0.25);
        expect(
            resolveLook(DEFAULT_LOOK, { marqueeSpeed: 99 }).marqueeSpeed,
        ).toBe(20);
        expect(
            resolveLook(DEFAULT_LOOK, { marqueePause: 0 }).marqueePause,
        ).toBe(0);
        expect(
            resolveLook(DEFAULT_LOOK, { marqueePause: 60000 }).marqueePause,
        ).toBe(10000);
        expect(
            resolveLook(DEFAULT_LOOK, { marqueePause: Number.NaN })
                .marqueePause,
        ).toBe(1500);
    });

    it('reads the voice note’s part lists, keeping known parts only', () => {
        expect(DEFAULT_LOOK.narrowLine).toEqual(['play', 'wave', 'slot']);
        expect(DEFAULT_LOOK.narrowStart).toEqual([
            'time',
            'elapsed',
            'remaining',
            'duration',
        ]);

        const look = resolveLook(DEFAULT_LOOK, {
            narrowLine: ['play', 'nope', 'speed'] as never,
            narrowStart: ['volume', 'volume'],
        });

        expect(look.narrowLine).toEqual(['play', 'speed']);
        expect(look.narrowStart).toEqual(['volume']);
    });

    it('keeps the space between the wave and the minimap in range', () => {
        expect(DEFAULT_LOOK.minimapGap).toBe(0.375);
        expect(resolveLook(DEFAULT_LOOK, { minimapGap: 0 }).minimapGap).toBe(0);
        expect(resolveLook(DEFAULT_LOOK, { minimapGap: 9 }).minimapGap).toBe(2);
        expect(resolveLook(DEFAULT_LOOK, { minimapGap: -1 }).minimapGap).toBe(
            0,
        );
        expect(
            resolveLook(DEFAULT_LOOK, { minimapGap: Number.NaN }).minimapGap,
        ).toBe(0.375);
    });

    it('caps the number of parts', () => {
        const many = Array.from({ length: 40 }, () => 'spacer' as Part);

        expect(
            resolveLook(DEFAULT_LOOK, { line: many }).line.length,
        ).toBeLessThanOrEqual(12);
    });
});

describe('timeText', () => {
    it('reads the time the way the look asks', () => {
        expect(timeText('elapsed', 5, 40)).toBe('0:05');
        expect(timeText('remaining', 5, 40)).toBe('-0:35');
        expect(timeText('duration', 5, 40)).toBe('0:40');
        expect(timeText('both', 5, 40)).toBe('0:05 / 0:40');
        expect(timeText('both', null, null)).toBe('0:00 / 0:00');
    });
});

describe('timeMold', () => {
    /** How many of each character a text holds: the room it takes when every digit is as wide. */
    function counts(text: string): Map<string, number> {
        const kept = new Map<string, number>();

        for (const char of text.replace(/\d/g, '0')) {
            kept.set(char, (kept.get(char) ?? 0) + 1);
        }

        return kept;
    }

    const FORMATS = ['elapsed', 'remaining', 'duration', 'both'] as const;

    it('is the longest time the sound can show, every digit a zero', () => {
        expect(timeMold('both', 7, 123)).toBe('0:00 / 0:00');
        expect(timeMold('both', 7, 600)).toBe('00:00 / 00:00');
        expect(timeMold('both', 7, 3600)).toBe('0:00:00 / 0:00:00');
        expect(timeMold('elapsed', 7, 600)).toBe('00:00');
        expect(timeMold('remaining', 7, 123)).toBe('-0:00');
        expect(timeMold('duration', null, null)).toBe('0:00');
        // Without a duration, the time that has passed is the longest one known.
        expect(timeMold('elapsed', 700, null)).toBe('00:00');
    });

    it('holds every character the time shows, for any position in the sound', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...FORMATS),
                fc.double({ min: 0, max: 40_000, noNaN: true }),
                fc.double({ min: 0, max: 1, noNaN: true }),
                (format, duration, ratio) => {
                    const time = duration * ratio;
                    const mold = counts(timeMold(format, time, duration));

                    for (const [char, count] of counts(
                        timeText(format, time, duration),
                    )) {
                        expect(mold.get(char) ?? 0).toBeGreaterThanOrEqual(
                            count,
                        );
                    }
                },
            ),
        );
    });

    it('takes no more room than the time shows at the end of the sound', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...FORMATS),
                fc.double({ min: 0, max: 40_000, noNaN: true }),
                (format, duration) => {
                    const end =
                        format === 'remaining'
                            ? timeText(format, 0, duration)
                            : timeText(format, duration, duration);

                    expect(timeMold(format, 0, duration)).toBe(
                        end.replace(/\d/g, '0'),
                    );
                },
            ),
        );
    });
});

describe('speeds', () => {
    it('steps through the speeds and wraps around', () => {
        expect(nextSpeed(1, [1, 1.5, 2])).toBe(1.5);
        expect(nextSpeed(2, [1, 1.5, 2])).toBe(1);
        expect(nextSpeed(1.25, [1, 1.5, 2])).toBe(1);
    });

    it('names a speed without trailing zeros', () => {
        expect(speedText(1)).toBe('1×');
        expect(speedText(1.5)).toBe('1.5×');
        expect(speedText(1.25)).toBe('1.25×');
    });
});
