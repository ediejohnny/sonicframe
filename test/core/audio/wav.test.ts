import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';
import { createWavReader } from '../../../src/core/audio/wav';
import { ascii, inPieces, little, wav } from '../../support/sound-files';

/** Every sample the reader gives for `file`, pushed whole. */
function samplesOf(file: Uint8Array): number[] {
    return Array.from(createWavReader().push(file));
}

describe('createWavReader', () => {
    it('mixes 16-bit stereo to one channel', () => {
        const file = wav({
            channels: 2,
            bits: 16,
            payload: [
                ...little(16384, 2),
                ...little(0, 2),
                ...little(0x8000, 2),
                ...little(0x8000, 2),
            ],
        });

        expect(samplesOf(file)).toEqual([0.25, -1]);
    });

    it('reads 8-bit, 24-bit and 32-bit integers, and 32-bit and 64-bit floats', () => {
        expect(
            samplesOf(wav({ channels: 1, bits: 8, payload: [0, 128, 192] })),
        ).toEqual([-1, 0, 0.5]);
        expect(
            samplesOf(
                wav({
                    channels: 1,
                    bits: 24,
                    payload: [0, 0, 0xc0, 0, 0, 0x40],
                }),
            ),
        ).toEqual([-0.5, 0.5]);
        expect(
            samplesOf(
                wav({ channels: 1, bits: 32, payload: little(0x40000000, 4) }),
            ),
        ).toEqual([0.5]);

        const float = new DataView(new ArrayBuffer(12));
        float.setFloat32(0, -0.25, true);
        float.setFloat64(4, 0.75, true);
        const bytes = new Uint8Array(float.buffer);

        expect(
            samplesOf(
                wav({
                    code: 3,
                    channels: 1,
                    bits: 32,
                    payload: [...bytes.subarray(0, 4)],
                }),
            ),
        ).toEqual([-0.25]);
        expect(
            samplesOf(
                wav({
                    code: 3,
                    channels: 1,
                    bits: 64,
                    payload: [...bytes.subarray(4)],
                }),
            ),
        ).toEqual([0.75]);
    });

    it('reads WAVE_FORMAT_EXTENSIBLE by its inner format', () => {
        const file = wav({
            channels: 1,
            bits: 16,
            extensible: 1,
            payload: little(0xc000, 2),
        });

        expect(samplesOf(file)).toEqual([-0.5]);
    });

    it('says the rate, the channels and the length the data chunk gives', () => {
        const reader = createWavReader();
        reader.push(
            wav({
                channels: 2,
                rate: 44100,
                bits: 16,
                payload: Array.from({ length: 12 }, () => 0),
            }),
        );

        expect(reader.format).toEqual({
            sampleRate: 44100,
            channels: 2,
            totalSamples: 3,
        });
    });

    it('skips other chunks before the data, padded to an even size', () => {
        const extra = [...ascii('LIST'), ...little(3, 4), 1, 2, 3, 0];

        expect(
            samplesOf(wav({ channels: 1, bits: 8, payload: [255], extra })),
        ).toEqual([127 / 128]);
    });

    it('reads to the end of the file when the data size is unknown, and says no length', () => {
        const reader = createWavReader();
        const samples = reader.push(
            wav({
                channels: 1,
                bits: 8,
                payload: [128, 128, 0],
                dataSize: 0xffffffff,
                riff: 'RF64',
            }),
        );

        expect(Array.from(samples)).toEqual([0, 0, -1]);
        expect(reader.format?.totalSamples).toBeUndefined();
    });

    it('stops at the end of the data chunk, and leaves a half sample out', () => {
        const file = wav({
            channels: 1,
            bits: 16,
            payload: [0, 0x40, 0, 0x40, 1, 2],
            dataSize: 5,
        });

        expect(samplesOf(file)).toEqual([0.5, 0.5]);
    });

    it('gives the same samples however the bytes are cut', () => {
        const payload = Array.from(
            { length: 60 },
            (_, index) => (index * 37) % 256,
        );
        const file = wav({
            channels: 2,
            bits: 24,
            payload,
            extra: [...ascii('junk'), ...little(5, 4), 1, 2, 3, 4, 5, 0],
        });
        const whole = samplesOf(file);

        fc.assert(
            fc.property(
                fc.array(fc.integer({ min: 1, max: 30 }), { maxLength: 10 }),
                (cuts) => {
                    const reader = createWavReader();
                    const pieces = inPieces(file, cuts, (piece) =>
                        Array.from(reader.push(piece)),
                    ).flat();

                    expect(pieces).toEqual(whole);
                },
            ),
        );
        expect(whole).toHaveLength(10);
    });

    it('refuses what it cannot read', () => {
        const refused = [
            wav({ channels: 1, bits: 8, payload: [0], riff: 'RIFX' }),
            wav({ code: 7, channels: 1, bits: 8, payload: [0] }),
            wav({ channels: 0, bits: 16, payload: [0, 0] }),
            wav({
                channels: 33,
                bits: 8,
                payload: Array.from({ length: 33 }, () => 0),
            }),
            wav({ channels: 1, bits: 12, payload: [0, 0] }),
            wav({ channels: 1, bits: 16, rate: 0, payload: [0, 0] }),
            Uint8Array.from([
                ...ascii('RIFF'),
                0,
                0,
                0,
                0,
                ...ascii('WAVE'),
                ...ascii('data'),
                2,
                0,
                0,
                0,
                0,
                0,
            ]),
            Uint8Array.from([
                ...ascii('RIFF'),
                0,
                0,
                0,
                0,
                ...ascii('WAVE'),
                ...ascii('fmt '),
                8,
                0,
                0,
                0,
                ...Array.from({ length: 8 }, () => 1),
            ]),
            Uint8Array.from([
                ...ascii('RIFF'),
                0,
                0,
                0,
                0,
                ...ascii('WAVE'),
                ...ascii('fmt '),
                ...little(1025, 4),
            ]),
        ];

        for (const file of refused) {
            expect(() => createWavReader().push(file)).toThrow(TypeError);
        }
    });

    it('never runs away on any bytes, and throws only TypeError', () => {
        fc.assert(
            fc.property(fc.uint8Array({ maxLength: 2000 }), (data) => {
                const head = Uint8Array.from([
                    ...ascii('RIFF'),
                    0,
                    0,
                    0,
                    0,
                    ...ascii('WAVE'),
                ]);
                const file = new Uint8Array(head.length + data.length);
                file.set(head);
                file.set(data, head.length);

                try {
                    createWavReader().push(file);
                } catch (error) {
                    expect(error).toBeInstanceOf(TypeError);
                }
            }),
        );
    });
});
