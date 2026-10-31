/**
 * A player whose chapters list takes another form (a popover, a drawer), its button on the line
 * under the wave, and what a person does to it: the button, the list, Escape, a finger's touch
 * and swipe. The boxes are given by hand, since happy-dom has no layout.
 */

import type {
    Player,
    PlayerChapterList,
    PlayerOptions,
} from '../../../src/player';
import { boxOf } from '../../support/helpers';
import {
    host,
    ITEMS,
    make as makePlayer,
    type Media,
} from './chapters-harness';

export const LOOK: PlayerOptions['look'] = {
    line: ['play', 'wave'],
    meta: ['time', 'chapter', 'spacer', 'chapters'],
};

/** A player of the three chapters whose list takes the form `list`. */
export function make(
    list: boolean | PlayerChapterList,
    options: Partial<PlayerOptions> = {},
): { player: Player; media: Media } {
    return makePlayer({
        chapters: { items: ITEMS, list },
        look: LOOK,
        ...options,
    });
}

export function toggle(): HTMLButtonElement {
    return (host as HTMLElement).querySelector(
        '.sonicframe-chapters-toggle',
    ) as HTMLButtonElement;
}

export function list(): HTMLElement {
    return document.querySelector('.sonicframe-chapter-list') as HTMLElement;
}

/** Gives the button and the list their on-screen boxes (happy-dom has no layout): a 240 × 200 list. */
export function sizes(button: { left: number; top: number }): void {
    boxOf(toggle(), { ...button, width: 24, height: 24 });
    boxOf(list(), { left: 0, top: 0, width: 240, height: 200 });
}

export function px(element: HTMLElement, name: string): number {
    return parseFloat(element.style.getPropertyValue(name));
}

export function key(name: string): void {
    document.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', { key: name, bubbles: true }),
    );
}

export function touch(
    target: Element,
    type: string,
    x: number,
    y: number,
    pointerType = 'touch',
): void {
    target.dispatchEvent(
        Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
            clientX: x,
            clientY: y,
            pointerId: 7,
            pointerType,
            isPrimary: true,
            button: 0,
        }),
    );
}

export function swipe(
    target: Element,
    dx: number,
    dy: number,
    pointerType = 'touch',
): void {
    touch(target, 'pointerdown', 100, 100, pointerType);
    touch(target, 'pointerup', 100 + dx, 100 + dy, pointerType);
}
