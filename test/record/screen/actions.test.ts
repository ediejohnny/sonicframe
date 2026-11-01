/**
 * The app's own buttons on the recorder's screen (`actions`): placed by name in the lists of each
 * stage, named for screen readers, drawn with the app's icon, handed the recording on a press, busy
 * while sending, and leading the stage when marked as its main button.
 */

import { describe, expect, it, vi } from 'vite-plus/test';
import type { Recording, RecorderScreen } from '../../../src/record';
import { parts, press, screen, useRecordingPage } from './screen-harness';

useRecordingPage();

/** The app's button of `name` in the screen, or null. */
function action(made: RecorderScreen, name: string): HTMLButtonElement | null {
    return made.element.querySelector<HTMLButtonElement>(
        `.sonicframe-action-${name}`,
    );
}

describe("the app's own buttons", () => {
    it('show where their names are listed, named, with their icons, and hand over the recording', async () => {
        const pressed: [Recording | null, RecorderScreen][] = [];
        const { made } = screen({
            actions: {
                save: {
                    label: 'Save the note',
                    icon: 'M5 5h14v14H5z',
                    press: (recording, from) => pressed.push([recording, from]),
                },
            },
            parts: {
                idle: ['record', 'save'],
                review: ['discard', 'player', 'save'],
            },
        });

        expect(parts(made)).toEqual(['record', 'action']);
        expect(action(made, 'save')?.getAttribute('aria-label')).toBe(
            'Save the note',
        );
        expect(
            action(made, 'save')?.querySelector('path')?.getAttribute('d'),
        ).toBe('M5 5h14v14H5z');
        action(made, 'save')?.click();
        expect(pressed).toEqual([[null, made]]);

        await press(made, 'record');
        await press(made, 'stop');
        action(made, 'save')?.click();
        expect(pressed[1]).toEqual([made.recording, made]);
        expect(made.recording).not.toBeNull();
    });

    it('never take the name of an icon of the screen (cancel, resume), which a tag would share with it', () => {
        const own = { label: 'Mine', press: () => undefined };
        const { made } = screen({
            actions: { cancel: own, resume: own, keep: own },
            parts: { idle: ['cancel', 'resume', 'keep', 'record'] },
        });

        expect(parts(made)).toEqual(['action', 'record']);
        expect(action(made, 'keep')).not.toBeNull();
    });

    it('lead the stage when marked main, taking the focus', async () => {
        const { made } = screen({
            actions: {
                save: { label: 'Save', main: true, press: () => undefined },
            },
            parts: { review: ['discard', 'player', 'save'] },
        });
        made.element
            .querySelector<HTMLButtonElement>('.sonicframe-record')
            ?.focus();
        await press(made, 'record');
        await press(made, 'stop');

        expect(document.activeElement).toBe(action(made, 'save'));
    });

    it('are busy while the recording is sent, and a press then does nothing', async () => {
        const save = vi.fn();
        const { made } = screen({
            actions: { save: { label: 'Save', press: save } },
            parts: { review: ['discard', 'player', 'send', 'save'] },
            onSend: () => new Promise<void>(() => undefined),
        });
        await press(made, 'record');
        await press(made, 'stop');
        await press(made, 'send');
        action(made, 'save')?.click();

        expect(action(made, 'save')?.getAttribute('aria-disabled')).toBe(
            'true',
        );
        expect(save).not.toHaveBeenCalled();
    });

    it('skip names that are not allowed, built-in parts and names nobody gave', () => {
        // The longest name allowed: 32 characters.
        const long = `a${'b-'.repeat(15)}c`;
        const { made } = screen({
            actions: {
                'Not A Name': { label: 'Bad', press: () => undefined },
                record: { label: 'Mine', press: () => undefined },
                [long]: { label: 'Long', press: () => undefined },
                [`${long}a`]: { label: 'Too long', press: () => undefined },
            },
            parts: {
                idle: [
                    'record',
                    'Not A Name',
                    'nobody',
                    'constructor',
                    long,
                    `${long}a`,
                ],
            },
        });

        expect(parts(made)).toEqual(['record', 'action']);
        expect(action(made, long)?.getAttribute('aria-label')).toBe('Long');
        expect(
            made.element
                .querySelector('.sonicframe-record')
                ?.getAttribute('aria-label'),
        ).toBe('Record');
    });

    it('clean their labels, and fall back on their name and a plain icon', () => {
        const { made } = screen({
            actions: {
                share: {
                    label: `${String.fromCharCode(0)}Share${'!'.repeat(200)}`,
                    icon: 'url(#x)',
                    press: () => undefined,
                },
                keep: { label: ' ', press: () => undefined },
                count: {
                    label: 7 as unknown as string,
                    press: () => undefined,
                },
            },
            parts: { idle: ['share', 'keep', 'count'] },
        });

        expect(action(made, 'share')?.getAttribute('aria-label')).toBe(
            `Share${'!'.repeat(115)}`,
        );
        expect(
            action(made, 'share')?.querySelector('path')?.getAttribute('d'),
        ).toBe('M12 9a3 3 0 1 1 0 6a3 3 0 1 1 0-6z');
        expect(action(made, 'keep')?.getAttribute('aria-label')).toBe('keep');
        expect(action(made, 'count')?.getAttribute('aria-label')).toBe('count');
    });
});
