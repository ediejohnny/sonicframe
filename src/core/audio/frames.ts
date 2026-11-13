/**
 * What a reader of a sound file gives as the bytes come: the codec's frames, each whole, and the
 * format a decoder needs. A reader holds only the bytes of a frame not yet complete.
 */

/** One frame of coded sound, whole, and how many samples (per channel) it holds. */
export type CodedFrame = {
    readonly data: Uint8Array;
    readonly samples: number;
};

/** What a decoder needs to read the frames, and the sound's whole length when the file tells it. */
export type CodedFormat = {
    /** The codec, as WebCodecs names it (`'mp3'`, `'mp4a.40.2'`, `'opus'`...). */
    readonly codec: string;
    readonly sampleRate: number;
    readonly channels: number;
    /** The codec's setup bytes, for the codecs that have them. */
    readonly description?: Uint8Array;
    /** Samples per channel in the whole sound, when the file says. */
    readonly totalSamples?: number;
};

/** A reader taking a file's bytes piece by piece. */
export type FrameReader = {
    /** Known once the first frame is read. */
    readonly format: CodedFormat | null;
    /** Takes the next bytes and gives every frame they complete. */
    push(bytes: Uint8Array): CodedFrame[];
};

/** Thrown when the bytes are not the format a reader reads. */
export function notFormat(name: string): TypeError {
    return new TypeError(`sonicframe: the sound is not ${name}`);
}
