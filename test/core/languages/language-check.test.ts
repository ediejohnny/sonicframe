/**
 * The check a language passes: one line for each phrase missing, each mark changed, each phrase too
 * long and each name English does not have; none for complete words.
 */

import { describe, expect, it } from 'vite-plus/test';
import { EN } from '../../../src/core/languages/en';
import { languageProblems } from '../../../src/core/languages/language-check';

describe('languageProblems', () => {
    it('finds nothing wrong with complete words, whatever the order of their marks', () => {
        expect(languageProblems(EN)).toEqual([]);
        expect(
            languageProblems({
                ...EN,
                zoom: { view: '{to} {from} {level} {to}' },
            }),
        ).toEqual([]);
    });

    it('says each phrase that is missing, but for the thirteen added after 1.0', () => {
        const phrases = Object.values(EN).flatMap((group) =>
            Object.keys(group),
        );
        const problems = languageProblems(undefined);

        expect(problems).toHaveLength(phrases.length - 13);
        expect(problems).toContain('frame.position is missing');
        expect(problems).toContain('markers.more is missing');
        expect(problems).toContain('player.player is missing');
        expect(problems).not.toContain('player.nextTrack is missing');
        expect(
            languageProblems({
                ...EN,
                playlist: { ...EN.playlist, shuffle: 3 },
            }),
        ).toEqual(['playlist.shuffle is missing']);
        expect(
            languageProblems({ ...EN, playButton: { play: 'Play', pause: 3 } }),
        ).toEqual(['playButton.pause is missing']);
    });

    it('says each mark changed, each name of its own and each phrase too long', () => {
        expect(
            languageProblems({
                ...EN,
                frame: { position: 'a'.repeat(201) },
                markers: { ...EN.markers, more: 'and more', extra: 'x' },
                regions: { ...EN.regions, place: '{from} {until}' },
                invented: {},
            }),
        ).toEqual([
            'frame.position is longer than 200 characters',
            'markers.more must have the marks {count}',
            'markers.extra is not a phrase of SonicFrame',
            'regions.place must have the marks {from} {to}',
            'invented is not a group of SonicFrame',
        ]);
        expect(
            languageProblems({
                ...EN,
                regions: { ...EN.regions, loopOn: 'on {at}' },
            }),
        ).toEqual(['regions.loopOn must have the marks (none)']);
    });
});
