/**
 * A precise clock: the time with tenths, hundredths or milliseconds (rounded to the nearest), or a
 * timecode's frame (the frame the sound is in), with the hours, digits and decimal mark as asked, or
 * written by a mask. The time played and the time left add up to the length shown, the mold keeps
 * the widest text's room, and the next change is when the text really changes.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';
import {
    clockMold,
    clockStep,
    clockText,
    decimalMark,
    formatClock,
    isClockMask,
    nextClockChange,
    type ClockFormat,
    type ClockHours,
    type ClockPrecision,
} from '../../../src/core/shared/clock';

function clock(given: ClockFormat = {}): ClockFormat {
    return {
        precision: 'hundredths',
        fps: 30,
        hours: 'auto',
        decimal: '.',
        ...given,
    };
}

const PRECISIONS: ClockPrecision[] = [
    'seconds',
    'tenths',
    'hundredths',
    'milliseconds',
    'frames',
];

const FORMS = ['elapsed', 'remaining', 'duration', 'both'] as const;

/** Masks of every kind: folded hours, hours only from one hour on, words, decimals, frames. */
const MASKS = [
    'm:s',
    'H:m:s.S',
    'hh[h]mm[m]ss[s]',
    'sss.SS',
    'mmmm:ss',
    'hh:mm:ss;ff',
    'H[ HORAS, ]mm[ MINUTOS, ]ss[ SEGUNDOS]',
];

/** Steps in a second as the test counts them: 10, 100 or 1000, or every frame a second can start. */
function slotsOf(format: ClockFormat): number {
    switch (format.precision) {
        case 'tenths':
            return 10;
        case 'hundredths':
            return 100;
        case 'milliseconds':
            return 1000;
        case 'frames':
            return Math.ceil(format.fps ?? 30);
        default:
            return 1;
    }
}

/** A written time read back into steps, by its digits alone: `1:05.25` is 6525 hundredths. */
function stepsOf(text: string, format: ClockFormat): number {
    const unsigned = text.replace(/^-/, '');
    const frames = format.precision === 'frames';
    const [clockPart, fraction = ''] = frames
        ? [
              unsigned.slice(0, unsigned.lastIndexOf(':')),
              unsigned.slice(unsigned.lastIndexOf(':') + 1),
          ]
        : unsigned.split(/[.,]/);
    const seconds = clockPart
        .split(':')
        .reduce((total, field) => total * 60 + Number(field), 0);

    return seconds * slotsOf(format) + (fraction === '' ? 0 : Number(fraction));
}

describe('formatClock', () => {
    it('writes tenths, hundredths and milliseconds rounded to the nearest, carrying into the minute', () => {
        expect(formatClock(0, clock({ precision: 'tenths' }))).toBe('0:00.0');
        expect(formatClock(0.04, clock({ precision: 'tenths' }))).toBe(
            '0:00.0',
        );
        expect(formatClock(0.05, clock({ precision: 'tenths' }))).toBe(
            '0:00.1',
        );
        expect(formatClock(65.25, clock({ precision: 'tenths' }))).toBe(
            '1:05.3',
        );
        expect(formatClock(59.96, clock({ precision: 'tenths' }))).toBe(
            '1:00.0',
        );
        expect(formatClock(65.25, clock())).toBe('1:05.25');
        expect(formatClock(59.996, clock())).toBe('1:00.00');
        expect(formatClock(3599.999, clock())).toBe('1:00:00.00');
        expect(formatClock(65.25, clock({ precision: 'milliseconds' }))).toBe(
            '1:05.250',
        );
        expect(formatClock(0.0004, clock({ precision: 'milliseconds' }))).toBe(
            '0:00.000',
        );
        expect(formatClock(0.0005, clock({ precision: 'milliseconds' }))).toBe(
            '0:00.001',
        );
        expect(
            formatClock(3599.9996, clock({ precision: 'milliseconds' })),
        ).toBe('1:00:00.000');
    });

    it('writes whole seconds cut, as formatTime does, and takes the defaults for what is left out', () => {
        expect(formatClock(65.9, clock({ precision: 'seconds' }))).toBe('1:05');
        expect(formatClock(3600, clock({ precision: 'seconds' }))).toBe(
            '1:00:00',
        );
        expect(formatClock(65.9)).toBe('1:05');
    });

    it('writes the frame the sound is in after the hours, as a timecode, two digits up to 100 frames a second and three above', () => {
        const frames = (fps: number): ClockFormat =>
            clock({ precision: 'frames', fps });

        expect(formatClock(65.5, frames(30))).toBe('0:01:05:15');
        expect(formatClock(1 / 30, frames(30))).toBe('0:00:00:01');
        // 10.7 s is 10 s and 21 frames; the float sum reads 20.999… frames.
        expect(formatClock(10.7, frames(30))).toBe('0:00:10:21');
        expect(formatClock(0.999, frames(30))).toBe('0:00:00:29');
        expect(formatClock(65.5, frames(25))).toBe('0:01:05:12');
        expect(formatClock(10.99, frames(24))).toBe('0:00:10:23');
        expect(formatClock(0.999, frames(29.97))).toBe('0:00:00:29');
        expect(formatClock(0.5, frames(120))).toBe('0:00:00:060');
    });

    it('writes the hours from one hour on, always, or as needed even for a frame', () => {
        expect(formatClock(65.25, clock({ hours: 'always' }))).toBe(
            '0:01:05.25',
        );
        expect(
            formatClock(65, clock({ precision: 'seconds', hours: 'always' })),
        ).toBe('0:01:05');
        expect(formatClock(65.25, clock({ hours: 'needed' }))).toBe('1:05.25');
        expect(
            formatClock(
                349.5,
                clock({ precision: 'frames', fps: 25, hours: 'needed' }),
            ),
        ).toBe('5:49:12');
        expect(
            formatClock(
                3725.5,
                clock({ precision: 'frames', fps: 25, hours: 'needed' }),
            ),
        ).toBe('1:02:05:12');
    });

    it('writes each field with its least digits, minutes under hours keeping two', () => {
        expect(
            formatClock(65.25, clock({ digits: { hours: 2, minutes: 2 } })),
        ).toBe('01:05.25');
        expect(
            formatClock(
                65.25,
                clock({ hours: 'always', digits: { hours: 2, minutes: 2 } }),
            ),
        ).toBe('00:01:05.25');
        expect(formatClock(65.25, clock({ digits: { minutes: 4 } }))).toBe(
            '0001:05.25',
        );
        expect(formatClock(65.25, clock({ digits: { seconds: 4 } }))).toBe(
            '1:0005.25',
        );
        expect(
            formatClock(
                65.25,
                clock({ hours: 'always', digits: { minutes: 1 } }),
            ),
        ).toBe('0:01:05.25');
        expect(
            formatClock(
                3725.5,
                clock({
                    precision: 'frames',
                    fps: 25,
                    digits: { hours: 2, frames: 4 },
                }),
            ),
        ).toBe('01:02:05:0012');
    });

    it('keeps each field’s digits in range: hours and minutes 1 to 4, seconds and frames 2 to 4', () => {
        expect(formatClock(65.25, clock({ digits: { minutes: 9 } }))).toBe(
            '0001:05.25',
        );
        expect(formatClock(65.25, clock({ digits: { seconds: 1 } }))).toBe(
            '1:05.25',
        );
        expect(
            formatClock(65.25, clock({ digits: { minutes: Number.NaN } })),
        ).toBe('1:05.25');
    });

    it('writes the decimal mark asked for', () => {
        expect(formatClock(65.25, clock({ decimal: ',' }))).toBe('1:05,25');
    });

    it('writes a negative or unknown time as zero', () => {
        expect(formatClock(-3, clock({ precision: 'tenths' }))).toBe('0:00.0');
        expect(formatClock(Number.NaN, clock({ precision: 'tenths' }))).toBe(
            '0:00.0',
        );
    });
});

describe('a mask', () => {
    it('writes each field with as many digits as its letter repeats, and everything else as it is', () => {
        expect(formatClock(65.25, { format: 'hh:mm:ss.SSS' })).toBe(
            '00:01:05.250',
        );
        expect(formatClock(65.25, { format: 'm:ss,SS' })).toBe('1:05,25');
        expect(formatClock(65.5, { format: 'hh:mm:ss;ff', fps: 25 })).toBe(
            '00:01:05;12',
        );
    });

    it('writes letters as text inside brackets, with any separator or none', () => {
        expect(formatClock(2246, { format: 'hh[h]:mm[m]:ss[s]' })).toBe(
            '00h:37m:26s',
        );
        expect(formatClock(2246, { format: 'hh[h]mm[m]ss[s]' })).toBe(
            '00h37m26s',
        );
        expect(formatClock(2246, { format: 'hh[h] mm[m] ss[s]' })).toBe(
            '00h 37m 26s',
        );
        expect(
            formatClock(1886, {
                format: 'hh[ HORAS, ]mm[ MINUTOS, ]ss[ SEGUNDOS]',
            }),
        ).toBe('00 HORAS, 31 MINUTOS, 26 SEGUNDOS');
        expect(formatClock(2246, { format: 'hh[H]mm[M]ss[S]' })).toBe(
            '00H37M26S',
        );
    });

    it('leaves out hours written H, and the text after them, below an hour', () => {
        expect(formatClock(65, { format: 'H:mm:ss' })).toBe('01:05');
        expect(formatClock(3725, { format: 'H:mm:ss' })).toBe('1:02:05');
        expect(formatClock(65, { format: 'H[ HORAS, ]mm[ MIN, ]ss' })).toBe(
            '01 MIN, 05',
        );
    });

    it('lets the first field hold what the mask has no field for', () => {
        expect(formatClock(3725, { format: 'mmmm:ss' })).toBe('0062:05');
        expect(formatClock(3725.5, { format: 'sss.SS' })).toBe('3725.50');
    });

    it('gives the frame room for its largest number, whatever the letters say', () => {
        expect(formatClock(0.1, { format: 'm:ss:f', fps: 30 })).toBe('0:00:03');
    });

    it('wins over the precision, hours, digits and decimal mark', () => {
        expect(
            formatClock(
                65.25,
                clock({
                    precision: 'milliseconds',
                    hours: 'always',
                    digits: { hours: 3 },
                    decimal: ',',
                    format: 'mm:ss',
                }),
            ),
        ).toBe('01:05');
    });

    it('is dropped for the options when it cannot be read', () => {
        for (const odd of [
            '',
            'mm:hh:ss',
            'hh:mm',
            'hh:ss',
            'sssss',
            'ss.SSSS',
            'ss.SS:ff',
            'hH:mm:ss',
            'ss:mm',
            '[mm:ss',
            'ss[ sec',
            `${'x'.repeat(39)}ss`,
        ]) {
            expect(isClockMask(odd), odd).toBe(false);
            expect(formatClock(65.25, clock({ format: odd })), odd).toBe(
                '1:05.25',
            );
        }

        expect(isClockMask(42)).toBe(false);
        expect(isClockMask('hh:mm:ss.SSS')).toBe(true);
        expect(isClockMask(`${'x'.repeat(38)}ss`)).toBe(true);
    });
});

describe('clockText', () => {
    it('reads the time played, the time left, the length, or both', () => {
        const hundredths = clock();

        expect(clockText('elapsed', 12.344, 75.5, hundredths)).toBe('0:12.34');
        expect(clockText('remaining', 12.344, 75.5, hundredths)).toBe(
            '-1:03.16',
        );
        expect(clockText('duration', 12.344, 75.5, hundredths)).toBe('1:15.50');
        expect(clockText('both', 12.344, 75.5, hundredths)).toBe(
            '0:12.34 / 1:15.50',
        );
    });

    it('never shows the time played past the length', () => {
        const seconds = clock({ precision: 'seconds', hours: 'always' });

        expect(clockText('elapsed', 75.499, 75.5, clock())).toBe('1:15.50');
        expect(clockText('remaining', 75.499, 75.5, clock())).toBe('-0:00.00');
        // Whole seconds read a hair ahead: 9.97 s would read 10, past a length of 9.99 s.
        expect(clockText('both', 9.97, 9.99, seconds)).toBe(
            '0:00:09 / 0:00:09',
        );
    });

    it('counts the time left in the clock’s own steps, as a timecode subtracts', () => {
        const frames = clock({ precision: 'frames', fps: 25 });

        expect(clockText('elapsed', 1.5, 3, frames)).toBe('0:00:01:12');
        expect(clockText('remaining', 1.5, 3, frames)).toBe('-0:00:01:13');
    });

    it('moves whole seconds a hair ahead, as the plain clock does, when a seek lands short of one', () => {
        const seconds = clock({ precision: 'seconds', hours: 'always' });

        expect(clockText('elapsed', 4.96, 10, seconds)).toBe('0:00:05');
        expect(clockText('remaining', 4.96, 10, seconds)).toBe('-0:00:05');
    });

    it('reads zero for a length not known yet', () => {
        expect(clockText('both', 3, null, clock())).toBe('0:03.00 / 0:00.00');
        expect(clockText('remaining', 3, null, clock())).toBe('-0:00.00');
    });

    it('adds the time played and the time left up to the length shown, for any clock', () => {
        const digit = (least: number): fc.Arbitrary<number> =>
            fc.integer({ min: least, max: 4 });
        const format = fc.record<ClockFormat>({
            precision: fc.constantFrom(...PRECISIONS),
            fps: fc.constantFrom(24, 25, 29.97, 30, 60, 120),
            hours: fc.constantFrom<ClockHours>('auto', 'always', 'needed'),
            decimal: fc.constantFrom('.', ','),
            digits: fc.record({
                hours: digit(1),
                minutes: digit(1),
                seconds: digit(2),
                frames: digit(2),
            }),
        });

        fc.assert(
            fc.property(
                format,
                fc.double({ min: 0, max: 7200, noNaN: true }),
                fc.double({ min: 0, max: 1, noNaN: true }),
                (given, duration, share) => {
                    const time = duration * share;
                    const played = stepsOf(
                        clockText('elapsed', time, duration, given),
                        given,
                    );
                    const left = stepsOf(
                        clockText('remaining', time, duration, given),
                        given,
                    );
                    const length = stepsOf(
                        clockText('duration', time, duration, given),
                        given,
                    );

                    expect(played + left).toBe(length);
                },
            ),
        );
    });
});

describe('clockMold', () => {
    it('is the widest text the sound can show, every digit a zero', () => {
        expect(clockMold('both', 12, 75.5, clock())).toBe('0:00.00 / 0:00.00');
        expect(
            clockMold('elapsed', 0, 3700, clock({ precision: 'milliseconds' })),
        ).toBe('0:00:00.000');
        expect(
            clockMold('remaining', 0, 30, clock({ precision: 'frames' })),
        ).toBe('-0:00:00:00');
    });

    it('keeps two digits for minutes and seconds under the first field, whatever a mask says', () => {
        expect(clockMold('elapsed', 0, 125, { format: 'm:s' })).toBe('0:00');
        expect(clockMold('elapsed', 0, 3725, { format: 'H:m:s' })).toBe(
            '0:00:00',
        );
    });

    it('is never narrower than the text, whatever the time, the options or the mask', () => {
        const format = fc.oneof(
            fc
                .constantFrom(...PRECISIONS)
                .map((precision) => clock({ precision })),
            fc.constantFrom(...MASKS).map((mask) => clock({ format: mask })),
        );

        fc.assert(
            fc.property(
                format,
                fc.constantFrom(...FORMS),
                fc.double({ min: 0, max: 7200, noNaN: true }),
                fc.double({ min: 0, max: 1, noNaN: true }),
                (given, form, duration, share) => {
                    const mold = clockMold(
                        form,
                        duration * share,
                        duration,
                        given,
                    );

                    expect(mold).toMatch(/^[^1-9]+$/);
                    expect(mold.length).toBeGreaterThanOrEqual(
                        clockText(form, duration * share, duration, given)
                            .length,
                    );
                },
            ),
        );
    });
});

describe('clockStep', () => {
    it('is how long one step of the clock lasts, in seconds, the mask’s when it has one', () => {
        expect(clockStep(clock({ precision: 'seconds' }))).toBe(1);
        expect(clockStep(clock({ precision: 'tenths' }))).toBe(0.1);
        expect(clockStep(clock({ precision: 'hundredths' }))).toBe(0.01);
        expect(clockStep(clock({ precision: 'milliseconds' }))).toBe(0.001);
        expect(clockStep(clock({ precision: 'frames', fps: 25 }))).toBe(0.04);
        expect(clockStep(clock({ format: 'mm:ss.S' }))).toBe(0.1);
        expect(clockStep(clock({ format: 'mm:ss' }))).toBe(1);
    });
});

describe('nextClockChange', () => {
    it('is the time until the shown time changes, shorter as the sound plays faster', () => {
        expect(
            nextClockChange(1.02, clock({ precision: 'tenths' }), 1),
        ).toBeCloseTo(0.03, 9);
        expect(
            nextClockChange(1.02, clock({ precision: 'tenths' }), 2),
        ).toBeCloseTo(0.015, 9);
        expect(
            nextClockChange(1.5, clock({ precision: 'frames', fps: 25 }), 1),
        ).toBeCloseTo(0.02, 9);
    });

    it('is null while the sound does not move forward', () => {
        expect(nextClockChange(1, clock(), 0)).toBeNull();
        expect(nextClockChange(1, clock(), Number.NaN)).toBeNull();
    });

    it('matches walking the time forward a tenth of a millisecond at a time until the text changes', () => {
        const format = fc.oneof(
            fc
                .tuple(
                    fc.constantFrom(...PRECISIONS),
                    fc.constantFrom(24, 25, 29.97, 30, 60),
                )
                .map(([precision, fps]) => clock({ precision, fps })),
            fc
                .constantFrom(...MASKS)
                .map((mask) => clock({ format: mask, fps: 25 })),
        );

        fc.assert(
            fc.property(
                format,
                fc.double({ min: 0, max: 100, noNaN: true }),
                (given, time) => {
                    const shown = clockText('elapsed', time, null, given);
                    let walked = 1;

                    while (
                        clockText(
                            'elapsed',
                            time + walked / 10000,
                            null,
                            given,
                        ) === shown
                    ) {
                        walked += 1;
                    }

                    expect(
                        Math.abs(
                            (nextClockChange(time, given, 1) ?? 0) -
                                walked / 10000,
                        ),
                    ).toBeLessThanOrEqual(0.00015);
                },
            ),
            { numRuns: 60 },
        );
    });
});

describe('decimalMark', () => {
    it('is the mark the language writes before decimals, a point when the language is unknown', () => {
        expect(decimalMark('en-US')).toBe('.');
        expect(decimalMark('pt-BR')).toBe(',');
        expect(decimalMark('fr')).toBe(',');
        expect(decimalMark('not a language!')).toBe('.');
    });
});
