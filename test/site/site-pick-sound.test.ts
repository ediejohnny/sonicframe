/**
 * "Use your own sound" on the docs site: a picked file never loads in silence. The largest file
 * taken is shown, a larger one is refused before it is read, each step is said in the live text, a
 * progress bar fills with the share of the file read (or shows the decoding of a format read
 * whole), and the button ignores presses until the file is in or refused.
 */

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { pickSound, sizeText } from '../../playground/site';
import { wav } from '../support/sound-files';

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

/** 64 bytes no reader knows: a format the page decodes whole. */
const UNKNOWN: Uint8Array<ArrayBuffer> = new Uint8Array(64);

/** The picker on a page, with what it said, used and refused. */
function picker(): {
    button: HTMLButtonElement;
    choose: (bytes?: Uint8Array<ArrayBuffer>, size?: number) => void;
    said: string[];
    used: { peaks: number[]; duration: number }[];
    failed: unknown[];
} {
    const button = document.createElement('button');
    const input = document.createElement('input');
    input.type = 'file';
    document.body.append(button, input);
    const said: string[] = [];
    const used: { peaks: number[]; duration: number }[] = [];
    const failed: unknown[] = [];
    pickSound(
        button,
        input,
        (sound) => used.push(sound),
        (error) => failed.push(error),
        (text) => said.push(text),
    );
    const choose = (bytes = UNKNOWN, size?: number): void => {
        const file = new File([bytes], 'voice.mp3');

        if (size !== undefined) {
            Object.defineProperty(file, 'size', { value: size });
        }

        Object.defineProperty(input, 'files', {
            configurable: true,
            value: [file],
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
    it('shows the largest file it takes', () => {
        picker();

        expect(document.querySelector('.file-limit')?.textContent).toBe(
            'Up to 4 GB.',
        );
    });

    it('writes sizes as people read them', () => {
        expect(
            [64, 62_200_000, 268_435_456, 2_040_109_466].map(sizeText),
        ).toEqual(['1 KB', '59.3 MB', '256 MB', '1.9 GB']);
    });

    it('reads a sound in pieces, the bar filling with the share read', async () => {
        vi.stubGlobal('AudioContext', undefined);
        const made = picker();
        made.choose(
            new Uint8Array(
                wav({
                    channels: 1,
                    bits: 8,
                    rate: 8000,
                    payload: [128, 192, 128, 0],
                }),
            ),
        );

        expect(made.said).toEqual(['Reading voice.mp3 (1 KB)…']);
        expect(bar().closest('[hidden]')).toBeNull();
        expect(made.button.getAttribute('aria-disabled')).toBe('true');

        await vi.waitFor(() => expect(made.used).toHaveLength(1));

        expect(made.used[0].duration).toBe(4 / 8000);
        expect(Math.max(...made.used[0].peaks)).toBe(1);
        expect(bar().getAttribute('aria-valuenow')).toBe('100');
        expect(bar().closest('[hidden]')).not.toBeNull();
        expect(made.button.hasAttribute('aria-disabled')).toBe(false);
    });

    it('decodes whole a format it cannot read in pieces, saying so, with a bar until the sound is in', async () => {
        const decoder = stubDecoder();
        const made = picker();
        made.choose();
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

    it('refuses a file past 4 GB before reading it', () => {
        stubDecoder();
        const made = picker();
        made.choose(UNKNOWN, 4_294_967_297);

        expect(made.said).toEqual([
            'voice.mp3 is 4 GB: the page reads files up to 4 GB.',
        ]);
        expect(bar().closest('[hidden]')).not.toBeNull();
        expect(made.button.hasAttribute('aria-disabled')).toBe(false);
    });

    it('refuses to decode whole a file past 256 MB, saying which formats go further', async () => {
        stubDecoder();
        const made = picker();
        made.choose(UNKNOWN, 300_000_000);
        await vi.waitFor(() => expect(made.said).toHaveLength(2));

        expect(made.said[1]).toBe(
            'voice.mp3 is 286.1 MB: in this format the page reads files up to 256 MB. MP3, AAC, WAV, M4A, MP4, Ogg, FLAC and WebM go up to 4 GB.',
        );
        expect(made.failed).toHaveLength(0);
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
