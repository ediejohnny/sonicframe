/**
 * A recorder's states, and which way each event takes it; the audio formats it tries; how long it
 * records.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';
import {
    DEFAULT_RECORD_TYPES,
    nextRecorderState,
    RECORDER_EVENTS,
    RECORDER_STATES,
    recordSeconds,
    type RecorderEvent,
    type RecorderState,
} from '../../../src/core/recording/recording';
import { pickMimeType } from '../../../src/core/wave/clip';

/** Runs `events` from idle, giving every state passed through. */
function walk(events: readonly RecorderEvent[]): RecorderState[] {
    const states: RecorderState[] = ['idle'];

    for (const event of events) {
        states.push(nextRecorderState(states.at(-1) as RecorderState, event));
    }

    return states;
}

describe('nextRecorderState', () => {
    it('asks for the microphone, records, pauses, resumes and stops into review', () => {
        expect(walk(['start', 'granted', 'pause', 'resume', 'stop'])).toEqual([
            'idle',
            'asking',
            'recording',
            'paused',
            'recording',
            'review',
        ]);
    });

    it('sends from review, back to idle once sent, or kept, or to review after a failure', () => {
        expect(walk(['start', 'granted', 'stop', 'send', 'sent']).at(-1)).toBe(
            'idle',
        );
        expect(walk(['start', 'granted', 'stop', 'send', 'keep']).at(-1)).toBe(
            'review',
        );
        expect(
            walk(['start', 'granted', 'stop', 'send', 'failed']).at(-1),
        ).toBe('review');
    });

    it('goes to denied when the microphone is refused, and can ask again', () => {
        expect(walk(['start', 'denied'])).toEqual(['idle', 'asking', 'denied']);
        expect(walk(['start', 'denied', 'start']).at(-1)).toBe('asking');
        expect(walk(['start', 'denied', 'reset']).at(-1)).toBe('idle');
    });

    it('goes to error on a failure while asking or recording, and can start again', () => {
        expect(walk(['start', 'failed']).at(-1)).toBe('error');
        expect(walk(['start', 'granted', 'failed']).at(-1)).toBe('error');
        expect(walk(['start', 'granted', 'failed', 'start']).at(-1)).toBe(
            'asking',
        );
    });

    it('drops a recording or a review back to idle', () => {
        expect(walk(['start', 'granted', 'discard']).at(-1)).toBe('idle');
        expect(walk(['start', 'granted', 'pause', 'discard']).at(-1)).toBe(
            'idle',
        );
        expect(walk(['start', 'granted', 'stop', 'discard']).at(-1)).toBe(
            'idle',
        );
        expect(walk(['start', 'discard']).at(-1)).toBe('idle');
    });

    it('cancels a send back to review, and nothing else', () => {
        expect(
            walk(['start', 'granted', 'stop', 'send', 'cancel']).at(-1),
        ).toBe('review');
        expect(walk(['start', 'granted', 'cancel']).at(-1)).toBe('recording');
        expect(walk(['start', 'granted', 'stop', 'cancel']).at(-1)).toBe(
            'review',
        );
    });

    it('finishes a recording or a pause straight back to idle, with no review', () => {
        expect(walk(['start', 'granted', 'finish']).at(-1)).toBe('idle');
        expect(walk(['start', 'granted', 'pause', 'finish']).at(-1)).toBe(
            'idle',
        );
        expect(walk(['start', 'finish']).at(-1)).toBe('asking');
        expect(walk(['start', 'granted', 'stop', 'finish']).at(-1)).toBe(
            'review',
        );
    });

    it('stays put on an event that does not apply', () => {
        expect(walk(['pause', 'stop', 'send', 'granted'])).toEqual([
            'idle',
            'idle',
            'idle',
            'idle',
            'idle',
        ]);
        expect(walk(['start', 'granted', 'send', 'resume']).at(-1)).toBe(
            'recording',
        );
        expect(walk(['start', 'granted', 'stop', 'stop', 'pause']).at(-1)).toBe(
            'review',
        );
    });

    it('never leaves its states, and records only after asking, sends only from review', () => {
        fc.assert(
            fc.property(
                fc.array(fc.constantFrom(...RECORDER_EVENTS), {
                    maxLength: 40,
                }),
                (events) => {
                    const states = walk(events);

                    for (let at = 1; at < states.length; at++) {
                        const [before, after] = [states[at - 1], states[at]];

                        expect(RECORDER_STATES).toContain(after);

                        if (after === 'recording' && before !== 'recording') {
                            expect(['asking', 'paused']).toContain(before);
                        }

                        if (after === 'sending' && before !== 'sending') {
                            expect(before).toBe('review');
                        }

                        if (after === 'review' && before !== 'review') {
                            expect([
                                'recording',
                                'paused',
                                'sending',
                            ]).toContain(before);
                        }
                    }
                },
            ),
        );
    });
});

describe('recording formats and length', () => {
    it('tries Opus in WebM, then MP4, then Opus in Ogg', () => {
        expect(DEFAULT_RECORD_TYPES).toEqual([
            'audio/webm;codecs=opus',
            'audio/mp4',
            'audio/ogg;codecs=opus',
        ]);
        // Safari records MP4 only.
        expect(
            pickMimeType(DEFAULT_RECORD_TYPES, (type) => type === 'audio/mp4'),
        ).toBe('audio/mp4');
    });

    it('records 300 seconds by default, from 1 to 3600', () => {
        expect(recordSeconds(undefined)).toBe(300);
        expect(recordSeconds(Number.NaN)).toBe(300);
        expect(recordSeconds(0)).toBe(1);
        expect(recordSeconds(90)).toBe(90);
        expect(recordSeconds(10_000)).toBe(3600);
    });
});
