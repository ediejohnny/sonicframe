/**
 * Recording from the microphone without a screen: nothing is asked before `start`, a refusal says
 * why, the clock counts only the time recorded, the levels follow the microphone, the recording
 * comes back with its length and peaks, the limit and the size cap stop it, and every way out lets
 * the microphone go.
 */

import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vite-plus/test';
import {
    RecordError,
    Recorder,
    type Recording,
    type RecorderOptions,
} from '../../../src/record';
import { afterTest } from '../../support/helpers';
import {
    FakeAnalyser,
    FakeAudioContext,
    FakeRecorder,
    stubDecoder,
    stubMicrophone,
    stubRecording,
    type Answer,
} from '../../support/recording';

beforeEach(() => {
    vi.useFakeTimers({
        toFake: [
            'setTimeout',
            'clearTimeout',
            'requestAnimationFrame',
            'cancelAnimationFrame',
            'performance',
        ],
    });
    stubRecording();
});

afterEach(() => {
    vi.useRealTimers();
});

/** A recorder of `options` (no decoding unless asked), destroyed after the test. */
function recorder(options: RecorderOptions = {}): Recorder {
    return afterTest(new Recorder({ decode: false, ...options }));
}

/** A recorder already recording, with the microphone's answer and its stand-ins. */
async function recording(
    options: RecorderOptions = {},
    answer: Answer = 'grant',
): Promise<{ made: Recorder; microphone: ReturnType<typeof stubMicrophone> }> {
    const microphone = stubMicrophone(answer);
    const made = recorder(options);
    await made.start();

    return { made, microphone };
}

/** The reason a promise was refused with, or 'resolved'. */
async function reasonOf(promise: Promise<unknown>): Promise<string> {
    try {
        await promise;

        return 'resolved';
    } catch (error) {
        return error instanceof RecordError ? error.reason : String(error);
    }
}

describe('Recorder', () => {
    it('asks for nothing until started', () => {
        const microphone = stubMicrophone();
        const made = recorder();

        expect(microphone.asked).toEqual([]);
        expect(made.state).toBe('idle');
    });

    it('asks for the microphone with echo, noise and gain control, then records Opus in WebM', async () => {
        const { made, microphone } = await recording({
            constraints: { channelCount: 1, noiseSuppression: false },
            audioBitsPerSecond: 64_000,
        });

        expect(microphone.asked).toEqual([
            {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: false,
                    autoGainControl: true,
                    channelCount: 1,
                },
            },
        ]);
        expect(made.state).toBe('recording');

        // Started again while recording, it asks nothing more.
        await made.start();
        expect(microphone.asked.length).toBe(1);
        expect(FakeRecorder.made.length).toBe(1);
        expect(FakeRecorder.made[0].options).toEqual({
            mimeType: 'audio/webm;codecs=opus',
            audioBitsPerSecond: 64_000,
        });
        expect(FakeRecorder.made[0].timeslice).toBe(1000);
    });

    it('records the first format the browser can, or lets it choose', async () => {
        FakeRecorder.supported = (type) => type === 'audio/mp4';
        await recording();
        expect(FakeRecorder.made[0].options.mimeType).toBe('audio/mp4');

        FakeRecorder.supported = () => false;
        await recording();
        expect(FakeRecorder.made[1].options.mimeType).toBeUndefined();

        FakeRecorder.supported = (type) => type === 'audio/wav';
        await recording({ mimeType: ['audio/flac', 'audio/wav'] });
        expect(FakeRecorder.made[2].options.mimeType).toBe('audio/wav');
    });

    it('says the microphone was blocked, or missing, and records nothing', async () => {
        const blocked = stubMicrophone(
            new DOMException('no', 'NotAllowedError'),
        );
        const made = recorder();

        expect(await reasonOf(made.start())).toBe('denied');
        expect(made.state).toBe('idle');
        expect(blocked.asked.length).toBe(1);

        stubMicrophone(new DOMException('none', 'NotFoundError'));
        expect(await reasonOf(recorder().start())).toBe('missing');
        expect(FakeRecorder.made).toEqual([]);
    });

    it('says a page without HTTPS cannot record, and a browser without a recorder either, asking nothing', async () => {
        const secure = (value: boolean): void => {
            Object.defineProperty(window, 'isSecureContext', {
                configurable: true,
                value,
            });
        };
        afterTest({
            destroy: () => Reflect.deleteProperty(window, 'isSecureContext'),
        });
        secure(false);
        expect(await reasonOf(recorder().start())).toBe('insecure');

        secure(true);
        expect(await reasonOf(recorder().start())).toBe('unsupported');

        const microphone = stubMicrophone();
        vi.stubGlobal('MediaRecorder', undefined);
        expect(await reasonOf(recorder().start())).toBe('unsupported');
        expect(microphone.asked).toEqual([]);
    });

    it('lets the microphone go when the recorder cannot start', async () => {
        FakeRecorder.failStart = true;
        const microphone = stubMicrophone();
        const made = recorder();

        expect(await reasonOf(made.start())).toBe('failed');
        expect(microphone.streams[0].track.stopped).toBe(true);
        expect(made.state).toBe('idle');
    });

    it('follows the level of the microphone, and never sends it to the speakers', async () => {
        const heard: number[] = [];
        const { made } = await recording({ rate: 10 });
        made.on('level', (level) => heard.push(level));
        FakeAnalyser.level = 0.75;
        vi.advanceTimersByTime(1000);

        expect(heard.length).toBeGreaterThan(30);
        expect(heard.every((level) => level === 0.75)).toBe(true);
        expect(made.levels.levels.length).toBe(10);
        expect(FakeAudioContext.analysers[0].connected).toEqual([]);
    });

    it('counts only the time recorded, not the time paused', async () => {
        const { made } = await recording();
        vi.advanceTimersByTime(1000);
        made.pause();
        expect(made.state).toBe('paused');
        expect(FakeRecorder.made[0].state).toBe('paused');

        const heard: number[] = [];
        const stop = made.on('level', (level) => heard.push(level));
        vi.advanceTimersByTime(5000);
        expect(heard).toEqual([]);
        stop();
        made.resume();
        expect(FakeRecorder.made[0].state).toBe('recording');
        vi.advanceTimersByTime(1500);

        expect(made.seconds).toBeCloseTo(2.5, 2);
    });

    it('gives the recording back: its sound, type, length, size and the live levels as peaks', async () => {
        const { made, microphone } = await recording({ rate: 10 });
        const stopped: Recording[] = [];
        made.on('stop', (made) => stopped.push(made));
        FakeRecorder.made[0].give(5);
        vi.advanceTimersByTime(1000);

        const result = await made.stop();

        expect(result.size).toBe(8);
        expect(result.blob.size).toBe(8);
        expect(result.duration).toBeCloseTo(1, 2);
        expect(result.peaks).toEqual(made.levels.levels);
        expect(result.peaks.length).toBe(10);
        expect(stopped).toEqual([result]);
        expect(made.state).toBe('idle');
        expect(microphone.streams[0].track.stopped).toBe(true);
        expect(FakeAudioContext.sources[0].disconnected).toBe(true);
    });

    it('names the type the recorder chose, when it chose one itself', async () => {
        FakeRecorder.supported = () => false;
        const { made } = await recording();
        Object.defineProperty(FakeRecorder.made[0], 'mimeType', {
            value: 'audio/webm',
        });

        const result = await made.stop();
        expect(result.type).toBe('audio/webm');
        expect(result.blob.type).toBe('audio/webm');
    });

    it('decodes the recording for its exact peaks, or keeps the live levels when it cannot', async () => {
        stubDecoder([0, 0.5, -1, 0.25]);
        const exact = await recording({ decode: true, peaks: 2 });
        vi.advanceTimersByTime(500);
        expect((await exact.made.stop()).peaks).toEqual([0.5, 1]);

        stubDecoder(Array.from({ length: 3000 }, (_, at) => (at % 3) / 2));
        const usual = await recording({ decode: true });
        vi.advanceTimersByTime(500);
        expect((await usual.made.stop()).peaks.length).toBe(1000);

        const off = await recording({ decode: false, rate: 10 });
        vi.advanceTimersByTime(300);
        expect((await off.made.stop()).peaks).toEqual([0.5, 0.5, 0.5]);

        stubDecoder(new Error('cannot decode'));
        const live = await recording({ decode: true, peaks: 2, rate: 10 });
        vi.advanceTimersByTime(500);
        const kept = await live.made.stop();
        expect(kept.peaks).toEqual([0.5, 0.5, 0.5, 0.5, 0.5]);
    });

    it('stops on its own at its limit, saying so', async () => {
        const { made, microphone } = await recording({ maxSeconds: 2 });
        const events: string[] = [];
        made.on('limit', () => events.push('limit'));
        made.on('stop', (result) => events.push(`stop ${result.duration}`));
        vi.advanceTimersByTime(2500);
        await vi.runAllTimersAsync();

        expect(events).toEqual(['limit', 'stop 2']);
        expect(made.state).toBe('idle');
        expect(microphone.streams[0].track.stopped).toBe(true);
    });

    it('stops at the limit counting only the time recorded', async () => {
        const { made } = await recording({ maxSeconds: 2 });
        const events: string[] = [];
        made.on('limit', () => events.push('limit'));
        vi.advanceTimersByTime(1500);
        made.pause();
        vi.advanceTimersByTime(5000);
        expect(events).toEqual([]);

        made.resume();
        vi.advanceTimersByTime(600);
        expect(events).toEqual(['limit']);
    });

    it('stops with an error past the size cap', async () => {
        const { made, microphone } = await recording({ maxBytes: 10 });
        const errors: string[] = [];
        made.on('error', (error) => errors.push(error.reason));
        FakeRecorder.made[0].give(6);
        expect(errors).toEqual([]);

        FakeRecorder.made[0].give(5);

        expect(errors).toEqual(['too-large']);
        expect(made.state).toBe('idle');
        expect(microphone.streams[0].track.stopped).toBe(true);
    });

    it('stops with an error when the browser’s recorder breaks', async () => {
        const { made, microphone } = await recording();
        const errors: string[] = [];
        made.on('error', (error) => errors.push(error.reason));
        FakeRecorder.made[0].onerror?.();

        expect(errors).toEqual(['failed']);
        expect(made.state).toBe('idle');
        expect(microphone.streams[0].track.stopped).toBe(true);
    });

    it('drops the recording on cancel, letting the microphone go and giving nothing back', async () => {
        // The recorder's last chunk (3 bytes) would pass this cap: dropped, it is not counted.
        const { made, microphone } = await recording({ maxBytes: 2 });
        const heard: unknown[] = [];
        made.on('stop', (result) => heard.push(result));
        made.on('error', (error) => heard.push(error));
        made.cancel();

        expect(made.state).toBe('idle');
        expect(microphone.streams[0].track.stopped).toBe(true);
        expect(FakeRecorder.made[0].state).toBe('inactive');
        expect(heard).toEqual([]);
        expect(await reasonOf(made.stop())).toMatch(
            /nothing is being recorded/,
        );
    });

    it('lets go of a microphone granted after a cancel', async () => {
        const microphone = stubMicrophone('pending');
        const made = recorder();
        const started = made.start();
        expect(made.state).toBe('asking');

        made.cancel();
        microphone.grant();
        await started;

        expect(made.state).toBe('idle');
        expect(microphone.streams[0].track.stopped).toBe(true);
        expect(FakeRecorder.made).toEqual([]);
    });

    it('lets the microphone go and stops listening when destroyed', async () => {
        const { made, microphone } = await recording();
        const heard: number[] = [];
        made.on('level', (level) => heard.push(level));
        made.destroy();
        vi.advanceTimersByTime(1000);

        expect(microphone.streams[0].track.stopped).toBe(true);
        expect(heard).toEqual([]);

        // Even recording again, the listeners from before the destroy hear nothing.
        await made.start();
        vi.advanceTimersByTime(1000);
        expect(heard).toEqual([]);
    });
});

describe('the names of 0.7, with the old ones kept until 2.0', () => {
    it('decodes as many peaks as decode.peakCount asks, over the old peaks', async () => {
        stubDecoder([0, 0.5, -1, 0.25]);
        const fresh = await recording({ decode: { peakCount: 2 }, peaks: 4 });
        vi.advanceTimersByTime(500);
        expect((await fresh.made.stop()).peaks).toEqual([0.5, 1]);

        const old = await recording({ decode: true, peaks: 4 });
        vi.advanceTimersByTime(500);
        expect((await old.made.stop()).peaks).toEqual([0, 0.5, 1, 0.25]);
    });

    it('keeps levelsPerSecond live levels a second, over the old rate', async () => {
        const fresh = await recording({ levelsPerSecond: 10, rate: 30 });
        vi.advanceTimersByTime(1000);
        expect(fresh.made.levels.levels.length).toBe(10);

        expect(recorder({ rate: 30 }).levels.rate).toBe(30);
        expect(recorder().levels.rate).toBe(20);
    });

    it('tries the formats of mimeTypes, over the old mimeType, and names the one recorded as mimeType', async () => {
        FakeRecorder.supported = (type) =>
            type === 'audio/wav' || type === 'audio/flac';
        const fresh = await recording({
            mimeTypes: 'audio/wav',
            mimeType: 'audio/flac',
        });
        expect(FakeRecorder.made[0].options.mimeType).toBe('audio/wav');
        Object.defineProperty(FakeRecorder.made[0], 'mimeType', {
            value: 'audio/wav',
        });
        const made = await fresh.made.stop();

        expect([made.mimeType, made.type]).toEqual(['audio/wav', 'audio/wav']);
    });
});
