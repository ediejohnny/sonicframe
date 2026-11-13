/**
 * MP3 (MPEG-1, 2 and 2.5 Audio Layer III) frames: each header says the frame's length from its bit
 * rate, sample rate and padding (ISO/IEC 11172-3 and 13818-3). A first frame carrying a Xing, Info
 * or VBRI header gives the whole sound's frame count. Free-format frames (bit rate 0) are not read.
 */

import { textAt, uint32 } from './bytes';
import { createSyncReader, type SyncHeader } from './sync-reader';
import type { FrameReader } from './frames';

/** Bit rates of MPEG-1 Layer III, in kbit/s, by the header's index (0 is free format). */
const MPEG1_RATES = [
    0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320,
];

/** Bit rates of MPEG-2 and 2.5 Layer III, in kbit/s. */
const MPEG2_RATES = [
    0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160,
];

/** Sample rates by the header's version bits (0: MPEG-2.5, 2: MPEG-2, 3: MPEG-1), in Hz. */
const SAMPLE_RATES: Readonly<Record<number, readonly number[]>> = {
    0: [11025, 12000, 8000],
    2: [22050, 24000, 16000],
    3: [44100, 48000, 32000],
};

/** The header of an MP3 frame at `at`, or null when the bytes there are not one. */
export function mp3Header(bytes: Uint8Array, at: number): SyncHeader | null {
    if (at + 4 > bytes.length || bytes[at] !== 0xff) {
        return null;
    }

    const second = bytes[at + 1];
    const third = bytes[at + 2];
    const version = (second >> 3) & 3;
    const rates = SAMPLE_RATES[version];
    const rateIndex = (third >> 2) & 3;
    const bitIndex = third >> 4;

    if (
        (second & 0xe0) !== 0xe0 ||
        rates === undefined ||
        ((second >> 1) & 3) !== 1 ||
        rateIndex === 3 ||
        bitIndex === 0 ||
        bitIndex === 15
    ) {
        return null;
    }

    const mpeg1 = version === 3;
    const bitRate = (mpeg1 ? MPEG1_RATES : MPEG2_RATES)[bitIndex] * 1000;
    const sampleRate = rates[rateIndex];
    const samples = mpeg1 ? 1152 : 576;

    return {
        length:
            Math.floor(((samples / 8) * bitRate) / sampleRate) +
            ((third >> 1) & 1),
        samples,
        sampleRate,
        channels: bytes[at + 3] >> 6 === 3 ? 1 : 2,
        stream: version * 4 + rateIndex,
        codec: 'mp3',
    };
}

/** The whole sound's samples from a Xing, Info or VBRI header in the first frame, if it has one. */
export function mp3Total(
    frame: Uint8Array,
    header: SyncHeader,
): number | undefined {
    const mono = header.channels === 1;
    const side = header.samples === 1152 ? (mono ? 17 : 32) : mono ? 9 : 17;
    const xing = 4 + side;
    let frames: number | undefined;

    if (
        (textAt(frame, xing, 'Xing') || textAt(frame, xing, 'Info')) &&
        xing + 12 <= frame.length &&
        (uint32(frame, xing + 4) & 1) === 1
    ) {
        frames = uint32(frame, xing + 8);
    } else if (textAt(frame, 36, 'VBRI') && 36 + 18 <= frame.length) {
        frames = uint32(frame, 36 + 14);
    }

    return frames === undefined ? undefined : frames * header.samples;
}

/** Reads an MP3 file's frames (the ID3 tag in front already skipped). */
export function createMp3Reader(): FrameReader {
    return createSyncReader({
        name: 'MP3',
        headerBytes: 4,
        header: mp3Header,
        totalIn: mp3Total,
    });
}
