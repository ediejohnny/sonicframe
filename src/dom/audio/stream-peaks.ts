/**
 * A sound's peaks read as it downloads, never holding the whole sound: the bytes go through the
 * reader of the format their first bytes name (an ID3 tag in front skipped), the frames through a
 * decoder, and the samples into a peak stream that keeps a few values per peak. The download stops at
 * `maxBytes`, the reading at `maxSeconds`. An MP4 whose index comes last is read with a `Range` request
 * first. A sound that fails before its first peak (a format, codec or server this cannot read in
 * pieces) throws `NotStreamable`, so the caller can decode it whole instead.
 */

import { createAdtsReader } from '../../core/audio/adts';
import { ByteQueue } from '../../core/audio/byte-queue';
import { createFlacReader } from '../../core/audio/flac';
import type {
    CodedFormat,
    CodedFrame,
    FrameReader,
} from '../../core/audio/frames';
import { createMp3Reader } from '../../core/audio/mp3';
import { createMp4Reader, type Mp4Reader } from '../../core/audio/mp4';
import { createOggReader } from '../../core/audio/ogg';
import { remuxable } from '../../core/audio/remux';
import {
    id3Size,
    SNIFF_BYTES,
    soundKind,
    type SoundKind,
} from '../../core/audio/sniff';
import { createWavReader, type PcmReader } from '../../core/audio/wav';
import { createWebmReader } from '../../core/audio/webm';
import { createPeakStream } from '../../core/peaks/peak-stream';
import type { Limit } from '../../core/shared/limits';
import { webCodecsSink, wholeFileSink, type FrameSink } from './frame-sinks';

/** Thrown when a sound cannot be read in pieces here; no peak was given yet. */
export class NotStreamable extends Error {
    constructor(reason: string) {
        super(`sonicframe: the sound cannot be read in pieces (${reason})`);
        this.name = 'NotStreamable';
    }
}

export type StreamPeaksOptions = {
    /** How many peaks. */
    count: number;
    /** The most bytes downloaded. */
    maxBytes: number;
    /** The most seconds read; the rest is drawn as silence when the length is known. */
    maxSeconds: number;
    signal?: AbortSignal;
    /** Whether WebCodecs may decode (`false` uses `decodeAudioData` on pieces). */
    webcodecs?: boolean;
    /** The rate pieces are decoded at without WebCodecs, in samples a second. */
    sampleRate?: number;
    /** The sound's length in seconds, when the page knows it (the media's metadata). */
    duration?: () => number | undefined;
    /** Called with the peaks so far, the part to come drawn as silence, at most every `every` ms. */
    onPeaks?: (peaks: number[]) => void;
    every?: number;
};

export type StreamedPeaks = { peaks: number[]; duration: number };

/** The most bytes downloaded for the peaks: 1 GiB, up to 4 GiB. */
export const STREAM_BYTES: Limit = {
    value: 1_073_741_824,
    least: 1,
    most: 4_294_967_296,
    whole: true,
};

/** The most seconds read: 36 000 (10 hours), up to 86 400 (24 hours). */
export const STREAM_SECONDS: Limit = {
    value: 36_000,
    least: 1,
    most: 86_400,
    whole: false,
};

/** The largest `moov` box read from the end of an MP4: 64 MiB. */
const MOOV_BYTES = 67_108_864;

/** Formats whose frames can be built back into whole files for `decodeAudioData`. */
const REBUILT: readonly SoundKind[] = ['mp3', 'adts', 'ogg', 'flac'];

function readerFor(kind: SoundKind): FrameReader | PcmReader {
    switch (kind) {
        case 'wav':
            return createWavReader();
        case 'mp3':
            return createMp3Reader();
        case 'adts':
            return createAdtsReader();
        case 'ogg':
            return createOggReader();
        case 'flac':
            return createFlacReader();
        case 'webm':
            return createWebmReader();
        default:
            return createMp4Reader();
    }
}

/** The body's pieces; leaving a loop over them early stops the download. */
async function* piecesOf(response: Response): AsyncGenerator<Uint8Array> {
    if (response.body === null) {
        throw new NotStreamable('no body');
    }

    const reader = response.body.getReader();

    try {
        for (;;) {
            const { done, value } = await reader.read();

            if (done) {
                return;
            }

            yield value;
        }
    } finally {
        await reader.cancel().catch(() => undefined);
    }
}

/** Whether an error before any peak means the sound is not for this reading (not a stop or a cap). */
function notForStreaming(error: unknown): boolean {
    return (
        error instanceof TypeError ||
        (error instanceof DOMException && error.name !== 'AbortError')
    );
}

export async function streamPeaks(
    url: string,
    options: StreamPeaksOptions,
): Promise<StreamedPeaks> {
    const peaks = createPeakStream(options.count);
    const every = options.every ?? 250;
    let rate = 0;
    let downloaded = 0;
    let shown = 0;
    let format: CodedFormat | null = null;
    let sink: FrameSink | null = null;
    let waiting: CodedFrame[] = [];
    let kind: SoundKind | null = null;
    let stopped = false;

    const open = async (from?: number): Promise<Response> => {
        const response = await fetch(url, {
            signal: options.signal,
            ...(from === undefined
                ? {}
                : { headers: { Range: `bytes=${from}-` } }),
        });

        if (!response.ok) {
            throw new Error(
                `sonicframe: could not fetch audio (${response.status})`,
            );
        }

        return response;
    };

    /** The whole length in samples at the decoded rate, when known. */
    const expected = (): number | undefined => {
        const seconds =
            format?.totalSamples === undefined
                ? options.duration?.()
                : format.totalSamples / format.sampleRate;

        return rate > 0 && seconds !== undefined && seconds > 0
            ? Math.round(seconds * rate)
            : undefined;
    };

    const take = (samples: Float32Array, at: number): void => {
        rate = at;
        peaks.push(samples);
        stopped ||= peaks.length >= options.maxSeconds * rate;

        if (options.onPeaks && Date.now() - shown >= every) {
            shown = Date.now();
            options.onPeaks(peaks.peaks(expected()));
        }
    };

    const counted = (bytes: Uint8Array): Uint8Array => {
        downloaded += bytes.length;

        if (downloaded > options.maxBytes) {
            throw new Error('sonicframe: audio is too large to decode');
        }

        return bytes;
    };

    /** Frames to the decoder, made once the format is known. */
    const decode = async (
        frames: readonly CodedFrame[],
        reader: FrameReader,
    ): Promise<void> => {
        waiting.push(...frames);

        if (sink === null && reader.format !== null && waiting.length > 0) {
            format = reader.format;
            sink =
                (options.webcodecs === false
                    ? null
                    : await webCodecsSink(format, take)) ??
                (kind !== null &&
                REBUILT.includes(kind) &&
                remuxable(format.codec)
                    ? wholeFileSink(format, take, options.sampleRate ?? 22050)
                    : null);

            if (sink === null) {
                throw new NotStreamable(`no decoder for ${format.codec}`);
            }
        }

        if (sink !== null) {
            const ready = waiting;
            waiting = [];
            await sink.push(ready);
        }
    };

    /** Reads `pieces` through `reader`, `first` ahead; the MP4 reader may stop to ask for its index. */
    const read = async (
        pieces: AsyncIterable<Uint8Array>,
        reader: FrameReader | PcmReader,
        first?: Uint8Array,
    ): Promise<void> => {
        const feed = async (bytes: Uint8Array): Promise<void> => {
            if (isPcm(reader)) {
                const samples = reader.push(bytes);
                format ??= reader.format && { codec: 'pcm', ...reader.format };

                if (reader.format !== null) {
                    take(samples, reader.format.sampleRate);
                }
            } else {
                await decode(reader.push(bytes), reader);
            }
        };

        if (first !== undefined && first.length > 0) {
            await feed(first);
        }

        for await (const bytes of pieces) {
            await feed(counted(bytes));

            if (stopped || (reader as Mp4Reader).moovAt != null) {
                return;
            }
        }

        if (!isPcm(reader) && reader.end !== undefined) {
            await decode(reader.end(), reader);
        }
    };

    /** The reader of an MP4 whose index comes after its data, the index read from a `Range` response. */
    const mp4After = async (at: number): Promise<Mp4Reader> => {
        const response = await open(at);

        if (response.status !== 206) {
            throw new NotStreamable('the server sends no ranges');
        }

        const index = createMp4Reader();
        let read = 0;

        for await (const bytes of piecesOf(response)) {
            index.push(counted(bytes));
            read += bytes.length;

            if (index.track !== null || read > MOOV_BYTES) {
                break;
            }
        }

        if (index.track === null) {
            throw new NotStreamable('no index');
        }

        return createMp4Reader(index.track);
    };

    try {
        const pieces = piecesOf(await open());
        const head = new ByteQueue();

        let told = false;

        // The first bytes: any ID3 tag skipped, then enough to tell the format.
        while (!told) {
            const next = await pieces.next();

            if (next.done === true) {
                throw new NotStreamable('too short');
            }

            head.push(counted(next.value));
            let tag = id3Size(head.view());

            while (tag !== null && tag > 0) {
                head.skip(tag);
                tag = head.length >= 10 ? id3Size(head.view()) : null;
            }

            if (tag === 0 && head.length >= SNIFF_BYTES) {
                kind = soundKind(head.view());
                told = true;
            }
        }

        if (kind === null) {
            throw new NotStreamable('an unknown format');
        }

        const reader = readerFor(kind);
        await read(pieces, reader, head.take(head.length));
        const moov = (reader as Mp4Reader).moovAt;

        if (moov != null && !stopped) {
            const after = await mp4After(moov);
            await read(piecesOf(await open()), after);
        }

        await (sink as FrameSink | null)?.finish();
    } catch (error) {
        (sink as FrameSink | null)?.close();

        if (
            peaks.length === 0 &&
            !(error instanceof NotStreamable) &&
            notForStreaming(error)
        ) {
            throw new NotStreamable(
                error instanceof Error ? error.message : String(error),
            );
        }

        throw error;
    }

    const whole = stopped ? expected() : undefined;

    return {
        peaks: peaks.peaks(whole),
        duration: (whole ?? peaks.length) / Math.max(rate, 1),
    };
}

/** Whether a reader gives samples rather than frames. */
function isPcm(reader: FrameReader | PcmReader): reader is PcmReader {
    return 'kind' in reader && reader.kind === 'pcm';
}
