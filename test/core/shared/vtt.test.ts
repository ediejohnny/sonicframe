import { describe, expect, it } from 'vite-plus/test';
import {
    isVtt,
    readVtt,
    textLines,
    vttText,
    vttTime,
} from '../../../src/core/shared/vtt';

describe('textLines', () => {
    it('leaves out the byte-order mark and ends every line in a line feed', () => {
        const marked = `${String.fromCharCode(0xfeff)}WEBVTT\r\n\r\nA\rB\n`;

        expect(textLines(marked)).toBe('WEBVTT\n\nA\nB\n');
        expect(textLines('plain')).toBe('plain');
    });
});

describe('isVtt', () => {
    it('knows a WebVTT file by its first word alone', () => {
        expect(isVtt('WEBVTT')).toBe(true);
        expect(isVtt('WEBVTT - chapters\n')).toBe(true);
        expect(isVtt('WEBVTTX\n')).toBe(false);
        expect(isVtt(' WEBVTT\n')).toBe(false);
    });
});

describe('vttTime', () => {
    it('writes hours, minutes, seconds and thousandths, rounded, never below zero', () => {
        expect(vttTime(0)).toBe('00:00:00.000');
        expect(vttTime(8.5)).toBe('00:00:08.500');
        expect(vttTime(3725.002)).toBe('01:02:05.002');
        expect(vttTime(59.9996)).toBe('00:01:00.000');
        expect(vttTime(-3)).toBe('00:00:00.000');
        expect(vttTime(360000)).toBe('100:00:00.000');
    });

    it('is read back as the same time by the WebVTT reader', () => {
        const [cue] = readVtt(
            `WEBVTT\n\n${vttTime(1.503)} --> ${vttTime(3723.703)}\nOne\n`,
        );

        expect([cue.start, cue.end]).toEqual([1.503, 3723.703]);
    });
});

describe('vttText', () => {
    it('writes &, < and > as character references, so the reader gives the text back', () => {
        expect(vttText('a & b <i> --> c')).toBe('a &amp; b &lt;i&gt; --&gt; c');

        const [cue] = readVtt(
            `WEBVTT\n\n00:00:00.000 --> 00:00:01.000\n${vttText('a & b <i> --> &amp;')}\n`,
        );

        expect(cue.title).toBe('a & b <i> --> &amp;');
    });
});

describe('readVtt', () => {
    it("gives a cue's identifier when it has one", () => {
        const cues = readVtt(
            'WEBVTT\n\nverse 1\n00:00:01.000 --> 00:00:02.000\nOne\n\n00:00:03.000 --> 00:00:04.000\nTwo\n',
        );

        expect(cues).toEqual([
            { start: 1, end: 2, title: 'One', id: 'verse 1' },
            { start: 3, end: 4, title: 'Two' },
        ]);
    });
});
