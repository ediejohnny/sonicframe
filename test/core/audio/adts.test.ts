import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';
import { adtsHeader, createAdtsReader } from '../../../src/core/audio/adts';
import {
    adtsHeader as header,
    bytes,
    expectSafeOnAnyBytes,
    frame,
    inPieces,
} from '../../support/sound-files';

describe('adtsHeader', () => {
    it('reads the length, profile, rate, channels and blocks', () => {
        expect(adtsHeader(Uint8Array.from(header(300)), 0)).toEqual({
            length: 300,
            samples: 1024,
            sampleRate: 44100,
            channels: 2,
            stream: 20,
            codec: 'mp4a.40.2',
        });

        const twoBlocks = header(300);
        twoBlocks[6] = 0xfd;
        const withChecksum = header(300);
        withChecksum[1] = 0xf0;

        expect(adtsHeader(Uint8Array.from(twoBlocks), 0)?.samples).toBe(2048);
        expect(adtsHeader(Uint8Array.from(withChecksum), 0)?.length).toBe(300);
        expect(adtsHeader(Uint8Array.from(header(3000)), 0)?.length).toBe(3000);
    });

    it('refuses a layer, rate, layout or length it cannot read', () => {
        const layer = header(300);
        layer[1] = 0xf3;
        const rate = header(300);
        rate[2] = 0x7c;
        const layout = header(300);
        layout[3] &= 0x3f;
        // With a checksum the header takes 9 bytes, so 8 cannot be a frame.
        const shortChecked = header(8);
        shortChecked[1] = 0xf0;

        for (const bad of [
            layer,
            rate,
            layout,
            shortChecked,
            header(7),
            header(300).slice(0, 6),
        ]) {
            expect(adtsHeader(Uint8Array.from(bad), 0)).toBeNull();
        }
    });
});

describe('createAdtsReader', () => {
    it('gives each frame whole, header included, however the bytes are cut', () => {
        const file = bytes(
            frame(header(300), 300),
            frame(header(200), 200),
            frame(header(250), 250),
        );

        fc.assert(
            fc.property(
                fc.array(fc.integer({ min: 1, max: 400 }), { maxLength: 8 }),
                (cuts) => {
                    const reader = createAdtsReader();
                    const frames = inPieces(file, cuts, (piece) =>
                        reader.push(piece),
                    ).flat();

                    expect(frames.map((one) => one.data.length)).toEqual([
                        300, 200, 250,
                    ]);
                    expect(frames[1].data.subarray(0, 7)).toEqual(
                        Uint8Array.from(header(200)),
                    );
                    expect(reader.format).toEqual({
                        codec: 'mp4a.40.2',
                        sampleRate: 44100,
                        channels: 2,
                    });
                },
            ),
        );
    });

    it('never runs away on any bytes, and throws only TypeError', () => {
        expectSafeOnAnyBytes(createAdtsReader, adtsHeader);
    });
});
