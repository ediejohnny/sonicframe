/**
 * An MP4 or M4A file read as it arrives. Its `moov` box (kept whole, up to 64 MiB) gives the sound
 * track's table; from then on each frame is taken at the place the table says, and the bytes between
 * (other tracks, other boxes) are skipped without being kept. When the sound's data comes before its
 * `moov`, the reader stops and says where the `moov` is, so the caller can fetch it first and start
 * again with the track.
 */

import { ByteQueue } from './byte-queue';
import { uint32 } from './bytes';
import {
    notFormat,
    type CodedFormat,
    type CodedFrame,
    type FrameReader,
} from './frames';
import { boxesIn, readMp4Track, type Mp4Track } from './mp4-track';

/** The largest `moov` box read: 64 MiB (ten hours of AAC lists about 6 MB of frame sizes). */
const MOOV_BYTES = 67_108_864;

export type Mp4Reader = FrameReader & {
    /** The sound track, once its `moov` is read. */
    readonly track: Mp4Track | null;
    /** Where in the file the `moov` box starts, when the data came first; the reader then stops. */
    readonly moovAt: number | null;
};

/** One frame's place in the file. */
type Place = {
    readonly at: number;
    readonly size: number;
    readonly samples: number;
};

/** The frames of a track in the order the file lists them. */
function* places(track: Mp4Track): Generator<Place> {
    let frame = 0;
    let length = 0;
    let lengthLeft = 0;
    let run = 0;

    if (track.runs.length === 0) {
        return;
    }

    for (
        let chunk = 0;
        chunk < track.chunks.length && frame < track.count;
        chunk++
    ) {
        while (
            run + 1 < track.runs.length &&
            track.runs[run + 1][0] <= chunk + 1
        ) {
            run++;
        }

        let at = track.chunks[chunk];

        for (
            let inChunk = 0;
            inChunk < track.runs[run][1] && frame < track.count;
            inChunk++
        ) {
            while (lengthLeft === 0 && length < track.lengths.length) {
                lengthLeft = track.lengths[length][0];
                length++;
            }

            lengthLeft = Math.max(0, lengthLeft - 1);
            const size =
                typeof track.sizes === 'number'
                    ? track.sizes
                    : (track.sizes[frame] ?? 0);
            yield {
                at,
                size,
                samples: track.lengths[Math.max(0, length - 1)]?.[1] ?? 1024,
            };
            at += size;
            frame++;
        }
    }
}

/** Reads an MP4 file's sound frames; given a `track` read before, it needs no `moov`. */
export function createMp4Reader(known: Mp4Track | null = null): Mp4Reader {
    const queue = new ByteQueue();
    let track = known;
    let moovAt: number | null = null;
    let next: Iterator<Place> | null = known ? places(known) : null;
    let place: Place | null = null;

    /** Reads top-level boxes until the `moov`; false while more bytes are needed or after stopping. */
    const findTrack = (): boolean => {
        while (track === null && moovAt === null) {
            if (queue.length < 16) {
                return false;
            }

            const head = queue.view();
            const small = uint32(head, 0);
            const size =
                small === 1
                    ? uint32(head, 8) * 0x100000000 + uint32(head, 12)
                    : small;
            const type = String.fromCharCode(...head.subarray(4, 8));

            if (type === 'moov') {
                if (size < 8 || size > MOOV_BYTES) {
                    throw notFormat('an MP4 sound read here');
                }

                if (queue.length < size) {
                    return false;
                }

                const moov = queue.take(size);
                const [box] = boxesIn(moov, 0, size);

                if (box === undefined) {
                    throw notFormat('an MP4 sound read here');
                }

                track = readMp4Track(moov, box);
                next = places(track);
            } else if (type === 'mdat') {
                if (size === 0) {
                    throw notFormat(
                        'an MP4 file whose sound can be read in pieces',
                    );
                }

                moovAt = queue.offset + size;
            } else if (size === 0) {
                throw notFormat('an MP4 file with sound');
            } else if (size < 8) {
                throw notFormat('an MP4 sound read here');
            } else {
                queue.skip(size);
            }
        }

        return track !== null;
    };

    return {
        get format(): CodedFormat | null {
            return track?.format ?? null;
        },
        get track(): Mp4Track | null {
            return track;
        },
        get moovAt(): number | null {
            return moovAt;
        },
        push(bytes: Uint8Array): CodedFrame[] {
            queue.push(bytes);
            const frames: CodedFrame[] = [];

            if (!findTrack() || next === null) {
                if (moovAt !== null) {
                    queue.skip(queue.length);
                }

                return frames;
            }

            for (;;) {
                if (place === null) {
                    const step = next.next();

                    if (step.done === true) {
                        queue.skip(queue.length);

                        return frames;
                    }

                    place = step.value;
                }

                if (place.at < queue.offset || place.size === 0) {
                    place = null;
                    continue;
                }

                queue.skip(Math.min(place.at - queue.offset, queue.length));

                if (queue.offset < place.at || queue.length < place.size) {
                    return frames;
                }

                frames.push({
                    data: queue.take(place.size),
                    samples: place.samples,
                });
                place = null;
            }
        },
    };
}
