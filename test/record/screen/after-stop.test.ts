/**
 * What the screen does when a recording stops (`afterStop`), and how the app draws it: a screen with
 * only a record button, the app's own icons, how the parts line up beside the player of the
 * recording, and the look of that player alone.
 */

import { describe, expect, it, vi } from 'vite-plus/test';
import type { Recording, RecorderScreen } from '../../../src/record';
import {
    addresses,
    button,
    parts,
    press,
    said,
    screen,
    useRecordingPage,
} from './screen-harness';

useRecordingPage();

/** The path drawn in the screen's button of `name`. */
function iconOf(made: RecorderScreen, name: string): string | null {
    return button(made, name)?.querySelector('path')?.getAttribute('d') ?? null;
}

describe('when a recording stops', () => {
    it('goes to review by default, and tells the app first', async () => {
        const recorded: Recording[] = [];
        const { made } = screen({
            onRecorded: (recording) => recorded.push(recording),
        });
        await press(made, 'record');
        await press(made, 'stop');

        expect(made.state).toBe('review');
        expect(recorded).toEqual([made.recording]);
    });

    it("hands it over and starts again with 'none': no player, no object address", async () => {
        const recorded: Recording[] = [];
        const heard: Recording[] = [];
        const { made } = screen({
            afterStop: 'none',
            onRecorded: (recording) => recorded.push(recording),
        });
        made.on('recorded', (recording) => heard.push(recording));
        button(made, 'record')?.focus();
        await press(made, 'record');
        await vi.advanceTimersByTimeAsync(2000);
        await press(made, 'stop');

        expect(made.state).toBe('idle');
        expect(made.recording).toBeNull();
        expect(made.player).toBeNull();
        expect(parts(made)).toEqual(['record']);
        expect(addresses.made).toEqual([]);
        expect(recorded).toHaveLength(1);
        expect(recorded[0].duration).toBeCloseTo(2, 2);
        expect(heard).toEqual(recorded);
        expect(said()).toBe('Recording stopped, 0:02');
        expect(document.activeElement).toBe(button(made, 'record'));
    });

    it("sends it right away with 'send'", async () => {
        const sent: Recording[] = [];
        const { made } = screen({
            afterStop: 'send',
            onSend: (recording) => {
                sent.push(recording);
            },
        });
        await press(made, 'record');
        await press(made, 'stop');

        expect(sent).toHaveLength(1);
        expect(made.state).toBe('idle');
        expect(said()).toBe('Recording sent');
        expect(addresses.revoked).toEqual(addresses.made);
    });

    it('keeps it in review when a send right away fails, to send again or delete', async () => {
        const { made } = screen({
            afterStop: 'send',
            onSend: () => Promise.reject(new Error('offline')),
        });
        made.on('error', () => undefined);
        await press(made, 'record');
        await press(made, 'stop');

        expect(made.state).toBe('review');
        expect(parts(made)).toEqual(['discard', 'player', 'send']);
        expect(said()).toBe('The recording could not be sent. Try again.');
    });

    it('takes an unknown choice for review', async () => {
        const { made } = screen({
            afterStop: 'later' as unknown as 'none',
        });
        await press(made, 'record');
        await press(made, 'stop');

        expect(made.state).toBe('review');
    });

    it('can be only a record button that turns into stop', async () => {
        const recorded: Recording[] = [];
        const { made } = screen({
            parts: { recording: ['stop'] },
            afterStop: 'none',
            onRecorded: (recording) => recorded.push(recording),
        });

        expect(parts(made)).toEqual(['record']);
        await press(made, 'record');
        expect(parts(made)).toEqual(['stop']);
        await press(made, 'stop');
        expect(parts(made)).toEqual(['record']);
        expect(recorded).toHaveLength(1);
    });
});

describe("the app's drawing", () => {
    it('draws its own icons, the resume one while paused, and the default for path data it refuses', async () => {
        const { made } = screen({
            icons: {
                record: 'M1 1h22v22H1z',
                pause: 'M2 2h4v20H2z',
                resume: 'M3 3l18 9-18 9z',
                stop: 'url(#evil)',
            },
        });

        expect(iconOf(made, 'record')).toBe('M1 1h22v22H1z');
        await press(made, 'record');
        expect(iconOf(made, 'pause')).toBe('M2 2h4v20H2z');
        expect(iconOf(made, 'stop')).toBe('M7 7h10v10H7z');
        await press(made, 'pause');
        expect(iconOf(made, 'pause')).toBe('M3 3l18 9-18 9z');
    });

    it("lays out the player of the recording by its own look, over the screen's", async () => {
        const { made } = screen({
            look: { line: ['play', 'wave'], meta: ['time'] },
            reviewLook: { underStart: 'wave' },
        });
        await press(made, 'record');
        await press(made, 'stop');
        const row =
            made.player?.element.querySelector(
                '.sonicframe-time',
            )?.parentElement;

        expect(row?.style.getPropertyValue('grid-column')).toBe('');
    });
});
