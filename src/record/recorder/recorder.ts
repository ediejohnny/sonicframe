/**
 * Recording from the microphone, without a screen. Nothing is asked until `start` (call it from a
 * person's press); the microphone is read for its level a frame at a time, never sent to the
 * speakers, while a `MediaRecorder` keeps the sound in chunks. The clock counts only the time
 * recorded, so a pause stops it; the recording stops on its own at its limit, and with an error past
 * its size cap. Stopping gives back the sound with its own length (a recorder's file often says
 * nothing true about it) and its peaks, decoded from the sound or, when that fails, the live levels.
 * Stopping, cancelling and destroying all let the microphone go.
 */

import { peaksFromChannel } from '../../core/peaks/peaks';
import { LevelTrack, levelOf } from '../../core/recording/levels';
import {
    DEFAULT_RECORD_TYPES,
    MAX_RECORDING_BYTES,
    recordSeconds,
} from '../../core/recording/recording';
import { within } from '../../core/shared/checked';
import { Emitter } from '../../core/shared/emitter';
import { pickMimeType } from '../../core/wave/clip';
import { tapStream, type StreamTap } from '../../dom/audio/audio-graph';
import { decodeAudio } from '../../dom/audio/decode';
import {
    cannotRecord,
    closeMicrophone,
    openMicrophone,
    RecordError,
} from './microphone';

/** A finished recording. */
export type Recording = {
    readonly blob: Blob;
    /** The audio type the browser recorded. */
    readonly type: string;
    /** In seconds: the time recorded, pauses left out. */
    readonly duration: number;
    /** From 0 to 1: decoded from the sound, or the live levels when it could not be decoded. */
    readonly peaks: readonly number[];
    /** In bytes. */
    readonly size: number;
};

export type RecorderOptions = {
    /** Seconds before the recording stops on its own: 300 by default, from 1 to 3600. */
    maxSeconds?: number;
    /** The microphone's settings, over echo, noise and gain control (all on). */
    constraints?: MediaTrackConstraints;
    /** The audio types to try, in order: Opus in WebM, then MP4, then Opus in Ogg by default. */
    mimeType?: string | readonly string[];
    /** The recorder's bitrate; the browser's own by default. */
    audioBitsPerSecond?: number;
    /** Decode the sound for its peaks when it stops. On by default. */
    decode?: boolean;
    /** How many decoded peaks: 1000 by default, from 1 to 100 000. */
    peaks?: number;
    /** Live levels a second: 20 by default, from 1 to 100. */
    rate?: number;
    /** The largest recording, in bytes; only lowers 104 857 600 (100 MiB). */
    maxBytes?: number;
};

export type RecorderEvents = {
    /** A level heard (0 to 1), `seconds` into the recording; about once a frame. */
    level: [level: number, seconds: number];
    /** The recording reached its limit; it stops now. */
    limit: [];
    /** A recording finished, by `stop` or at its limit. */
    stop: [recording: Recording];
    /** Recording failed midway (past the size cap, or the recorder broke); the microphone is let go. */
    error: [error: RecordError];
};

/** Where a recorder is: waiting, asking for the microphone, recording or paused. */
export type RecorderPhase = 'idle' | 'asking' | 'recording' | 'paused';

/** Chunks are handed every second, so a stop loses at most the last one. */
const TIMESLICE = 1000;

export class Recorder {
    /** The live levels of the recording under way (or the last one). */
    readonly levels: LevelTrack;
    private readonly options: RecorderOptions;
    private readonly limit: number;
    private readonly maxBytes: number;
    private readonly events = new Emitter<RecorderEvents>();
    private phase: RecorderPhase = 'idle';
    /** Counts the starts, so a microphone granted after a cancel is let go at once. */
    private attempt = 0;
    private stream: MediaStream | null = null;
    private tap: StreamTap | null = null;
    private recorder: MediaRecorder | null = null;
    private chunks: Blob[] = [];
    private size = 0;
    /** Seconds recorded before the current stretch. */
    private before = 0;
    /** When the current stretch began (`performance.now()`), while recording. */
    private since = 0;
    private frame = 0;
    private timer: ReturnType<typeof setTimeout> | undefined;
    private samples = new Float32Array(0);
    private stopping: Promise<Recording> | null = null;

    constructor(options: RecorderOptions = {}) {
        this.options = options;
        this.limit = recordSeconds(options.maxSeconds);
        this.maxBytes = within(
            options.maxBytes,
            MAX_RECORDING_BYTES,
            1,
            MAX_RECORDING_BYTES,
        );
        this.levels = new LevelTrack(options.rate, this.limit);
    }

    get state(): RecorderPhase {
        return this.phase;
    }

    /** The seconds recorded so far, pauses left out. */
    get seconds(): number {
        const running =
            this.phase === 'recording'
                ? (performance.now() - this.since) / 1000
                : 0;

        return this.before + running;
    }

    on<Name extends keyof RecorderEvents>(
        event: Name,
        listener: (...args: RecorderEvents[Name]) => void,
    ): () => void {
        return this.events.on(event, listener);
    }

    /**
     * Asks for the microphone and starts recording; rejects with a `RecordError` that says why it
     * cannot. Does nothing unless idle.
     */
    async start(): Promise<void> {
        if (this.phase !== 'idle') {
            return;
        }

        const refused = cannotRecord();

        if (refused !== null) {
            throw refused;
        }

        const attempt = ++this.attempt;
        this.phase = 'asking';
        let stream: MediaStream;

        try {
            stream = await openMicrophone(this.options.constraints);
        } catch (error) {
            if (attempt === this.attempt) {
                this.phase = 'idle';
            }

            throw error;
        }

        if (attempt !== this.attempt) {
            closeMicrophone(stream);

            return;
        }

        this.begin(stream);
    }

    /** Pauses the recording and its clock. */
    pause(): void {
        if (this.phase === 'recording') {
            this.before = this.seconds;
            this.phase = 'paused';
            this.recorder?.pause();
            this.still();
        }
    }

    /** Goes on recording after a pause. */
    resume(): void {
        if (this.phase === 'paused') {
            this.recorder?.resume();
            this.run();
        }
    }

    /** Stops and gives the recording back; rejects when nothing is being recorded. */
    stop(): Promise<Recording> {
        if (this.stopping !== null) {
            return this.stopping;
        }

        // A recorder exists only while recording or paused.
        const recorder = this.recorder;

        if (recorder === null) {
            return Promise.reject(
                new Error('sonicframe: nothing is being recorded'),
            );
        }

        this.before = this.seconds;
        this.still();
        const stopping = new Promise<Recording>((resolve, reject) => {
            recorder.onstop = (): void => {
                const blob = new Blob(this.chunks, {
                    type: recorder.mimeType,
                });
                const duration = this.before;
                this.release();
                this.recording(blob, recorder.mimeType, duration).then(
                    (made) => {
                        this.events.emit('stop', made);
                        resolve(made);
                    },
                    reject,
                );
            };
        });

        // A recorder may stop at once, before this returns: the promise is kept apart for that.
        this.stopping = stopping;
        recorder.stop();

        return stopping;
    }

    /** Drops the recording under way (or the request for the microphone); nothing is given back. */
    cancel(): void {
        this.attempt++;
        this.release();
    }

    /** Cancels, and stops every listener. */
    destroy(): void {
        this.cancel();
        this.events.clear();
    }

    /** Records `stream`: the recorder, the level reader and the clock. */
    private begin(stream: MediaStream): void {
        this.stream = stream;
        this.chunks = [];
        this.size = 0;
        this.before = 0;
        this.levels.clear();

        try {
            const recorder = new MediaRecorder(stream, this.recorderOptions());
            recorder.ondataavailable = (event): void => this.keep(event.data);
            recorder.onerror = (): void => this.fail(new RecordError('failed'));
            recorder.start(TIMESLICE);
            this.recorder = recorder;
        } catch {
            this.release();

            throw new RecordError('failed');
        }

        this.tap = tapStream(stream);
        this.samples = new Float32Array(this.tap?.analyser.fftSize ?? 0);
        this.run();
    }

    private recorderOptions(): MediaRecorderOptions {
        const asked = this.options.mimeType;
        const candidates =
            typeof asked === 'string'
                ? [asked]
                : (asked ?? DEFAULT_RECORD_TYPES);
        const mimeType =
            pickMimeType(candidates, (type) =>
                MediaRecorder.isTypeSupported(type),
            ) ?? undefined;
        const made: MediaRecorderOptions = {};

        if (mimeType !== undefined) {
            made.mimeType = mimeType;
        }

        if (this.options.audioBitsPerSecond !== undefined) {
            made.audioBitsPerSecond = this.options.audioBitsPerSecond;
        }

        return made;
    }

    /** Keeps a chunk; past the size cap, recording stops with an error. */
    private keep(chunk: Blob): void {
        this.chunks.push(chunk);
        this.size += chunk.size;

        if (this.size > this.maxBytes) {
            this.fail(new RecordError('too-large'));
        }
    }

    private fail(error: RecordError): void {
        this.release();
        this.events.emit('error', error);
    }

    /** Starts the clock, the level reader and the limit. */
    private run(): void {
        this.phase = 'recording';
        this.since = performance.now();
        this.timer = setTimeout(
            () => this.reachLimit(),
            (this.limit - this.before) * 1000,
        );
        this.frame = requestAnimationFrame(this.listen);
    }

    /** Stops the clock's frame and the limit's timer. */
    private still(): void {
        cancelAnimationFrame(this.frame);
        clearTimeout(this.timer);
        this.timer = undefined;
    }

    /** Reads the level once a frame. */
    private readonly listen = (): void => {
        const analyser = this.tap?.analyser;

        if (analyser !== undefined) {
            analyser.getFloatTimeDomainData(this.samples);
            const level = levelOf(this.samples);
            const seconds = this.seconds;
            this.levels.add(seconds, level);
            this.events.emit('level', level, seconds);
        }

        this.frame = requestAnimationFrame(this.listen);
    };

    private reachLimit(): void {
        if (this.phase === 'recording') {
            this.events.emit('limit');
            this.stop().catch(() => undefined);
        }
    }

    /** The recording, its peaks decoded when asked and possible. */
    private async recording(
        blob: Blob,
        type: string,
        duration: number,
    ): Promise<Recording> {
        let peaks: readonly number[] = [...this.levels.levels];

        if (this.options.decode !== false) {
            try {
                const decoded = await decodeAudio(blob);
                peaks = peaksFromChannel(
                    decoded.samples,
                    within(this.options.peaks, 1000, 1, 100_000, Math.round),
                );
            } catch {
                // The live levels stay.
            }
        }

        return { blob, type, duration, peaks, size: blob.size };
    }

    /** Lets everything go: the clock, the recorder, the level reader and the microphone. */
    private release(): void {
        this.still();
        const recorder = this.recorder;
        this.recorder = null;

        // Dropped: its last chunk is not kept (nor counted against the size cap).
        if (recorder !== null && this.stopping === null) {
            recorder.ondataavailable = null;

            try {
                recorder.stop();
            } catch {
                // Already stopped.
            }
        }

        this.tap?.release();
        this.tap = null;

        if (this.stream !== null) {
            closeMicrophone(this.stream);
            this.stream = null;
        }

        this.stopping = null;
        this.phase = 'idle';
    }
}
