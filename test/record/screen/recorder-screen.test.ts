/**
 * The recorder's ready-made screen: a record button until pressed; while recording, the time, a live
 * wave hidden from screen readers and the buttons to pause, stop and drop it; then a player to hear
 * the recording before sending it. Each change is said through the live region, the focus follows the
 * main button, and a refused microphone says why.
 */

import { describe, expect, it, vi } from 'vite-plus/test';
import type { Recording } from '../../../src/record';
import { SonicFrame } from '../../../src/index';
import { PALETTES } from '../../../src/player';
import { FakeAnalyser } from '../../support/recording';
import {
    addresses,
    button,
    liveWaveFeed,
    parts,
    press,
    said,
    screen,
    useRecordingPage,
} from './screen-harness';

useRecordingPage();

describe('the recorder screen', () => {
    it('shows a named record button in a named group, asking nothing yet', () => {
        const { made, microphone } = screen();

        expect(made.element.getAttribute('role')).toBe('group');
        expect(made.element.getAttribute('aria-label')).toBe('Voice recorder');
        expect(parts(made)).toEqual(['record']);
        expect(
            made.element.querySelector<HTMLElement>(
                '.sonicframe-recorder-status',
            )?.hidden,
        ).toBe(true);
        expect(button(made, 'record')?.getAttribute('aria-label')).toBe(
            'Record',
        );
        expect(microphone.asked).toEqual([]);
        expect(made.state).toBe('idle');
    });

    it('records on a press: the time, the live wave and the buttons, the focus on stop', async () => {
        const { made } = screen();
        button(made, 'record')?.focus();
        await press(made, 'record');

        expect(made.state).toBe('recording');
        expect(parts(made)).toEqual([
            'discard',
            'time',
            'wave',
            'pause',
            'stop',
        ]);
        expect(said()).toBe('Recording');
        expect(document.activeElement).toBe(button(made, 'stop'));

        const wave = made.element.querySelector('.sonicframe-recorder-wave');
        expect(wave?.getAttribute('aria-hidden')).toBe('true');
        expect(wave?.querySelector('canvas')).not.toBeNull();
    });

    it('shows the time recorded', async () => {
        const { made } = screen();
        await press(made, 'record');
        const time = (): string | null | undefined =>
            made.element.querySelector('.sonicframe-recorder-time')
                ?.textContent;

        expect(time()).toBe('0:00');
        vi.advanceTimersByTime(1500);
        expect(time()).toBe('0:01');
    });

    it('feeds the live wave the last seconds, or the whole recording when it fits', async () => {
        const fed = liveWaveFeed();
        FakeAnalyser.level = 0.25;

        const scrolling = screen({ rate: 10, window: 2 });
        await press(scrolling.made, 'record');
        vi.advanceTimersByTime(500);
        const last = fed.at(-1) ?? [];
        // 2 seconds of 10 slices: 15 silent, then the 5 heard.
        expect(last.length).toBe(20);
        expect(last.slice(0, 15).every((level) => level === 0)).toBe(true);
        expect(last.slice(15)).toEqual([0.25, 0.25, 0.25, 0.25, 0.25]);

        const fitting = screen({ rate: 10, live: 'fit' });
        await press(fitting.made, 'record');
        vi.advanceTimersByTime(500);
        expect(fed.at(-1)).toEqual([0.25, 0.25, 0.25, 0.25, 0.25]);

        // By default, 10 seconds of 20 slices.
        const usual = screen();
        await press(usual.made, 'record');
        vi.advanceTimersByTime(100);
        expect(fed.at(-1)?.length).toBe(200);
    });

    it('pauses and resumes, renaming its button and saying so', async () => {
        const { made } = screen();
        await press(made, 'record');
        await press(made, 'pause');

        expect(made.state).toBe('paused');
        expect(made.recorder.state).toBe('paused');
        expect(button(made, 'pause')?.getAttribute('aria-label')).toBe(
            'Resume recording',
        );
        expect(said()).toBe('Recording paused');

        // A second paused: the time does not count it.
        vi.advanceTimersByTime(1000);
        await press(made, 'pause');
        expect(made.state).toBe('recording');
        expect(button(made, 'pause')?.getAttribute('aria-label')).toBe(
            'Pause recording',
        );
        expect(said()).toBe('Recording');

        // The time goes on after the pause.
        vi.advanceTimersByTime(1500);
        expect(
            made.element.querySelector('.sonicframe-recorder-time')
                ?.textContent,
        ).toBe('0:01');
    });

    it('stops into review: a player of the recording, then delete and send', async () => {
        const { made, microphone } = screen();
        const recorded: Recording[] = [];
        made.on('recorded', (recording) => recorded.push(recording));
        await press(made, 'record');
        vi.advanceTimersByTime(2000);
        button(made, 'stop')?.focus();
        const freed = vi.spyOn(SonicFrame.prototype, 'destroy');
        await press(made, 'stop');

        // The live wave's frame is let go.
        expect(freed).toHaveBeenCalled();

        expect(made.state).toBe('review');
        expect(parts(made)).toEqual(['discard', 'player', 'send']);
        expect(said()).toBe('Recording stopped, 0:02');
        expect(recorded).toEqual([made.recording]);
        expect(microphone.streams[0].track.stopped).toBe(true);

        const player = made.player;
        expect(player?.element.getAttribute('aria-label')).toBe(
            'Your recording',
        );
        expect(player?.media?.getAttribute('src')).toBe('blob:recording-1');
        expect(player?.frame.duration).toBeCloseTo(2, 2);
        expect(document.activeElement).toBe(button(made, 'send'));
    });

    it('sends: busy while the app sends, then back to the start', async () => {
        let finish = (): void => undefined;
        const sent: Recording[] = [];
        const { made } = screen({
            onSend: (recording) =>
                new Promise<void>((resolve) => {
                    sent.push(recording);
                    finish = resolve;
                }),
        });
        const heard: string[] = [];
        made.on('send', () => heard.push('send'));
        made.on('sent', () => heard.push('sent'));
        await press(made, 'record');
        await press(made, 'stop');
        const recording = made.recording;
        const player = made.player;
        await press(made, 'send');

        expect(made.state).toBe('sending');
        expect(sent).toEqual([recording]);
        expect(heard).toEqual(['send']);
        expect(made.player).toBe(player);
        expect(button(made, 'send')?.getAttribute('aria-disabled')).toBe(
            'true',
        );
        expect(
            made.element.querySelector('.sonicframe-recorder-status')
                ?.textContent,
        ).toBe('Sending');

        finish();
        await vi.advanceTimersByTimeAsync(0);

        expect(made.state).toBe('idle');
        expect(made.recording).toBeNull();
        expect(made.player).toBeNull();
        expect(said()).toBe('Recording sent');
        expect(addresses.revoked).toEqual(['blob:recording-1']);
        expect(heard).toEqual(['send', 'sent']);
    });

    it('says nothing more when destroyed while sending', async () => {
        let finish = (): void => undefined;
        const { made } = screen({
            onSend: () =>
                new Promise<void>((resolve) => {
                    finish = resolve;
                }),
        });
        const heard: string[] = [];
        await press(made, 'record');
        await press(made, 'stop');
        await press(made, 'send');
        made.on('sent', () => heard.push('sent'));
        made.destroy();
        finish();
        await vi.advanceTimersByTimeAsync(0);

        expect(heard).toEqual([]);
        expect(said()).toBe('Sending');
    });

    it('keeps the recording after sending when asked', async () => {
        const { made } = screen({ onSend: () => undefined, afterSend: 'keep' });
        await press(made, 'record');
        await press(made, 'stop');
        await press(made, 'send');

        expect(made.state).toBe('review');
        expect(made.recording).not.toBeNull();
        expect(said()).toBe('Recording sent');
        expect(addresses.revoked).toEqual([]);
    });

    it('says a failed send, and lets it be sent again', async () => {
        let attempts = 0;
        const errors: unknown[] = [];
        const { made } = screen({
            onSend: () => {
                attempts++;

                return attempts === 1
                    ? Promise.reject(new Error('offline'))
                    : Promise.resolve();
            },
        });
        made.on('error', (error) => errors.push(error));
        await press(made, 'record');
        await press(made, 'stop');
        await press(made, 'send');

        expect(made.state).toBe('review');
        expect(said()).toBe('The recording could not be sent. Try again.');
        expect(
            made.element.querySelector('.sonicframe-recorder-status')
                ?.textContent,
        ).toBe('The recording could not be sent. Try again.');
        expect(errors).toEqual([new Error('offline')]);

        await press(made, 'send');
        expect(made.state).toBe('idle');
        expect(
            made.element.querySelector<HTMLElement>(
                '.sonicframe-recorder-status',
            )?.hidden,
        ).toBe(true);
    });

    it('drops a recording in review or under way, and says so', async () => {
        const { made, microphone } = screen();
        await press(made, 'record');
        await press(made, 'stop');
        const player = made.player;
        await press(made, 'discard');

        expect(made.state).toBe('idle');
        expect(made.player).toBeNull();
        // Its player is destroyed, so its sound stops.
        expect(player?.media?.hasAttribute('src')).toBe(false);
        expect(said()).toBe('Recording deleted');
        expect(addresses.revoked).toEqual(['blob:recording-1']);

        await press(made, 'record');
        await press(made, 'discard');
        expect(made.state).toBe('idle');
        expect(microphone.streams[1].track.stopped).toBe(true);
        expect(made.recording).toBeNull();
    });

    it('says why it cannot record, and asks again on the next press', async () => {
        const { made, microphone } = screen(
            {},
            new DOMException('no', 'NotAllowedError'),
        );
        await press(made, 'record');

        const text = 'The microphone is blocked. Allow it in the address bar.';
        expect(made.state).toBe('denied');
        expect(said()).toBe(text);
        expect(
            made.element.querySelector('.sonicframe-recorder-status')
                ?.textContent,
        ).toBe(text);

        await press(made, 'record');
        expect(microphone.asked.length).toBe(2);
    });

    it('goes to review on its own at the limit, saying so', async () => {
        const { made } = screen({ maxSeconds: 3 });
        await press(made, 'record');
        await vi.advanceTimersByTimeAsync(3100);

        expect(made.state).toBe('review');
        expect(said()).toBe('Time limit reached. Recording stopped, 0:03');

        // The next recording, stopped by hand, says nothing of a limit.
        await press(made, 'discard');
        await press(made, 'record');
        await vi.advanceTimersByTimeAsync(1000);
        await press(made, 'stop');
        expect(said()).toBe('Recording stopped, 0:01');
    });

    it('shows the parts each state is given', async () => {
        const { made } = screen({
            parts: { recording: ['stop', 'time'], review: ['player', 'send'] },
        });
        await press(made, 'record');
        expect(parts(made)).toEqual(['stop', 'time']);

        await press(made, 'stop');
        expect(parts(made)).toEqual(['player', 'send']);
    });

    it('records while the record button is held, when asked; a click still records', async () => {
        const { made } = screen({ hold: true });
        const record = button(made, 'record') as HTMLButtonElement;
        record.dispatchEvent(
            new PointerEvent('pointerdown', { bubbles: true }),
        );
        await vi.advanceTimersByTimeAsync(1000);
        expect(made.state).toBe('recording');

        document.dispatchEvent(
            new PointerEvent('pointerup', { bubbles: true }),
        );
        await vi.advanceTimersByTimeAsync(0);
        expect(made.state).toBe('review');

        const tapped = screen({ hold: true });
        const again = button(tapped.made, 'record') as HTMLButtonElement;
        again.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        await vi.advanceTimersByTimeAsync(100);
        document.dispatchEvent(
            new PointerEvent('pointerup', { bubbles: true }),
        );
        again.click();
        await vi.advanceTimersByTimeAsync(0);
        expect(tapped.made.state).toBe('recording');
    });

    it('says the time every few seconds only when asked', async () => {
        const quiet = screen();
        await press(quiet.made, 'record');
        await vi.advanceTimersByTimeAsync(6000);
        expect(said()).toBe('Recording');
        quiet.made.discard();

        const { made } = screen({ a11y: { announceEvery: 5 } });
        await press(made, 'record');
        await vi.advanceTimersByTimeAsync(5100);
        expect(said()).toBe('0:05 recorded');

        // A new recording says its own time from its start.
        await press(made, 'discard');
        await press(made, 'record');
        await vi.advanceTimersByTimeAsync(5100);
        expect(said()).toBe('0:05 recorded');
    });

    it('takes the app’s words from a11y.words, over the old a11y.labels', async () => {
        const { made } = screen({
            a11y: { labels: { record: 'Old' }, words: { record: 'Talk' } },
        });

        expect(button(made, 'record')?.getAttribute('aria-label')).toBe('Talk');
    });

    it('speaks the language asked for, with the app’s own words over it', async () => {
        const { made } = screen({
            a11y: { lang: 'pt', labels: { send: 'Mandar' } },
        });

        expect(made.element.getAttribute('aria-label')).toBe('Gravador de voz');
        expect(made.element.getAttribute('lang')).toBe('pt');
        expect(button(made, 'record')?.getAttribute('aria-label')).toBe(
            'Gravar',
        );

        await press(made, 'record');
        await press(made, 'stop');
        expect(button(made, 'send')?.getAttribute('aria-label')).toBe('Mandar');
        expect(made.player?.element.getAttribute('aria-label')).toBe(
            'Sua gravação',
        );
        // The player speaks the screen's language.
        expect(
            made.player?.element
                .querySelector('.sonicframe-play')
                ?.getAttribute('aria-label'),
        ).toBe('Reproduzir');
    });

    it('wears its palette, and so does the player of the recording', async () => {
        const { made } = screen({ palette: 'ocean' });
        const surface = (element: HTMLElement | undefined): string =>
            element?.style.getPropertyValue('--sonicframe-surface') ?? '';

        expect(surface(made.element)).toBe(PALETTES.ocean.surface);

        await press(made, 'record');
        await press(made, 'stop');
        expect(surface(made.player?.element)).toBe(PALETTES.ocean.surface);
    });

    it('leaves the focus where it is when the page, not a person, starts it', async () => {
        const { made } = screen();
        const outside = document.createElement('button');
        document.body.append(outside);
        outside.focus();
        await made.start();

        expect(made.state).toBe('recording');
        expect(document.activeElement).toBe(outside);
        outside.remove();
    });

    it('lets everything go when destroyed', async () => {
        const { made, microphone } = screen();
        await press(made, 'record');
        await press(made, 'stop');
        made.destroy();

        expect(made.element.isConnected).toBe(false);
        expect(addresses.revoked).toEqual(['blob:recording-1']);
        expect(microphone.streams[0].track.stopped).toBe(true);

        // Destroyed while recording, it lets the microphone go too.
        const busy = screen();
        await press(busy.made, 'record');
        busy.made.destroy();
        expect(busy.microphone.streams[0].track.stopped).toBe(true);
    });

    it('speaks the page’s language with auto', () => {
        document.documentElement.setAttribute('lang', 'fr');
        const { made } = screen({ a11y: { lang: 'auto' } });
        document.documentElement.removeAttribute('lang');

        expect(button(made, 'record')?.getAttribute('aria-label')).toBe(
            'Enregistrer',
        );
    });
});
