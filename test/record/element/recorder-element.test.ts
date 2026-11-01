/**
 * `<sonic-recorder>`: nothing is registered on import; once defined, its attributes build the
 * recorder's screen, untrusted values fall back, the screen's events reach the element, and taking
 * the element off the page lets the microphone go.
 */

import { describe, expect, it, vi } from 'vite-plus/test';
import { PALETTES } from '../../../src/player';
import { defineSonicRecorder, type Recording } from '../../../src/record';
import { afterTest } from '../../support/helpers';
import { stubMicrophone } from '../../support/recording';
import { liveWaveFeed, useRecordingPage } from '../screen/screen-harness';

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
