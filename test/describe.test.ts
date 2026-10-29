import { describe, expect, it } from 'vite-plus/test';
import {
    describeSound,
    nextPart,
    outlineSound,
    partAt,
    silenceAt,
    soundWords,
} from '../src/core/describe';
import { localeFor, resolveLanguage } from '../src/core/language';

/** Peaks every `step` seconds over `duration`, from a function of the time. */
function peaksOf(
    duration: number,
    count: number,
    at: (time: number) => number,
): number[] {
    return Array.from({ length: count }, (_, index) =>
        at((index * duration) / count),
    );
}

/** 33 seconds: sound to 20 s with a loud spot at 12 s, a 4-second pause, then sound to the end. */
const NOTE = peaksOf(33, 330, (time) => {
    if (time >= 20 && time < 24) {
        return 0;
    }

    return time >= 11.75 && time < 12.45 ? 1 : 0.5;
});

describe('outlining a sound', () => {
    it('finds the parts, the pause between them and the loud spot', () => {
        const outline = outlineSound(NOTE, 33);

        expect(outline).not.toBeNull();
        expect(outline?.silent).toBe(false);
        expect(outline?.parts).toHaveLength(2);
        expect(outline?.parts[0].start).toBe(0);
        expect(outline?.parts[0].end).toBeCloseTo(20, 5);
        expect(outline?.parts[1].start).toBeCloseTo(24, 5);
        expect(outline?.parts[1].end).toBe(33);
        expect(outline?.pauses).toHaveLength(1);
        expect(outline?.leading).toBe(0);
        expect(outline?.trailing).toBe(0);
        expect(outline?.loudest).toBeCloseTo(12.15, 1);
    });

    it('says nothing without peaks or a real duration', () => {
        expect(outlineSound([], 10)).toBeNull();
        expect(outlineSound([0.5], 0)).toBeNull();
        expect(outlineSound([0.5], Number.NaN)).toBeNull();
        expect(outlineSound([0.5], Number.POSITIVE_INFINITY)).toBeNull();
    });

    it('treats a peak that is not a number as quiet', () => {
        const outline = outlineSound([0.5, Number.NaN, 0.5, 0.5], 4);

        expect(outline?.silent).toBe(false);
    });

    it('reads every zero as silence', () => {
        const outline = outlineSound(
            Array.from({ length: 100 }, () => 0),
            10,
        );

        expect(outline?.silent).toBe(true);
        expect(outline?.parts).toEqual([]);
        expect(outline?.loudest).toBeNull();
    });

    it('keeps the silence at the ends apart from the pauses', () => {
        const outline = outlineSound(
            peaksOf(60, 600, (time) => (time < 3 || time >= 50 ? 0 : 0.5)),
            60,
        );

        expect(outline?.leading).toBeCloseTo(3, 5);
        expect(outline?.trailing).toBeCloseTo(10, 5);
        expect(outline?.pauses).toEqual([]);
        expect(outline?.parts).toHaveLength(1);
    });

    it('ignores pauses shorter than the shortest one asked for', () => {
        const outline = outlineSound(NOTE, 33, { minPause: 5 });

        expect(outline?.pauses).toEqual([]);
        expect(outline?.parts).toHaveLength(1);
    });

    it('tells a sound that grows from one that fades and one that stays even', () => {
        const grows = outlineSound(
            peaksOf(60, 600, (time) => 0.2 + (0.8 * time) / 59.9),
            60,
        );
        const fades = outlineSound(
            peaksOf(60, 600, (time) => 1 - (0.8 * time) / 59.9),
            60,
        );
        const even = outlineSound(
            peaksOf(60, 600, () => 0.5),
            60,
        );

        expect(grows?.level).toBe('rises');
        expect(grows?.loudest).toBeCloseTo(59.4, 1);
        expect(fades?.level).toBe('falls');
        expect(even?.level).toBe('steady');
        expect(even?.loudest).toBeNull();
    });

    it('folds a very long list of peaks before looking at it', () => {
        const peaks = peaksOf(3600, 200_000, (time) =>
            time >= 1800 && time < 1830 ? 0 : 0.5,
        );
        const outline = outlineSound(peaks, 3600);

        expect(outline?.pauses).toHaveLength(1);
        expect(outline?.pauses[0].start).toBeCloseTo(1800, -1);
    });
});

describe('the wave in words', () => {
    it('describes a voice note in English', () => {
        const outline = outlineSound(NOTE, 33);

        expect(outline && describeSound(outline)).toBe(
            '33 seconds. Sound until 20 seconds, a pause of 4 seconds, then sound to the end. ' +
                'Loudest at 12 seconds.',
        );
    });

    it('describes a voice note in Portuguese', () => {
        const outline = outlineSound(NOTE, 33);

        expect(outline && describeSound(outline, { lang: 'pt-BR' })).toBe(
            '33 segundos. Som até 20 segundos, uma pausa de 4 segundos, depois som até o fim. ' +
                'Mais alto por volta de 12 segundos.',
        );
    });

    it('can give the positions as a clock', () => {
        const outline = outlineSound(NOTE, 33);

        expect(outline && describeSound(outline, { times: 'clock' })).toBe(
            '33 seconds. Sound until 0:20, a pause of 4 seconds, then sound to the end. ' +
                'Loudest at 0:12.',
        );
    });

    it('describes silence', () => {
        const outline = outlineSound(
            Array.from({ length: 100 }, () => 0),
            10,
        );

        expect(outline && describeSound(outline)).toBe(
            '10 seconds of silence.',
        );
        expect(outline && describeSound(outline, { lang: 'pt' })).toBe(
            '10 segundos de silêncio.',
        );
    });

    it('describes a continuous, even sound', () => {
        const outline = outlineSound(
            peaksOf(60, 600, () => 0.5),
            60,
        );

        expect(outline && describeSound(outline)).toBe(
            '1 minute. Continuous sound. Even volume.',
        );
        expect(outline && describeSound(outline, { lang: 'pt' })).toBe(
            '1 minuto. Som contínuo. Volume constante.',
        );
    });

    it('tells the silence at the start and at the end', () => {
        const outline = outlineSound(
            peaksOf(60, 600, (time) => (time < 3 || time >= 50 ? 0 : 0.5)),
            60,
        );

        expect(outline && describeSound(outline)).toBe(
            '1 minute. Silence for 3 seconds, then sound until 50 seconds, then silence to the end. ' +
                'Even volume.',
        );
        expect(outline && describeSound(outline, { lang: 'pt' })).toBe(
            '1 minuto. Silêncio por 3 segundos, depois som até 50 segundos, depois silêncio até o fim. ' +
                'Volume constante.',
        );
    });

    it('sums up a long sound with many pauses by its longest one', () => {
        const pauses = [
            [100, 106],
            [200, 205],
            [300, 305],
            [400, 407],
        ];
        const outline = outlineSound(
            peaksOf(600, 600, (time) =>
                pauses.some(([from, to]) => time >= from && time < to)
                    ? 0
                    : 0.5,
            ),
            600,
        );

        expect(outline && describeSound(outline)).toBe(
            '10 minutes. Sound with 4 pauses; the longest, 7 seconds, at 6 minutes, 40 seconds. ' +
                'Even volume.',
        );
        expect(outline && describeSound(outline, { lang: 'pt' })).toBe(
            '10 minutos. Som com 4 pausas; a mais longa, de 7 segundos, por volta de 6 minutos e ' +
                '40 segundos. Volume constante.',
        );
    });

    it('says when a sound grows or fades', () => {
        const grows = outlineSound(
            peaksOf(60, 600, (time) => 0.2 + (0.8 * time) / 59.9),
            60,
        );
        const fades = outlineSound(
            peaksOf(60, 600, (time) => 1 - (0.8 * time) / 59.9),
            60,
        );

        expect(grows && describeSound(grows)).toBe(
            '1 minute. Continuous sound. Gets louder toward the end. Loudest at 59 seconds.',
        );
        expect(fades && describeSound(fades, { lang: 'pt' })).toBe(
            '1 minuto. Som contínuo. Fica mais baixo no fim. Mais alto no início.',
        );
    });

    it('speaks English for a language it has no words for, never a mix', () => {
        const outline = outlineSound(NOTE, 33);

        expect(outline && describeSound(outline, { lang: 'fr' })).toMatch(
            /^33 seconds\. Sound until/,
        );
        expect(
            outline && describeSound(outline, { lang: 'not a language!' }),
        ).toMatch(/^33 seconds\./);
    });

    it("takes the app's own words, in its own language", () => {
        const outline = outlineSound(NOTE, 33);
        const text =
            outline &&
            describeSound(outline, {
                lang: 'es',
                words: { length: 'Dura {duration}.{unknown}' },
            });

        expect(text).toMatch(/^Dura 33 segundos\. Sound until/);
    });

    it('keeps words that are not text, or not safe, out of the result', () => {
        // Built from code points, so no invisible character sits in this file.
        const override = String.fromCodePoint(0x202e);
        const nul = String.fromCodePoint(0);
        const outline = outlineSound(NOTE, 33);
        const text =
            outline &&
            describeSound(outline, {
                words: {
                    length: `${override}{duration}.${nul}`,
                    continuous: 42 as unknown as string,
                },
            });

        expect(text?.includes(override)).toBe(false);
        expect(text?.includes(nul)).toBe(false);
        expect(text).toMatch(/^33 seconds\. Sound until/);
    });

    it('fills only its own marks, never a name from the object prototype', () => {
        const outline = outlineSound(NOTE, 33);
        const text =
            outline &&
            describeSound(outline, {
                words: { length: '{duration}{constructor}{toString}.' },
            });

        expect(text).toMatch(/^33 seconds\. Sound until/);
    });

    it('caps the text however many words come in', () => {
        const outline = outlineSound(NOTE, 33);
        const text =
            outline &&
            describeSound(outline, { words: { length: 'x'.repeat(10_000) } });

        expect(text?.length).toBeLessThanOrEqual(600);
    });
});

describe('moving between the parts', () => {
    const outline = outlineSound(NOTE, 33);

    it('knows which part a time falls in, a seek landing a hair early included', () => {
        expect(outline && partAt(outline, 10)).toBe(0);
        expect(outline && partAt(outline, 22)).toBe(-1);
        expect(outline && partAt(outline, 30)).toBe(1);
        expect(outline && partAt(outline, 23.97)).toBe(1);
        expect(outline && nextPart(outline, 23.97, 1)).toBeNull();
    });

    it('tells the silence at the ends from a pause between parts', () => {
        const ends = outlineSound(
            peaksOf(60, 600, (time) =>
                time < 3 || time >= 50 || (time >= 20 && time < 24) ? 0 : 0.5,
            ),
            60,
        );

        expect(ends && silenceAt(ends, 1)).toBe('silence');
        expect(ends && silenceAt(ends, 22)).toBe('pause');
        expect(ends && silenceAt(ends, 30)).toBeNull();
        expect(ends && silenceAt(ends, 55)).toBe('silence');
    });

    it("says a position as the slider's clock does, cut to the second", () => {
        expect(soundWords().part(0, 4, 1.65)).toBe('Part 1 of 4, 1 second.');
        expect(soundWords({ times: 'clock' }).part(1, 4, 8.9)).toBe(
            'Part 2 of 4, 0:08.',
        );
        expect(soundWords().part(1, 4, 8.9)).toBe('Part 2 of 4, 8 seconds.');
    });

    it('finds the next part and, like a previous track, the start of this one', () => {
        expect(outline && nextPart(outline, 10, 1)).toBe(1);
        expect(outline && nextPart(outline, 25, 1)).toBeNull();
        expect(outline && nextPart(outline, 30, -1)).toBe(1);
        expect(outline && nextPart(outline, 24.5, -1)).toBe(0);
        expect(outline && nextPart(outline, 24.5, -1, 0)).toBe(1);
        expect(outline && nextPart(outline, 0.5, -1)).toBeNull();
    });

    it('names a part for the live region', () => {
        expect(soundWords().part(1, 2, 24)).toBe('Part 2 of 2, 24 seconds.');
        expect(soundWords().part(0, 2, 0.2)).toBe('Part 1 of 2, at the start.');
        expect(soundWords({ lang: 'pt' }).part(1, 2, 24)).toBe(
            'Parte 2 de 2, 24 segundos.',
        );
        expect(soundWords({ lang: 'pt' }).noPart()).toBe('Não há mais partes.');
        expect(soundWords({ lang: 'pt' }).pauseNote()).toBe('pausa');
        expect(soundWords({ lang: 'pt' }).silenceNote()).toBe('silêncio');
    });
});

describe('choosing the language', () => {
    it('knows English and Portuguese, and falls back to English', () => {
        expect(resolveLanguage('pt-BR')).toBe('pt');
        expect(resolveLanguage('PT')).toBe('pt');
        expect(resolveLanguage('en-GB')).toBe('en');
        expect(resolveLanguage('fr')).toBe('en');
        expect(resolveLanguage(undefined)).toBe('en');
    });

    it('marks the text with a valid tag of the language it is in', () => {
        expect(localeFor('pt-br', false)).toBe('pt-BR');
        expect(localeFor('fr', false)).toBe('en');
        expect(localeFor('fr', true)).toBe('fr');
        expect(localeFor('', false)).toBe('en');
        expect(localeFor('x'.repeat(100), true)).toBe('en');
    });
});
