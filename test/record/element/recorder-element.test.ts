/**
 * `<sonic-recorder>`: nothing is registered on import; once defined, its attributes build the
 * recorder's screen, untrusted values fall back, the screen's events reach the element, and taking
 * the element off the page lets the microphone go.
 */

import { describe, expect, it, vi } from 'vite-plus/test';
import { PALETTES } from '../../../src/player';
import { defineSonicRecorder, type Recording } from '../../../src/record';
import { recorderOptionsOf } from '../../../src/record/element/recorder-element';
import { recordAnimations } from '../../support/animations';
import { afterTest } from '../../support/helpers';
import { stubMicrophone } from '../../support/recording';
import { FakeRequest, stubRequests } from '../../support/upload';
import {
    layOut,
    liveWaveFeed,
    shiftOf,
    useRecordingPage,
} from '../screen/screen-harness';

useRecordingPage();

/** A `<sonic-recorder>` of `attributes` on the page, taken off after the test. */
function tag(attributes: Record<string, string> = {}): HTMLElement {
    const element = document.createElement('sonic-recorder');

    for (const [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, value);
    }

    document.body.append(element);
    afterTest({ destroy: () => element.remove() });

    return element;
}

/** Presses the button of `name` in the tag, and lets what it started settle. */
async function press(element: HTMLElement, name: string): Promise<void> {
    element.querySelector<HTMLButtonElement>(`.sonicframe-${name}`)?.click();
    await vi.advanceTimersByTimeAsync(0);
}

/** The parts the tag's screen shows now. */
function parts(element: HTMLElement): string[] {
    const row = element.querySelector('.sonicframe-recorder-row');

    return [...(row?.children ?? [])].map(
        (part) =>
            part.className
                .replace(/^sonicframe-(recorder-)?/, '')
                .split(' ')[0],
    );
}

describe('the <sonic-recorder> tag', () => {
    it('does nothing until defined, then builds the screen', () => {
        stubMicrophone();
        const element = tag();
        expect(element.querySelector('.sonicframe-recorder')).toBeNull();

        expect(defineSonicRecorder()).toBe(true);
        expect(element.querySelector('.sonicframe-recorder')).not.toBeNull();

        expect(defineSonicRecorder()).toBe(false);
        expect(defineSonicRecorder('nodash')).toBe(false);
    });

    it('reads its language, its parts and its time limit', async () => {
        stubMicrophone();
        const element = tag({
            'a11y-lang': 'pt',
            'idle-parts': 'spacer record',
            'recording-parts': 'time  stop shout',
            'review-parts': 'player send',
            max: '2',
        });
        expect(parts(element)).toEqual(['spacer', 'record']);
        expect(
            element
                .querySelector('.sonicframe-record')
                ?.getAttribute('aria-label'),
        ).toBe('Gravar');

        await press(element, 'record');
        expect(parts(element)).toEqual(['time', 'stop']);

        await vi.advanceTimersByTimeAsync(2100);
        expect(parts(element)).toEqual(['player', 'send']);
    });

    it('reads how its live wave moves, and how far it shows', async () => {
        const fed = liveWaveFeed();
        stubMicrophone();

        await press(tag({ live: 'fit' }), 'record');
        await vi.advanceTimersByTimeAsync(500);
        // Half a second of 20 slices.
        expect(fed.at(-1)?.length).toBe(10);

        await press(tag({ window: '2' }), 'record');
        await vi.advanceTimersByTimeAsync(500);
        expect(fed.at(-1)?.length).toBe(40);
    });

    it('wears its palette, records while held, and says the time when asked', async () => {
        stubMicrophone();
        const element = tag({
            palette: 'ocean',
            hold: '',
            'a11y-announce-every': '2',
        });
        expect(
            element
                .querySelector<HTMLElement>('.sonicframe-recorder')
                ?.style.getPropertyValue('--sonicframe-surface'),
        ).toBe(PALETTES.ocean.surface);

        element
            .querySelector('.sonicframe-record')
            ?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        await vi.advanceTimersByTimeAsync(2100);
        expect(document.querySelector('[role="status"]')?.textContent).toBe(
            '0:02 recorded',
        );

        document.dispatchEvent(
            new PointerEvent('pointerup', { bubbles: true }),
        );
        await vi.advanceTimersByTimeAsync(0);
        expect(parts(element)).toEqual(['discard', 'player', 'send']);
    });

    it('reads what comes after a stop, its own icons, and how the parts line up', async () => {
        stubMicrophone();
        const recorded: unknown[] = [];
        const element = tag({
            'after-stop': 'none',
            'icon-record': 'M1 1h22v22H1z',
            'icon-stop': 'M0 0"/><script>',
        });
        element.addEventListener('sonicframe:recorded', (event) =>
            recorded.push(event),
        );
        expect(
            element.querySelector('.sonicframe-record path')?.getAttribute('d'),
        ).toBe('M1 1h22v22H1z');

        await press(element, 'record');
        expect(
            element.querySelector('.sonicframe-stop path')?.getAttribute('d'),
        ).toBe('M7 7h10v10H7z');
        await press(element, 'stop');
        expect(parts(element)).toEqual(['record']);
        expect(recorded).toHaveLength(1);

        const centered = tag({ align: 'center' });
        await press(centered, 'record');
        layOut();
        await press(centered, 'stop');
        expect(shiftOf(centered, 'send')).toBe('');
    });

    it("shows the page's own buttons and tells the page when one is pressed", async () => {
        stubMicrophone();
        const element = tag({
            actions: 'save:Save: the note, share , Bad:No',
            'icon-save': 'M5 5h14v14H5z',
            'review-parts': 'discard player save share Bad',
        });
        const heard: unknown[][] = [];
        element.addEventListener('sonicframe:action', (event) =>
            heard.push((event as CustomEvent<unknown[]>).detail),
        );
        await press(element, 'record');
        await press(element, 'stop');

        expect(parts(element)).toEqual([
            'discard',
            'player',
            'action',
            'action',
        ]);
        const save = element.querySelector('.sonicframe-action-save');
        expect(save?.getAttribute('aria-label')).toBe('Save: the note');
        expect(save?.querySelector('path')?.getAttribute('d')).toBe(
            'M5 5h14v14H5z',
        );
        expect(
            element
                .querySelector('.sonicframe-action-share')
                ?.getAttribute('aria-label'),
        ).toBe('share');

        (save as HTMLButtonElement).click();
        expect(heard).toHaveLength(1);
        expect(heard[0][0]).toBe('save');
        expect((heard[0][1] as Recording).blob).toBeInstanceOf(Blob);
    });

    it("sends to the page's address, lets a send be canceled, and tells the page how it went", async () => {
        stubMicrophone();
        stubRequests();
        const element = tag({
            'upload-url': '/voice',
            'upload-method': 'PUT',
            'upload-field': 'note',
            'cancel-send': '',
            'icon-cancel': 'M2 2h20v20H2z',
        });
        const heard: unknown[][] = [];

        for (const name of ['progress', 'uploaded']) {
            element.addEventListener(`sonicframe:${name}`, (event) =>
                heard.push([name, ...(event as CustomEvent<unknown[]>).detail]),
            );
        }

        await press(element, 'record');
        await press(element, 'stop');
        await press(element, 'send');
        const asked = FakeRequest.made[0];
        expect(asked.method).toBe('PUT');
        expect(asked.url).toBe('/voice');
        expect((asked.body as FormData).has('note')).toBe(true);
        const cancel = element.querySelector('.sonicframe-send');
        expect(cancel?.getAttribute('aria-label')).toBe('Cancel sending');
        expect(cancel?.querySelector('path')?.getAttribute('d')).toBe(
            'M2 2h20v20H2z',
        );

        asked.progress(1, 4);
        asked.answer(200, 'ok');
        await vi.advanceTimersByTimeAsync(0);
        expect(heard).toEqual([
            ['progress', 0.25],
            ['uploaded', { status: 200, body: 'ok' }],
        ]);
    });

    it('reads the record button’s style, its red, where REC shows and whether it blinks', async () => {
        stubMicrophone();
        const started = recordAnimations();
        const element = tag({
            'record-style': 'rec',
            'record-color': '#00ff00',
            'rec-place': 'time',
            'record-blink': '',
        });
        const record = element.querySelector<HTMLElement>('.sonicframe-record');
        expect(record?.querySelector('.sonicframe-rec-letters')).not.toBeNull();
        expect(record?.style.getPropertyValue('color')).toBe(
            'rgba(0, 255, 0, 1)',
        );

        await press(element, 'record');
        expect(parts(element)).toEqual([
            'discard',
            'rec',
            'wave',
            'pause',
            'stop',
        ]);
        expect(started).toHaveLength(1);

        // The microphone, filled, in the player's colors.
        const mic = tag({
            'record-style': 'mic',
            'mic-style': 'filled',
            'mic-color': 'theme',
        });
        expect(
            mic
                .querySelector<HTMLElement>('.sonicframe-record')
                ?.style.getPropertyValue('background-color'),
        ).toMatch(/^var\(--sonicframe-button,/);
        expect(
            mic.querySelector('.sonicframe-record path')?.getAttribute('d'),
        ).toBe(
            'M12 2a3.5 3.5 0 0 1 3.5 3.5v6a3.5 3.5 0 0 1 -7 0V5.5a3.5 3.5 0 0 1 3.5 -3.5zM5 11.5a7 7 0 0 0 14 0h-1.75a5.25 5.25 0 0 1 -10.5 0zM11.125 18.3h1.75V22h-1.75z',
        );
    });

    it('falls back on a time limit that is empty, not 0 seconds', async () => {
        stubMicrophone();
        const element = tag({ max: ' ' });
        await press(element, 'record');
        await vi.advanceTimersByTimeAsync(10_000);

        expect(parts(element)).toEqual([
            'discard',
            'time',
            'wave',
            'pause',
            'stop',
        ]);
    });

    it('dispatches the screen’s events on the element', async () => {
        stubMicrophone();
        const element = tag();
        const heard: string[] = [];
        let recorded: Recording | null = null;

        for (const name of ['state', 'recorded', 'send', 'sent']) {
            element.addEventListener(`sonicframe:${name}`, (event) => {
                const [first] = (event as CustomEvent<unknown[]>).detail;
                heard.push(name === 'state' ? String(first) : name);

                if (name === 'recorded') {
                    recorded = first as Recording;
                }
            });
        }

        await press(element, 'record');
        await press(element, 'stop');
        await press(element, 'send');

        expect(heard).toEqual([
            'asking',
            'recording',
            'review',
            'recorded',
            'sending',
            'send',
            'idle',
            'sent',
        ]);
        expect(recorded).not.toBeNull();

        stubMicrophone(new DOMException('no', 'NotAllowedError'));
        const blocked = tag();
        const errors: unknown[] = [];
        blocked.addEventListener('sonicframe:error', (event) =>
            errors.push((event as CustomEvent<unknown[]>).detail[0]),
        );
        await press(blocked, 'record');
        expect(errors.length).toBe(1);
    });

    it('keeps the recording after sending with keep', async () => {
        stubMicrophone();
        const element = tag({ keep: '' });
        await press(element, 'record');
        await press(element, 'stop');
        await press(element, 'send');

        expect(parts(element)).toEqual(['discard', 'player', 'send']);
    });

    it('lets the microphone go when taken off the page, and builds again when put back', async () => {
        const microphone = stubMicrophone();
        const element = tag();
        await press(element, 'record');
        element.remove();

        expect(microphone.streams[0].track.stopped).toBe(true);
        expect(element.querySelector('.sonicframe-recorder')).toBeNull();

        document.body.append(element);
        expect(parts(element)).toEqual(['record']);
    });

    it('builds again when an attribute changes', () => {
        stubMicrophone();
        const element = tag();
        element.setAttribute('a11y-lang', 'es');

        expect(element.querySelectorAll('.sonicframe-recorder').length).toBe(1);
        expect(
            element
                .querySelector('.sonicframe-record')
                ?.getAttribute('aria-label'),
        ).toBe('Grabar');
    });
});

describe('the names of 0.7, with the old ones kept until 2.0', () => {
    it('stops at max-seconds, over the old max', async () => {
        stubMicrophone();
        const element = tag({ 'max-seconds': '2', max: '5' });
        await press(element, 'record');
        await vi.advanceTimersByTimeAsync(2100);

        expect(parts(element)).toEqual(['discard', 'player', 'send']);
    });

    it('keeps or resets after a send by after-send, over the old keep', async () => {
        stubMicrophone();
        const cases: [Record<string, string>, string[]][] = [
            [{ 'after-send': 'keep' }, ['discard', 'player', 'send']],
            [{ 'after-send': 'reset', keep: '' }, ['record']],
            [{ 'after-send': 'later', keep: '' }, ['record']],
        ];

        for (const [attributes, after] of cases) {
            const element = tag(attributes);
            await press(element, 'record');
            await press(element, 'stop');
            await press(element, 'send');

            expect(parts(element)).toEqual(after);
        }
    });

    it('shows live-seconds of the scrolling wave, over the old window', async () => {
        const fed = liveWaveFeed();
        stubMicrophone();
        await press(tag({ 'live-seconds': '2', window: '5' }), 'record');
        await vi.advanceTimersByTimeAsync(500);

        // 2 seconds of 20 slices.
        expect(fed.at(-1)?.length).toBe(40);
    });

    it('blinks its REC dot with rec-blink', async () => {
        stubMicrophone();
        const started = recordAnimations();
        await press(tag({ 'record-style': 'rec', 'rec-blink': '' }), 'record');

        expect(started).toHaveLength(1);
    });

    it('dispatches statechange, and the old state too', async () => {
        stubMicrophone();
        const element = tag();
        const heard: string[] = [];

        for (const name of ['statechange', 'state']) {
            element.addEventListener(`sonicframe:${name}`, (event) =>
                heard.push(
                    `${name} ${String((event as CustomEvent<unknown[]>).detail[0])}`,
                ),
            );
        }

        await press(element, 'record');

        expect(heard).toEqual([
            'statechange asking',
            'state asking',
            'statechange recording',
            'state recording',
        ]);
    });

    it('reads its drawing and its font as the player tag does', () => {
        const element = document.createElement('sonic-recorder');
        element.setAttribute('wave', 'line');
        element.setAttribute('font', 'Georgia');

        expect(recorderOptionsOf(element)).toMatchObject({
            wave: 'line',
            font: 'Georgia',
        });
    });

    it('builds again when one of its new attributes changes', () => {
        stubMicrophone();

        for (const [name, value] of [
            ['max-seconds', '2'],
            ['live-seconds', '2'],
            ['after-send', 'keep'],
            ['rec-blink', ''],
            ['wave', 'line'],
            ['font', 'Georgia'],
        ]) {
            const element = tag();
            const before = element.querySelector('.sonicframe-recorder');
            element.setAttribute(name, value);

            expect(element.querySelector('.sonicframe-recorder')).not.toBe(
                before,
            );
        }
    });

    it("builds again when the icon of one of the page's buttons changes", async () => {
        stubMicrophone();
        const element = tag({
            actions: 'save:Save',
            'icon-save': 'M5 5h14v14H5z',
            'idle-parts': 'save record',
        });
        element.setAttribute('icon-save', 'M2 2h20v20H2z');
        await vi.advanceTimersByTimeAsync(0);

        expect(
            element
                .querySelector('.sonicframe-action-save path')
                ?.getAttribute('d'),
        ).toBe('M2 2h20v20H2z');
    });
});
