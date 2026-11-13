/**
 * "Use your own sound" on the docs site: a picked file never loads in silence. Each step is said
 * in the live text, a progress bar shows the share read and then the decoding, and the button
 * ignores presses until the file is in or refused.
 */

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { pickSound } from '../../playground/site';

afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
});

/** A decoder that answers only when `finish` is called: with a second of silence, or an error. */
function stubDecoder(): { finish: (ok: boolean) => void } {
    let settle: (ok: boolean) => void = () => undefined;
    vi.stubGlobal(
        'AudioContext',
        class {
            decodeAudioData(): Promise<unknown> {
                return new Promise((resolve, reject) => {
                    settle = (ok): void =>
                        ok
                            ? resolve({
                                  duration: 1,
                                  getChannelData: () => new Float32Array(100),
                              })
                            : reject(new Error('not audio'));
                });
            }
            close(): Promise<void> {
                return Promise.resolve();
            }
        },
    );

    return { finish: (ok): void => settle(ok) };
}

/** The picker on a page, with what it said, used and refused. */
function picker(): {
    button: HTMLButtonElement;
    choose: () => void;
    said: string[];
    used: unknown[];
    failed: unknown[];
} {
    const button = document.createElement('button');
    const input = document.createElement('input');
    input.type = 'file';
    document.body.append(button, input);
    const said: string[] = [];
    const used: unknown[] = [];
    const failed: unknown[] = [];
    pickSound(
        button,
        input,
        (sound) => used.push(sound),
        (error) => failed.push(error),
        (text) => said.push(text),
    );
    const choose = (): void => {
        Object.defineProperty(input, 'files', {
            configurable: true,
            value: [new File([new Uint8Array(64)], 'voice.mp3')],
        });
        input.dispatchEvent(new Event('change'));
    };

    return { button, choose, said, used, failed };
}

/** The progress bar after the button. */
function bar(): HTMLElement {
    return document.querySelector('[role="progressbar"]') as HTMLElement;
}

describe('a sound picked on the docs site', () => {
    it('says it is reading, then decoding, with a bar until the sound is in', async () => {
        const decoder = stubDecoder();
        const made = picker();
        made.choose();

        expect(made.said).toEqual(['Reading voice.mp3…']);
        expect(bar().closest('[hidden]')).toBeNull();
        expect(made.button.getAttribute('aria-disabled')).toBe('true');

        await vi.waitFor(() => expect(made.said).toHaveLength(2));

        expect(made.said[1]).toBe(
            'Decoding voice.mp3… A long sound can take a while.',
        );
        expect(bar().getAttribute('aria-valuetext')).toBe('Decoding');
        expect(bar().hasAttribute('aria-valuenow')).toBe(false);

        decoder.finish(true);
        await vi.waitFor(() => expect(made.used).toHaveLength(1));

        expect(bar().closest('[hidden]')).not.toBeNull();
        expect(made.button.hasAttribute('aria-disabled')).toBe(false);
    });

    it('gives the bar back and the button too when the file is not audio', async () => {
        const decoder = stubDecoder();
        const made = picker();
        made.choose();
        await vi.waitFor(() => expect(made.said).toHaveLength(2));
        decoder.finish(false);
        await vi.waitFor(() => expect(made.failed).toHaveLength(1));

        expect(made.used).toHaveLength(0);
        expect(bar().closest('[hidden]')).not.toBeNull();
        expect(made.button.hasAttribute('aria-disabled')).toBe(false);
    });

    it('ignores a second file while the first one loads', async () => {
        stubDecoder();
        const made = picker();
        made.choose();
        made.choose();
        await vi.waitFor(() => expect(made.said).toHaveLength(2));

        expect(
            made.said.filter((text) => text.startsWith('Reading')),
        ).toHaveLength(1);
    });
});
