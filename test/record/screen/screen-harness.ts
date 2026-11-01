/**
 * The recorder screen's tests share a page with a microphone, a recorder and an audio context of
 * stand-ins, a clock they move by hand, object addresses they can count, and what the page's live
 * region says.
 */

import { afterEach, beforeEach, vi } from 'vite-plus/test';
import {
    createRecorder,
    type RecorderScreen,
    type RecorderScreenOptions,
} from '../../../src/record';
import { SonicFrame } from '../../../src/index';
import { afterTest, pageHost } from '../../support/helpers';
import { stubMicrophone, stubRecording } from '../../support/recording';

/** The object addresses made and taken back during the test. */
export const addresses: { made: string[]; revoked: string[] } = {
    made: [],
    revoked: [],
};

/** Installs the stand-ins and a hand-moved clock for every test of the file. */
export function useRecordingPage(): void {
    beforeEach(() => {
        vi.useFakeTimers({
            toFake: [
                'setTimeout',
                'clearTimeout',
                'requestAnimationFrame',
                'cancelAnimationFrame',
                'performance',
            ],
        });
        stubRecording();
        addresses.made = [];
        addresses.revoked = [];
        vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
            const address = `blob:recording-${addresses.made.length + 1}`;
            addresses.made.push(address);

            return address;
        });
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation((address) => {
            addresses.revoked.push(address);
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        document.querySelector('[role="status"]')?.replaceChildren();
    });
}

/** A recorder screen of `options` on the page (no decoding unless asked), with a microphone that answers. */
export function screen(
    options: Partial<RecorderScreenOptions> = {},
    answer: Parameters<typeof stubMicrophone>[0] = 'grant',
): { made: RecorderScreen; microphone: ReturnType<typeof stubMicrophone> } {
    const microphone = stubMicrophone(answer);
    const container = pageHost({ left: 0, top: 0, width: 400, height: 80 });
    const made = afterTest(
        createRecorder({ container, decode: false, ...options }),
    );

    return { made, microphone };
}

/** The button of `name` (`record`, `stop`…) in the screen, or null. */
export function button(
    made: RecorderScreen,
    name: string,
): HTMLButtonElement | null {
    return made.element.querySelector<HTMLButtonElement>(`.sonicframe-${name}`);
}

/** Presses the button of `name`, and lets what it started settle. */
export async function press(made: RecorderScreen, name: string): Promise<void> {
    const found = button(made, name);

    if (found === null) {
        throw new Error(`test: no ${name} button`);
    }

    found.click();
    await vi.advanceTimersByTimeAsync(0);
}

/** The parts the screen shows now, by their class name without the prefix. */
export function parts(made: RecorderScreen): string[] {
    const row = made.element.querySelector('.sonicframe-recorder-row');

    return [...(row?.children ?? [])].map(
        (part) =>
            part.className
                .replace(/^sonicframe-(recorder-)?/, '')
                .split(' ')[0],
    );
}

/** Every list of levels a live wave is given from now on, in order (the frame draws none). */
export function liveWaveFeed(): (readonly number[] | null)[] {
    const fed: (readonly number[] | null)[] = [];
    vi.spyOn(SonicFrame.prototype, 'setValues').mockImplementation((values) => {
        fed.push(values);
    });

    return fed;
}

/** What the page's live region says now. */
export function said(): string {
    return document.querySelector('[role="status"]')?.textContent ?? '';
}
