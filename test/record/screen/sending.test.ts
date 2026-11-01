/**
 * Sending from the recorder's screen: the app's `onSend` is given a signal and a way to tell how far
 * it got, a send can be canceled when the app allows it, `upload` sends to the app's own address
 * without an `onSend`, and taking the screen off the page stops a send under way.
 */

import { describe, expect, it, vi } from 'vite-plus/test';
import type { RecorderScreen, UploadResponse } from '../../../src/record';
import { FakeRequest, stubRequests } from '../../support/upload';
import {
    button,
    press,
    said,
    screen,
    useRecordingPage,
} from './screen-harness';

useRecordingPage();

/** What the line under the parts shows. */
function status(made: RecorderScreen): string {
    return (
        made.element.querySelector('.sonicframe-recorder-status')
            ?.textContent ?? ''
    );
}

/**
 * A screen whose `onSend` waits: each send's signal, its progress and its end are kept, in order, to
 * drive by hand; `tell` and `finish` drive the first send unless told another.
 */
function waiting(cancelSend = false): {
    made: RecorderScreen;
    signals: AbortSignal[];
    tell: (fraction: number, send?: number) => void;
    finish: (error?: Error, send?: number) => void;
} {
    const signals: AbortSignal[] = [];
    const tells: ((fraction: number) => void)[] = [];
    const ends: ((error?: Error) => void)[] = [];
    const { made } = screen({
        cancelSend,
        onSend: (_recording, control) =>
            new Promise<void>((resolve, reject) => {
                signals.push(control.signal);
                tells.push(control.progress);
                ends.push((error) => (error ? reject(error) : resolve()));
            }),
    });

    return {
        made,
        signals,
        tell: (fraction, send = 0) => tells[send](fraction),
        finish: (error, send = 0) => ends[send](error),
    };
}

describe('sending from the screen', () => {
    it("shows how far the app's send got, and tells the page, until it ends", async () => {
        const { made, tell, finish } = waiting();
        const heard: number[] = [];
        made.on('progress', (fraction) => heard.push(fraction));
        await press(made, 'record');
        await press(made, 'stop');
        await press(made, 'send');
        tell(0.4);

        expect(status(made)).toBe('Sending, 40%');
        tell(Number.NaN);
        expect(status(made)).toBe('Sending, 40%');
        tell(7);
        expect(status(made)).toBe('Sending, 100%');

        finish();
        await vi.advanceTimersByTimeAsync(0);
        tell(0.5);
        expect(status(made)).toBe('');
        expect(heard).toEqual([0.4, 1]);
    });

    it('keeps the send button busy while sending, unless the app lets a send be canceled', async () => {
        const plain = waiting();
        await press(plain.made, 'record');
        await press(plain.made, 'stop');
        await press(plain.made, 'send');

        expect(button(plain.made, 'send')?.getAttribute('aria-label')).toBe(
            'Send the recording',
        );
        expect(button(plain.made, 'send')?.getAttribute('aria-disabled')).toBe(
            'true',
        );
        await press(plain.made, 'send');
        expect(plain.signals[0].aborted).toBe(false);
    });

    it('cancels a send back to review when allowed, and forgets how it ends', async () => {
        const { made, signals, finish } = waiting(true);
        const errors: unknown[] = [];
        made.on('error', (error) => errors.push(error));
        button(made, 'record')?.focus();
        await press(made, 'record');
        await press(made, 'stop');
        await press(made, 'send');

        expect(button(made, 'send')?.getAttribute('aria-label')).toBe(
            'Cancel sending',
        );
        expect(button(made, 'send')?.getAttribute('aria-disabled')).toBe(
            'false',
        );
        await press(made, 'send');

        expect(signals[0].aborted).toBe(true);
        expect(made.state).toBe('review');
        expect(said()).toBe('Sending canceled');
        expect(button(made, 'send')?.getAttribute('aria-label')).toBe(
            'Send the recording',
        );
        expect(document.activeElement).toBe(button(made, 'send'));

        finish(new DOMException('aborted', 'AbortError'));
        await press(made, 'discard');
        expect(said()).toBe('Recording deleted');
        expect(errors).toEqual([]);
    });

    it('lets a canceled send end as it will, without touching the next one', async () => {
        const { made, finish, tell } = waiting(true);
        await press(made, 'record');
        await press(made, 'stop');
        await press(made, 'send');
        const sent: unknown[] = [];
        made.on('sent', (recording) => sent.push(recording));
        made.cancelSend();
        finish();
        await vi.advanceTimersByTimeAsync(0);
        expect(made.state).toBe('review');
        expect(said()).toBe('Sending canceled');
        expect(sent).toEqual([]);

        // Canceled again, its late failure and progress leave the send after it alone.
        await press(made, 'send');
        made.cancelSend();
        await press(made, 'send');
        tell(0.3, 1);
        finish(new Error('late'), 1);
        await vi.advanceTimersByTimeAsync(0);
        expect(made.state).toBe('sending');
        expect(status(made)).toBe('Sending');

        tell(0.6, 2);
        expect(status(made)).toBe('Sending, 60%');
    });

    it('stops a send under way when taken off the page', async () => {
        const { made, signals } = waiting();
        await press(made, 'record');
        await press(made, 'stop');
        await press(made, 'send');
        made.destroy();

        expect(signals[0].aborted).toBe(true);
    });

    it("sends to the app's address with upload, and tells the page the server's answer", async () => {
        stubRequests();
        const answers: UploadResponse[] = [];
        const { made } = screen({ upload: { url: '/voice' } });
        made.on('uploaded', (answer) => answers.push(answer));
        await press(made, 'record');
        await press(made, 'stop');
        await press(made, 'send');

        expect(FakeRequest.made).toHaveLength(1);
        expect(FakeRequest.made[0].url).toBe('/voice');
        FakeRequest.made[0].progress(1, 2);
        expect(status(made)).toBe('Sending, 50%');
        FakeRequest.made[0].answer(201, 'ok');
        await vi.advanceTimersByTimeAsync(0);

        expect(answers).toEqual([{ status: 201, body: 'ok' }]);
        expect(made.state).toBe('idle');
        expect(said()).toBe('Recording sent');
    });

    it('keeps the recording to send again when the upload fails', async () => {
        stubRequests();
        const { made } = screen({ upload: { url: '/voice' } });
        made.on('error', () => undefined);
        await press(made, 'record');
        await press(made, 'stop');
        await press(made, 'send');
        FakeRequest.made[0].answer(500);
        await vi.advanceTimersByTimeAsync(0);

        expect(made.state).toBe('review');
        expect(said()).toBe('The recording could not be sent. Try again.');
        FakeRequest.made[0].progress(1, 2);
        expect(status(made)).toBe(
            'The recording could not be sent. Try again.',
        );
    });
});
