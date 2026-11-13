/**
 * AAC in ADTS (a `.aac` file): each frame starts with a 7-byte header (9 with a checksum) that says its
 * length, profile, sample rate and channels (ISO/IEC 13818-7). WebCodecs reads these frames whole,
 * header included, when given no description. Channel layouts set inside the sound (0) are not read.
 */

import { createSyncReader, type SyncHeader } from './sync-reader';
import type { FrameReader } from './frames';

/** Sample rates by the header's index, in Hz. */
const SAMPLE_RATES = [
    96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025,
    8000, 7350,
];

/** The header of an ADTS frame at `at`, or null when the bytes there are not one. */
export function adtsHeader(bytes: Uint8Array, at: number): SyncHeader | null {
    if (at + 7 > bytes.length || bytes[at] !== 0xff) {
        return null;
    }

    const second = bytes[at + 1];
    const third = bytes[at + 2];
    const fourth = bytes[at + 3];
    const rateIndex = (third >> 2) & 15;
    const layout = ((third & 1) << 2) | (fourth >> 6);
    const headerLength = (second & 1) === 1 ? 7 : 9;
    const length =
        ((fourth & 3) << 11) | (bytes[at + 4] << 3) | (bytes[at + 5] >> 5);

    if (
        (second & 0xf6) !== 0xf0 ||
        rateIndex >= SAMPLE_RATES.length ||
        layout === 0 ||
        length <= headerLength
    ) {
        return null;
    }

    const profile = third >> 6;

    return {
        length,
        samples: ((bytes[at + 6] & 3) + 1) * 1024,
        sampleRate: SAMPLE_RATES[rateIndex],
        channels: layout === 7 ? 8 : layout,
        stream: profile * 16 + rateIndex,
        codec: `mp4a.40.${profile + 1}`,
    };
}

/** Reads an ADTS file's frames. */
export function createAdtsReader(): FrameReader {
    return createSyncReader({
        name: 'AAC (ADTS)',
        headerBytes: 7,
        header: adtsHeader,
    });
}
