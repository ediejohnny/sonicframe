/** The recorder's words: in the language asked for, with the app's own over them, marks filled in. */

import { describe, expect, it } from 'vite-plus/test';
import { recorderWords } from '../../../src/core/recording/recorder-words';

describe('recorderWords', () => {
    it('speaks English unless asked, and each language it knows', () => {
        expect(recorderWords(undefined).words.record).toBe('Record');
        expect(recorderWords('pt-BR').words.record).toBe('Gravar');
        expect(recorderWords('pt-PT').words.recording).toBe('A gravar');
        expect(recorderWords('es').words.record).toBe('Grabar');
        expect(recorderWords('fr-CA').words.record).toBe('Enregistrer');
        expect(recorderWords('de').words.record).toBe('Record');
    });

    it('fills the marks in', () => {
        expect(recorderWords('en').say('stopped', { time: '0:42' })).toBe(
            'Recording stopped, 0:42',
        );
        expect(recorderWords('pt').say('elapsed', { time: '1:05' })).toBe(
            '1:05 de gravação',
        );
    });

    it('takes the app’s own words, cleaned to one line, and only its own names', () => {
        const words = recorderWords('en', {
            record: 'Hold\u0007 to talk',
            send: 42 as unknown as string,
            shout: 'Loud',
        } as Record<string, string>);

        expect(words.words.record).toBe('Hold to talk');
        expect(words.words.send).toBe('Send the recording');
        expect('shout' in words.words).toBe(false);
    });

    it('marks the text with the language of the app’s own words, and its own otherwise', () => {
        expect(recorderWords('de').locale).toBe('en');
        expect(recorderWords('de', { record: 'Aufnehmen' }).locale).toBe('de');
    });
});
