/**
 * The `time-` attributes of `<sonic-player>` read into the look's precise clock. Untrusted like
 * every attribute: a name is passed in lower case and the look keeps it only when it knows it, and
 * a frame rate counts only when it is a number, which the look keeps in range; anything else leaves
 * the plain clock.
 */

import type { PlayerLook } from '../../core/player/look';
import { attributeNumber } from '../../dom/shared/custom-element';

/** An attribute of the tag's clock. */
export type ClockAttribute =
    | 'time-precision'
    | 'time-fps'
    | 'time-hours'
    | 'time-decimal';

/** The tag's attributes for the clock. */
export const CLOCK_ATTRIBUTES: readonly ClockAttribute[] = Object.freeze([
    'time-precision',
    'time-fps',
    'time-hours',
    'time-decimal',
]);

/** An attribute's word, trimmed and in lower case; null without the attribute. */
function word(element: Element, name: ClockAttribute): string | null {
    return element.getAttribute(name)?.trim().toLowerCase() ?? null;
}

/** The look's clock from the tag, or undefined when it has none of the attributes. */
export function clockLookOf(element: Element): Partial<PlayerLook> | undefined {
    const look: Partial<PlayerLook> = {};
    const precision = word(element, 'time-precision');
    const fps = attributeNumber(element.getAttribute('time-fps'));
    const hours = word(element, 'time-hours');
    const decimal = word(element, 'time-decimal');

    // Each word goes in as written; `resolveLook` keeps a known one and drops the rest.
    if (precision !== null) {
        look.timePrecision = precision as PlayerLook['timePrecision'];
    }

    if (fps !== undefined) {
        look.timeFps = fps;
    }

    if (hours !== null) {
        look.timeHours = hours as PlayerLook['timeHours'];
    }

    if (decimal !== null) {
        look.timeDecimal = decimal as PlayerLook['timeDecimal'];
    }

    return Object.keys(look).length > 0 ? look : undefined;
}
