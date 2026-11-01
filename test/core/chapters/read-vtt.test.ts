/**
 * WebVTT chapters, read through `readChapters`: times exactly as written, the cue text as the
 * title (tags out, entities decoded), and the blocks and cues the specification skips.
 */

import { describe, expect, it } from 'vite-plus/test';
import { readChapters } from '../../../src/core/chapters/chapters';
import { starts, titles } from './chapter-fields';

describe('readChapters: WebVTT', () => {
    it('reads a time exactly as written, to the thousandth', () => {
        // Seconds and thousandths added as numbers would make 00:01.503 1.5030000000000001.
        const [chapter] = readChapters(
            'WEBVTT\n\n00:01.503 --> 01:02:03.703\nOne\n',
        );

        expect(chapter.start).toBe(1.503);
        expect(chapter.end).toBe(3723.703);
    });

    it('reads cues with and without hours, an identifier and a cue without one', () => {
        const chapters = readChapters(
            [
                'WEBVTT - podcast chapters',
                '',
                'intro',
                '00:00.000 --> 01:30.500',
                'Welcome',
                '',
                '01:30.500 --> 1:02:03.250 align:start',
                'The interview',
                '',
                '01:02:03.250 --> 01:10:00.000',
                'Goodbye',
            ].join('\n'),
        );

        expect(chapters).toEqual([
            {
                start: 0,
                end: 90.5,
                title: 'Welcome',
                image: null,
                url: null,
                toc: true,
            },
            {
                start: 90.5,
                end: 3723.25,
                title: 'The interview',
                image: null,
                url: null,
                toc: true,
            },
            {
                start: 3723.25,
                end: 4200,
                title: 'Goodbye',
                image: null,
                url: null,
                toc: true,
            },
        ]);
    });

    it('skips NOTE, STYLE and REGION blocks, and takes CRLF and a byte-order mark', () => {
        const chapters = readChapters(
            String.fromCharCode(0xfeff) +
                'WEBVTT\r\n\r\nNOTE written by hand\r\n00:01.000 --> 00:02.000\r\n\r\n' +
                'STYLE\r\n::cue { color: red }\r\n\r\nREGION\r\nid:fred\r\n\r\n' +
                '00:05.000 --> 00:09.000\r\nOnly cue\r\n',
        );

        expect(titles(chapters)).toEqual(['Only cue']);
        expect(starts(chapters)).toEqual([5]);
    });

    it('joins the lines of a title, drops the tags and decodes the entities after them', () => {
        const [chapter] = readChapters(
            'WEBVTT\n\n00:00.000 --> 00:10.000\n<v Ana><b>Rock</b> &amp; roll\n&lt;b&gt; is &#x41;&#66; &nbsp;fine</v>',
        );

        expect(chapter.title).toBe('Rock & roll <b> is AB fine');
    });

    it('skips a cue whose timing is broken or runs backwards, and keeps the rest', () => {
        const chapters = readChapters(
            [
                'WEBVTT',
                '',
                '00:00.000 --> 00:10.000',
                'Good',
                '',
                '00:61.000 --> 01:10.000',
                'Bad seconds',
                '',
                '00:30.000 --> 00:20.000',
                'Backwards',
                '',
                '5:00.000 --> 06:00.000',
                'Hours without seconds',
                '',
                '00:10:00.0 --> 00:11:00.000',
                'Short fraction',
                '',
                'no timing here',
                'Not a cue',
                '',
                '00:40.000-->00:50.000',
                'Tight arrow',
                '',
                '00:50.000 --> 00:55.000',
                'Title ends',
                '00:51.000 --> 00:52.000',
                'at a timing line',
            ].join('\n'),
        );

        expect(titles(chapters)).toEqual(['Good', 'Tight arrow', 'Title ends']);
    });

    it('cleans a title: one line, no control or bidi characters, at most 120 characters', () => {
        const [chapter] = readChapters(
            `WEBVTT\n\n00:00.000 --> 00:10.000\nA‮b\u0007 ${'x'.repeat(500)}`,
        );

        expect(chapter.title.startsWith('A b x')).toBe(true);
        expect(chapter.title).toHaveLength(120);
    });
});
