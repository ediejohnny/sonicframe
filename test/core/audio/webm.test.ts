import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';
import { ebmlHeader, vint } from '../../../src/core/audio/ebml';
import { createWebmReader } from '../../../src/core/audio/webm';
import {
    bytes,
    expectSafeWhenDamaged,
    readAll,
} from '../../support/sound-files';
import {
    cluster,
    element,
    fillFrame,
    open,
    OPUS_PRIVATE,
    simpleBlock,
    uintElement,
    webm,
    type TrackOptions,
} from '../../support/webm-files';

const OPUS: TrackOptions = { number: 1, codec: 'A_OPUS', setup: OPUS_PRIVATE };

/** The reader's own refusal, never a slip that throws by chance. */
const NOT_FORMAT = /^sonicframe: the sound is not/;

/** Opus frames 20 ms apart over two clusters. */
const FILE = webm({
    tracks: [OPUS],
    duration: 60,
    clusters: [
        cluster(
            0,
            simpleBlock(1, 0, [fillFrame(30, 1)]),
            simpleBlock(1, 20, [fillFrame(40, 2)]),
        ),
        cluster(40, simpleBlock(1, 0, [fillFrame(50, 3)])),
    ],
});

/** Each frame given for `file` pushed in pieces, then the end: its size, fill and samples. */
function framesOf(
    file: Uint8Array,
    cuts: readonly number[] = [],
): [number, number, number][] {
    return readAll(createWebmReader(), file, cuts).map((frame) => [
        frame.data.length,
        frame.data[0],
        frame.samples,
    ]);
}

describe('vint and ebmlHeader', () => {
    it("read numbers of each width, keep an ID's marker, and tell an unknown size", () => {
        expect(vint(Uint8Array.from([0x81]), 0, 8, false)).toEqual({
            value: 1,
            width: 1,
            unknown: false,
        });
        expect(vint(Uint8Array.from([0x40, 0x02]), 0, 8, false)).toEqual({
            value: 2,
            width: 2,
            unknown: false,
        });
        expect(
            vint(Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3]), 0, 4, true)?.value,
        ).toBe(0x1a45dfa3);
        expect(vint(Uint8Array.from([0xff]), 0, 8, false)?.unknown).toBe(true);
        expect(vint(Uint8Array.from([0x00]), 0, 8, false)).toBeNull();
        expect(vint(Uint8Array.from([0x40]), 0, 8, false)).toBeUndefined();
        expect(
            vint(Uint8Array.from([0x08, 0, 0, 0, 0]), 0, 4, true),
        ).toBeNull();
    });

    it('reads an element header, and a size of all ones as unknown', () => {
        expect(ebmlHeader(Uint8Array.from(element(0xe7, [1, 2])), 0)).toEqual({
            id: 0xe7,
            size: 2,
            length: 2,
        });
        expect(ebmlHeader(Uint8Array.from(open(0x1f43b675)), 0)).toEqual({
            id: 0x1f43b675,
            size: null,
            length: 12,
        });
        // An ID takes at most 4 bytes, so a first byte of 0x08 starts none.
        expect(
            ebmlHeader(Uint8Array.from([0x08, 0, 0, 0, 0, 0x81]), 0),
        ).toBeNull();
    });
});

describe('createWebmReader', () => {
    it('gives each frame of the sound track with the samples to the next, however the bytes are cut', () => {
        fc.assert(
            fc.property(
                fc.array(fc.integer({ min: 1, max: 60 }), { maxLength: 10 }),
                (cuts) => {
                    expect(framesOf(FILE, cuts)).toEqual([
                        [30, 1, 960],
                        [40, 2, 960],
                        [50, 3, 960],
                    ]);
                },
            ),
        );
    });

    it('sets Opus up at 48 kHz from its CodecPrivate, with the length from Info', () => {
        const reader = createWebmReader();
        reader.push(FILE);

        expect(reader.format).toEqual({
            codec: 'opus',
            sampleRate: 48000,
            channels: 2,
            description: Uint8Array.from(OPUS_PRIVATE),
            totalSamples: 2880,
        });
    });

    it('follows the sound track past a video one, skipping its blocks, with a time scale of its own', () => {
        const file = webm({
            // A track that is not sound is never followed, whatever codec it names.
            tracks: [
                { ...OPUS, number: 1, type: 1 },
                { ...OPUS, number: 2 },
            ],
            scale: 500_000,
            clusters: [
                cluster(
                    0,
                    simpleBlock(1, 0, [fillFrame(100_000, 9)]),
                    simpleBlock(2, 0, [fillFrame(10, 1)]),
                    simpleBlock(2, 40, [fillFrame(10, 2)]),
                ),
            ],
        });

        expect(framesOf(file, [5000])).toEqual([
            [10, 1, 960],
            [10, 2, 960],
        ]);
    });

    it('walks into a segment and clusters of unknown size, and blocks inside groups', () => {
        const file = bytes(
            element(0x1a45dfa3),
            open(
                0x18538067,
                element(
                    0x1654ae6b,
                    element(
                        0xae,
                        uintElement(0xd7, 1),
                        uintElement(0x83, 2),
                        element(0x86, [0x41, 0x5f, 0x4f, 0x50, 0x55, 0x53]),
                    ),
                ),
                open(
                    0x1f43b675,
                    uintElement(0xe7, 0),
                    element(0xa0, element(0xa1, [0x81, 0, 0, 0, 7, 7])),
                ),
                open(
                    0x1f43b675,
                    uintElement(0xe7, 10),
                    simpleBlock(1, 0, [[8]]),
                ),
            ),
        );

        expect(framesOf(file)).toEqual([
            [2, 7, 480],
            [1, 8, 480],
        ]);
    });

    it('splits Xiph, EBML and fixed lacing', () => {
        const frames = [fillFrame(300, 1), fillFrame(20, 2), fillFrame(7, 3)];
        const same = [fillFrame(6, 4), fillFrame(6, 5)];
        const file = webm({
            tracks: [OPUS],
            clusters: [
                cluster(
                    0,
                    simpleBlock(1, 0, frames, 1),
                    simpleBlock(1, 20, frames, 3),
                    simpleBlock(1, 40, same, 2),
                ),
            ],
        });

        expect(framesOf(file).map(([size, fill]) => [size, fill])).toEqual([
            [300, 1],
            [20, 2],
            [7, 3],
            [300, 1],
            [20, 2],
            [7, 3],
            [6, 4],
            [6, 5],
        ]);
    });

    it('names AAC from its setup, and reads Vorbis, FLAC and MP3 tracks', () => {
        const formatOf = (track: TrackOptions): unknown => {
            const reader = createWebmReader();
            reader.push(webm({ tracks: [track], clusters: [] }));

            return reader.format;
        };

        expect(
            formatOf({
                number: 1,
                codec: 'A_AAC',
                setup: [0x12, 0x10],
                rate: 44100,
            }),
        ).toEqual({
            codec: 'mp4a.40.2',
            sampleRate: 44100,
            channels: 2,
            description: Uint8Array.from([0x12, 0x10]),
        });
        expect(
            formatOf({
                number: 1,
                codec: 'A_VORBIS',
                setup: [2, 1, 1, 9, 9, 9],
                rate: 22050,
                channels: 1,
            }),
        ).toMatchObject({
            codec: 'vorbis',
            sampleRate: 22050,
            channels: 1,
        });
        expect(
            formatOf({
                number: 1,
                codec: 'A_FLAC',
                setup: [0x66, 0x4c, 0x61, 0x43],
            }),
        ).toMatchObject({ codec: 'flac' });
        expect(
            formatOf({
                number: 1,
                codec: 'A_MPEG/L3',
                rate: 44100,
                float32: true,
            }),
        ).toEqual({
            codec: 'mp3',
            sampleRate: 44100,
            channels: 2,
        });
    });

    it('refuses what it cannot read', () => {
        const refused = [
            bytes(element(0x18538067)),
            webm({
                tracks: [{ number: 1, type: 1, codec: 'V_VP9' }],
                clusters: [],
            }),
            webm({ tracks: [{ number: 1, codec: 'A_VORBIS' }], clusters: [] }),
            webm({
                tracks: [{ number: 1, codec: 'A_AAC', setup: [0x12] }],
                clusters: [],
            }),
            webm({
                tracks: [{ number: 1, codec: 'A_PCM/INT/LIT' }],
                clusters: [],
            }),
            webm({ tracks: [{ ...OPUS, channels: 0 }], clusters: [] }),
            webm({ tracks: [OPUS], clusters: [open(0x1c53bb6b)] }),
            webm({
                tracks: [OPUS],
                clusters: [
                    cluster(
                        0,
                        simpleBlock(
                            1,
                            0,
                            [fillFrame(3, 1), fillFrame(2, 2)],
                            1,
                        ).map((byte, index, all) =>
                            index === all.length - 6 ? 200 : byte,
                        ),
                    ),
                ],
            }),
            bytes(
                element(0x1a45dfa3),
                [0x15, 0x49, 0xa9, 0x66, 0x08, 0x10, 0, 0, 0, 0, 0, 0],
            ),
            bytes(element(0x1a45dfa3), [0x00]),
            webm({
                tracks: [OPUS],
                clusters: [
                    cluster(
                        0,
                        simpleBlock(
                            1,
                            0,
                            [fillFrame(6, 1), fillFrame(5, 2)],
                            2,
                        ),
                    ),
                ],
            }),
        ];

        for (const file of refused) {
            expect(() => createWebmReader().push(file)).toThrow(NOT_FORMAT);
        }
    });

    it('reads a block time before its cluster time', () => {
        const file = webm({
            tracks: [OPUS],
            clusters: [
                cluster(0, simpleBlock(1, 0, [[1]])),
                cluster(
                    100,
                    simpleBlock(1, -40, [[2]]),
                    simpleBlock(1, 0, [[3]]),
                ),
            ],
        });

        expect(framesOf(file).map(([, , samples]) => samples)).toEqual([
            2880, 1920, 1920,
        ]);
    });

    it('refuses a block of its track past 16 MiB, but skips one of another track', () => {
        const head = (track: number): Uint8Array =>
            bytes(
                webm({
                    tracks: [OPUS, { number: 2, type: 1, codec: 'V_VP9' }],
                    clusters: [],
                }),
                [0xa3, 0x01, 0, 0, 0, 0x01, 0, 0, 1, 0x80 | track, 0, 0, 0x80],
                fillFrame(10, 0),
            );

        expect(() => createWebmReader().push(head(1))).toThrow(NOT_FORMAT);
        expect(createWebmReader().push(head(2))).toEqual([]);
    });

    it('never runs away on a damaged file, and throws only TypeError', () => {
        expectSafeWhenDamaged(FILE, (damaged) => {
            const reader = createWebmReader();
            reader.push(damaged);
            reader.end?.();
        });
    });
});
