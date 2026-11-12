/**
 * The pieces of a media list's item: a span of text, the item's picture with its length on it, the
 * still mark of the item playing, and the thin bar it fills as it plays. Class names start with the
 * list's own prefix (`sonicframe-chapter-…`, `sonicframe-track-…`). Text only ever goes in as text,
 * and every color through a `--sonicframe-*` variable.
 */

import { PROGRESS, REGION } from '../../core/shared/variables';
import { css } from '../shared/css';
import { iconElement, iconPath } from '../shared/icon';
import type { ListLook } from './list-look';

/** Three bars of different heights, the mark of the item playing (on a 12 × 12 grid). */
const PLAYING = 'M1 5h2v6H1zM5 1h2v10H5zM9 4h2v7H9z';

export function textSpan(className: string, text: string): HTMLSpanElement {
    const element = document.createElement('span');
    element.className = className;
    element.textContent = text;

    return element;
}

/**
 * The item's picture (an address already checked), square or wide, with its length on it when one
 * is given (said already by the line under the title, so hidden from screen readers).
 */
export function itemThumb(
    prefix: string,
    image: string,
    length: string | null,
    look: ListLook,
): HTMLElement {
    const { thumbWidth, thumbShape, thumbCorner } = look;
    const height = thumbShape === 'wide' ? (thumbWidth * 9) / 16 : thumbWidth;
    const box = document.createElement('span');
    box.className = `${prefix}-thumb`;
    css(box, [
        ['position', 'relative'],
        ['flex', `0 0 ${thumbWidth}rem`],
        ['width', `${thumbWidth}rem`],
        ['height', `${height}rem`],
        ['overflow', 'hidden'],
        ['border-radius', `${thumbCorner}rem`],
        ['background-color', REGION],
    ]);
    const picture = document.createElement('img');
    picture.alt = '';
    picture.loading = 'lazy';
    picture.decoding = 'async';
    picture.src = image;
    css(picture, [
        ['display', 'block'],
        ['width', '100%'],
        ['height', '100%'],
        ['object-fit', 'cover'],
    ]);
    box.append(picture);

    if (length !== null && look.length) {
        const badge = textSpan(`${prefix}-length`, length);
        const cover = document.createElement('span');
        cover.setAttribute('aria-hidden', 'true');
        cover.append(badge);
        css(badge, [
            ['position', 'absolute'],
            ['right', '0.25rem'],
            ['bottom', '0.25rem'],
            ['padding', '0.0625rem 0.3125rem'],
            ['border-radius', '0.1875rem'],
            ['background-color', 'rgba(0, 0, 0, 0.72)'],
            ['color', '#ffffff'],
            ['font-size', '0.6875rem'],
            ['font-weight', '600'],
            ['letter-spacing', '0.02em'],
            ['line-height', '1.3'],
            ['white-space', 'nowrap'],
            ['font-variant-numeric', 'tabular-nums'],
        ]);
        box.append(cover);
    }

    return box;
}

/** The still mark of the item playing: three sound bars in the played color. */
export function playingMark(prefix: string): SVGSVGElement {
    const icon = iconElement(12);
    icon.setAttribute('class', `${prefix}-playing`);
    icon.append(iconPath({ d: PLAYING, fill: 'currentColor' }));
    css(icon, [
        ['width', '0.75rem'],
        ['height', '0.75rem'],
        ['color', PROGRESS],
        ['vertical-align', 'middle'],
    ]);

    return icon;
}

/** The thin bar along the bottom of `button`, the item playing; returns its fill. */
export function progressBar(
    prefix: string,
    button: HTMLButtonElement | undefined,
): HTMLElement | null {
    if (button === undefined) {
        return null;
    }

    const track = document.createElement('span');
    const fill = document.createElement('span');
    track.setAttribute('aria-hidden', 'true');
    fill.className = `${prefix}-progress`;
    css(track, [
        ['position', 'absolute'],
        ['left', '0'],
        ['right', '0'],
        ['bottom', '0'],
        ['height', '0.125rem'],
    ]);
    css(fill, [
        ['display', 'block'],
        ['height', '100%'],
        ['width', '0%'],
        ['background-color', PROGRESS],
    ]);
    track.append(fill);
    button.append(track);

    return fill;
}
