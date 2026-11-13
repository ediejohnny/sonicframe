import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';
import { createMp3Reader, mp3Header } from '../../../src/core/audio/mp3';
import {
    ascii,
    bytes,
    expectSafeOnAnyBytes,
    frame,
    inPieces,
    mp3,
    MP3_HEADER,
    MP3_PADDED_HEADER,
    MP3_V2_HEADER,
} from '../../support/sound-files';

describe('mp3Header', () => {
    it('reads the length, samples, rate and channels of MPEG-1 and MPEG-2 frames', () => {
        expect(mp3Header(Uint8Array.from(MP3_HEADER), 0)).toMatchObject({
            length: 417,
            samples: 1152,
            sampleRate: 44100,
            channels: 2,
            codec: 'mp3',
        });
        expect(mp3Header(Uint8Array.from(MP3_PADDED_HEADER), 0)?.length).toBe(
            418,
        );
        expect(mp3Header(Uint8Array.from(MP3_V2_HEADER), 0)).toMatchObject({
            length: 208,
            samples: 576,
            sampleRate: 22050,
            channels: 1,
        });
    });

    it('refuses what is not a Layer III frame header', () => {
        const refused = [
            [0xfe, 0xfb, 0x90, 0x44], // no sync
            [0xff, 0xeb, 0x90, 0x44], // reserved version
            [0xff, 0xfd, 0x90, 0x44], // Layer II
            [0xff, 0xfb, 0x00, 0x44], // free format
            [0xff, 0xfb, 0xf0, 0x44], // bad bit rate
            [0xff, 0xfb, 0x9c, 0x44], // reserved sample rate
            [0xff, 0xfb, 0x90], // cut short
        ];

        for (const header of refused) {
            expect(mp3Header(Uint8Array.from(header), 0)).toBeNull();
        }
    });
});

describe('createMp3Reader', () => {
    it('gives each frame whole, however the bytes are cut', () => {
        fc.assert(
            fc.property(
                fc.array(fc.integer({ min: 1, max: 900 }), { maxLength: 12 }),
                (cuts) => {
                    const reader = createMp3Reader();
                    const frames = inPieces(mp3(5), cuts, (piece) =>
                        reader.push(piece),
                    ).flat();

                    expect(frames.map((one) => one.data.length)).toEqual([
                        417, 417, 417, 417, 417,
                    ]);
                    expect(frames.every((one) => one.samples === 1152)).toBe(
                        true,
                    );
                    expect(reader.format).toEqual({
                        codec: 'mp3',
                        sampleRate: 44100,
                        channels: 2,
                    });
                },
            ),
        );
    });

    it('finds the frames again after stray bytes, and not a header the next frame does not follow', () => {
        const reader = createMp3Reader();
        const frames = reader.push(
            bytes([0x01, 0x02], MP3_HEADER, mp3(2), [9, 9, 9], mp3(1)),
        );

        // The lone header at 2 claims 417 bytes, but 417 bytes on there is no frame.
        expect(frames).toEqual(
            Array.from({ length: 3 }, () => ({
                data: Uint8Array.from(frame(MP3_HEADER, 417)),
                samples: 1152,
            })),
        );
    });

    it('skips a frame of another stream in the middle', () => {
        const reader = createMp3Reader();
        const frames = reader.push(
            bytes(mp3(2), frame(MP3_V2_HEADER, 208), mp3(1)),
        );

        expect(frames.map((one) => one.data.length)).toEqual([417, 417, 417]);
    });

    it('takes the length from a Xing header and does not give that frame', () => {
        const first = frame(MP3_HEADER, 417);
        first.splice(36, 12, ...ascii('Xing'), 0, 0, 0, 1, 0, 0, 0x03, 0xe8);
        const reader = createMp3Reader();
        const frames = reader.push(bytes(first, mp3(2)));

        expect(reader.format?.totalSamples).toBe(1000 * 1152);
        expect(frames).toHaveLength(2);
    });

    it('reads an Info header too, and a VBRI one', () => {
        const info = frame(MP3_HEADER, 417);
        info.splice(36, 12, ...ascii('Info'), 0, 0, 0, 1, 0, 0, 0, 10);
        const infoReader = createMp3Reader();
        infoReader.push(bytes(info, mp3(2)));

        const vbri = frame(MP3_HEADER, 417);
        vbri.splice(
            36,
            18,
            ...ascii('VBRI'),
            0,
            1,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            20,
        );
        const vbriReader = createMp3Reader();
        vbriReader.push(bytes(vbri, mp3(2)));

        expect(infoReader.format?.totalSamples).toBe(10 * 1152);
        expect(vbriReader.format?.totalSamples).toBe(20 * 1152);
    });

    it('gives a Xing frame without a frame count, which holds no length', () => {
        const first = frame(MP3_HEADER, 417);
        first.splice(36, 8, ...ascii('Xing'), 0, 0, 0, 0);
        const reader = createMp3Reader();

        expect(reader.push(bytes(first, mp3(1)))).toHaveLength(2);
        expect(reader.format?.totalSamples).toBeUndefined();
    });

    it('says the bytes are not an MP3 when no frame starts in the first 64 KiB', () => {
        const reader = createMp3Reader();

        expect(() => reader.push(new Uint8Array(70_000))).toThrow(/not MP3/);
    });

    it('never runs away on any bytes: it ends, gives only whole frames, and throws only TypeError', () => {
        expectSafeOnAnyBytes(createMp3Reader, mp3Header);
    });
});
