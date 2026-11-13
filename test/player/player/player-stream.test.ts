/**
 * `decode.stream` on the player: off by default; on, the wave's peaks are read in pieces as the sound
 * downloads, drawn while they come unless asked not to, and a sound that cannot be read so is decoded
 * whole. Its ceilings are refused past their ends, and the tag's attributes only lower them.
 */

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { createPlayer, type Player } from '../../../src/player';
import { optionsOf } from '../../../src/player/element/element-attributes';
import { triggerResize, triggerVisible } from '../../support/fakes';
import { bytes, frame, MP3_HEADER } from '../../support/sound-files';
import {
    serve,
    stubWebCodecs,
    stubWholeDecoder,
} from '../../support/stream-audio';
import { cleanUp, container, host } from './player-harness';

let player: Player | null = null;

afterEach(() => {
    player?.destroy();
    player = null;
    cleanUp();
});

/** An MP3 of six frames whose byte 4 says their level. */
const SOUND = bytes(
    ...[10, 20, 30, 40, 50, 60].map((level) => {
        const one = frame(MP3_HEADER, 417);
        one[4] = level;

        return one;
    }),
);

/**
 * Makes a player for `a.mp3`, lets `before` look at it, shows its wave and waits for its peaks.
 */
async function peaksOf(
    options: object,
    before: (made: Player) => void = () => undefined,
): Promise<readonly number[]> {
    player = createPlayer({ container: container(), src: 'a.mp3', ...options });
    before(player);
    const canvas = (host as HTMLElement).querySelector(
        'canvas',
    ) as HTMLCanvasElement;
    triggerResize(canvas, { width: 200, height: 40 });
    triggerVisible(canvas, true);
    const wave = player.frame;
    await vi.waitFor(() => expect(wave.peaks).not.toBeNull(), {
        timeout: 3_000,
        interval: 10,
    });

    return wave.peaks ?? [];
}

describe('decode.stream on the player', () => {
    it('is off by default: the sound is decoded whole', async () => {
        serve(SOUND);
        const decoder = stubWebCodecs();
        stubWholeDecoder({ samples: 50, at: 4 });

        expect(await peaksOf({})).toHaveLength(1000);
        expect(decoder.configs).toEqual([]);
    });

    it('reads the peaks in pieces with WebCodecs when on', async () => {
        serve(SOUND);
        const decoder = stubWebCodecs();
        const peaks = await peaksOf({
            decode: { stream: true, peakCount: 100 },
        });

        expect(peaks).toHaveLength(100);
        expect(Math.max(...peaks)).toBe(1);
        expect(peaks[0]).toBeLessThan(peaks[99]);
        expect(decoder.configs).toHaveLength(1);
    });

    it('decodes a sound it cannot read in pieces whole, downloading it again', async () => {
        const served = serve(bytes(Array.from({ length: 100 }, () => 0x41)));
        stubWebCodecs();
        stubWholeDecoder({ samples: 50, at: 4 });

        expect(await peaksOf({ decode: { stream: true } })).toHaveLength(1000);
        expect(served.requests).toHaveLength(2);
    });

    it('draws the peaks while they come, unless asked not to', async () => {
        for (const progressive of [true, false]) {
            serve(SOUND);
            stubWebCodecs();
            let previews = 0;
            await peaksOf({ decode: { stream: { progressive } } }, (made) => {
                const show = made.frame.previewPeaks.bind(made.frame);
                made.frame.previewPeaks = (peaks): void => {
                    previews++;
                    show(peaks);
                };
            });

            expect(previews > 0).toBe(progressive);

            player?.destroy();
            player = null;
            cleanUp();
        }
    });

    it('shows previewed peaks at once, and still takes the loader’s own when they come', async () => {
        let give: (peaks: number[]) => void = () => undefined;
        player = createPlayer({
            container: container(),
            src: 'a.mp3',
            peaks: () => new Promise<number[]>((resolve) => (give = resolve)),
        });
        const canvas = (host as HTMLElement).querySelector(
            'canvas',
        ) as HTMLCanvasElement;
        triggerResize(canvas, { width: 200, height: 40 });
        triggerVisible(canvas, true);
        const wave = player.frame;
        wave.previewPeaks([0.25, 1]);

        expect(wave.peaks).toEqual([0.25, 1]);

        give([1, 1, 1]);
        await vi.waitFor(() => expect(wave.peaks).toEqual([1, 1, 1]), {
            timeout: 3_000,
            interval: 10,
        });
    });

    it('refuses a ceiling past its ends when the player is made', () => {
        expect(() =>
            createPlayer({
                container: container(),
                src: 'a.mp3',
                decode: { stream: { maxBytes: 5_000_000_000 } },
            }),
        ).toThrow(/decode\.stream\.maxBytes goes past its most, 4294967296/);
        expect(() =>
            createPlayer({
                container: container(),
                src: 'a.mp3',
                decode: { stream: { maxSeconds: 0 } },
            }),
        ).toThrow(/decode\.stream\.maxSeconds goes under its least/);
    });
});

describe('the decode-stream attributes', () => {
    /** The decode options a tag with these attributes gives. */
    function decodeOf(attributes: Record<string, string>): unknown {
        const element = document.createElement('div');

        for (const [name, value] of Object.entries(attributes)) {
            element.setAttribute(name, value);
        }

        return optionsOf(element).decode;
    }

    it('turns reading in pieces on when present, and off with false', () => {
        expect(decodeOf({})).toBeUndefined();
        expect(decodeOf({ 'decode-stream': 'false' })).toBeUndefined();
        expect(decodeOf({ 'decode-stream': '' })).toEqual({
            stream: { maxBytes: undefined, maxSeconds: undefined },
        });
    });

    it('lets the ceilings be lowered, never raised', () => {
        expect(
            decodeOf({
                'decode-stream': '',
                'decode-stream-max-bytes': '1000',
                'decode-stream-max-seconds': '99999999',
            }),
        ).toEqual({ stream: { maxBytes: 1000, maxSeconds: 36_000 } });
    });
});
