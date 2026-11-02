/**
 * A precise clock: the time with tenths, hundredths or milliseconds (rounded to the nearest), or a
 * timecode's frame (the frame the sound is in), with the hours and the decimal mark as asked. The
 * time played and the time left add up to the length shown, the mold keeps the widest text's room,
 * and the next change is when the text really changes.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';
import {
    clockMold,
    clockStep,
    clockText,
    decimalMark,
    formatClock,
    nextClockChange,
    type ClockFormat,
    type ClockPrecision,
} from '../../../src/core/shared/clock';

function clock(given: Partial<ClockFormat> = {}): ClockFormat {
    return {
        precision: 'hundredths',
        fps: 30,
        hours: 'auto',
        decimal: '.',
        ...given,
    };
}

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
            return Math.ceil(format.fps);
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

    it('writes whole seconds cut, as formatTime does', () => {
        expect(formatClock(65.9, clock({ precision: 'seconds' }))).toBe('1:05');
        expect(formatClock(3600, clock({ precision: 'seconds' }))).toBe(
            '1:00:00',
        );
    });

    it('writes the frame the sound is in, two digits up to 100 frames a second and three above', () => {
        expect(formatClock(65.5, clock({ precision: 'frames', fps: 30 }))).toBe(
            '1:05:15',
        );
        expect(
            formatClock(1 / 30, clock({ precision: 'frames', fps: 30 })),
        ).toBe('0:00:01');
        // 10.7 s is 10 s and 21 frames; the float sum reads 20.999… frames.
        expect(formatClock(10.7, clock({ precision: 'frames', fps: 30 }))).toBe(
            '0:10:21',
        );
        expect(
            formatClock(0.999, clock({ precision: 'frames', fps: 30 })),
        ).toBe('0:00:29');
        expect(formatClock(65.5, clock({ precision: 'frames', fps: 25 }))).toBe(
            '1:05:12',
        );
        expect(
            formatClock(10.99, clock({ precision: 'frames', fps: 24 })),
        ).toBe('0:10:23');
        expect(
            formatClock(0.999, clock({ precision: 'frames', fps: 29.97 })),
        ).toBe('0:00:29');
        expect(formatClock(0.5, clock({ precision: 'frames', fps: 120 }))).toBe(
            '0:00:060',
        );
    });

    it('writes the hours from one hour on, always, or always in two digits', () => {
        expect(formatClock(65.25, clock({ hours: 'always' }))).toBe(
            '0:01:05.25',
        );
        expect(formatClock(65.25, clock({ hours: 'padded' }))).toBe(
            '00:01:05.25',
        );
        expect(
            formatClock(65, clock({ precision: 'seconds', hours: 'always' })),
        ).toBe('0:01:05');
        expect(
            formatClock(
                3725.5,
                clock({ precision: 'frames', fps: 25, hours: 'padded' }),
            ),
        ).toBe('01:02:05:12');
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

        expect(clockText('elapsed', 1.5, 3, frames)).toBe('0:01:12');
        expect(clockText('remaining', 1.5, 3, frames)).toBe('-0:01:13');
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
        const format = fc.record<ClockFormat>({
            precision: fc.constantFrom<ClockPrecision>(
                'seconds',
                'tenths',
                'hundredths',
                'milliseconds',
                'frames',
            ),
            fps: fc.constantFrom(24, 25, 29.97, 30, 60, 120),
            hours: fc.constantFrom('auto', 'always', 'padded'),
            decimal: fc.constantFrom('.', ','),
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
        ).toBe('-0:00:00');
    });

    it('is never narrower than the text, whatever the time', () => {
        fc.assert(
            fc.property(
                fc.constantFrom<ClockPrecision>(
                    'tenths',
                    'hundredths',
                    'milliseconds',
                    'frames',
                ),
                fc.constantFrom(
                    'elapsed',
                    'remaining',
                    'duration',
                    'both',
                ) as fc.Arbitrary<
                    'elapsed' | 'remaining' | 'duration' | 'both'
                >,
                fc.double({ min: 0, max: 7200, noNaN: true }),
                fc.double({ min: 0, max: 1, noNaN: true }),
                (precision, form, duration, share) => {
                    const given = clock({ precision });
                    const mold = clockMold(
                        form,
                        duration * share,
                        duration,
                        given,
                    );

                    expect(mold).toMatch(/^[-0:. /]+$/);
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
    it('is how long one step of the clock lasts, in seconds', () => {
        expect(clockStep(clock({ precision: 'seconds' }))).toBe(1);
        expect(clockStep(clock({ precision: 'tenths' }))).toBe(0.1);
        expect(clockStep(clock({ precision: 'hundredths' }))).toBe(0.01);
        expect(clockStep(clock({ precision: 'milliseconds' }))).toBe(0.001);
        expect(clockStep(clock({ precision: 'frames', fps: 25 }))).toBe(0.04);
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
        fc.assert(
            fc.property(
                fc.constantFrom<ClockPrecision>(
                    'seconds',
                    'tenths',
                    'hundredths',
                    'milliseconds',
                    'frames',
                ),
                fc.constantFrom(24, 25, 29.97, 30, 60),
                fc.double({ min: 0, max: 100, noNaN: true }),
                (precision, fps, time) => {
                    const given = clock({ precision, fps });
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
