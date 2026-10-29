/**
 * The volume control on the page: the speaker button mutes and unmutes (bringing the level back),
 * the bar is a keyboard slider that speaks the level, a press on the bar sets the level under the
 * pointer, a change made elsewhere shows up, the focus ring takes only a color property, and
 * destroy() leaves nothing behind.
 */

import { afterEach, describe, expect, it } from 'vite-plus/test';
import { VolumeControl } from '../../src/index';
import { boxOf, fakeMedia, focusRing } from './helpers';

let control: VolumeControl | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
    control?.destroy();
    host?.remove();
    control = null;
    host = null;
});

function setup(
    media = fakeMedia({ duration: 10 }),
): ReturnType<typeof fakeMedia> {
    host = document.createElement('div');
    document.body.append(host);
    control = VolumeControl.create({ container: host, media });

    return media;
}

function parts(): { button: HTMLButtonElement; bar: HTMLElement } {
    const root = host as HTMLElement;
    const button = root.querySelector('button');
    const bar = root.querySelector<HTMLElement>('[role="slider"]');

    if (button === null || bar === null) {
        throw new Error('test: the volume control is incomplete');
    }

    return { button, bar };
}

function press(target: HTMLElement, key: string): void {
    target.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
    );
}

describe('the volume control', () => {
    it('mutes with the speaker button and brings the level back', () => {
        const media = setup();
        media.volume = 0.6;
        const { button } = parts();

        button.click();
        expect(media.muted).toBe(true);
        expect(button.getAttribute('aria-label')).toBe('Unmute');

        button.click();
        expect(media.muted).toBe(false);
        expect(media.volume).toBe(0.6);
        expect(button.getAttribute('aria-label')).toBe('Mute');
    });

    it('unmutes a silent media at half volume', () => {
        const media = setup();
        media.volume = 0;
        const { button } = parts();

        button.click();

        expect(media.volume).toBe(0.5);
        expect(media.muted).toBe(false);
    });

    it('moves the level with the keys and says it', () => {
        const media = setup();
        media.volume = 0.5;
        const { bar } = parts();

        press(bar, 'ArrowRight');
        expect(media.volume).toBe(0.55);
        expect(bar.getAttribute('aria-valuenow')).toBe('55');
        expect(bar.getAttribute('aria-valuetext')).toBe('55%');

        press(bar, 'Home');
        expect(media.volume).toBe(0);
    });

    it('sets the level under the pointer and unmutes', () => {
        const media = setup();
        media.muted = true;
        const { bar } = parts();
        const rail = bar.firstElementChild as HTMLElement;
        boxOf(rail, { left: 100, top: 0, width: 80, height: 32 });

        bar.dispatchEvent(
            Object.assign(new Event('pointerdown', { bubbles: true }), {
                clientX: 120,
                clientY: 10,
                pointerId: 1,
                button: 0,
                isPrimary: true,
            }),
        );

        expect(media.volume).toBe(0.25);
        expect(media.muted).toBe(false);
    });

    it('shows a change made elsewhere', () => {
        const media = setup();
        const { bar } = parts();

        media.volume = 0.3;
        media.fire('volumechange');

        expect(bar.getAttribute('aria-valuenow')).toBe('30');
    });

    it('rings the focus with outline-color, never the outline shorthand', () => {
        setup();
        const { bar } = parts();

        expect(focusRing(bar)).toContain('outline-color');
        expect(focusRing(bar)).not.toContain('outline');
    });

    it('opens the bar on focus when it only shows on hover', () => {
        host = document.createElement('div');
        document.body.append(host);
        control = VolumeControl.create({
            container: host,
            media: fakeMedia({ duration: 10 }),
            slider: 'hover',
            width: 80,
        });
        const { bar } = parts();

        expect(bar.style.getPropertyValue('width')).toBe('0px');

        bar.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

        expect(bar.style.getPropertyValue('width')).toBe('80px');
    });

    it('is disabled without media and leaves nothing behind', () => {
        host = document.createElement('div');
        document.body.append(host);
        control = VolumeControl.create({ container: host });
        const { button, bar } = parts();

        expect(button.disabled).toBe(true);
        expect(bar.getAttribute('aria-disabled')).toBe('true');

        control.destroy();
        expect(host.childElementCount).toBe(0);
    });
});
