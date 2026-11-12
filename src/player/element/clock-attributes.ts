/**
 * The `time-` attributes of `<sonic-player>` read into the look's precise clock. Untrusted like
 * every attribute: a name is passed in lower case and the look keeps it only when it knows it, a
 * frame rate counts only when it is a number, which the look keeps in range, and a mask
 * (`time-format`) goes as written, its letters' case kept, for the look to read or drop; anything
 * else leaves the plain clock.
 */

import type { PlayerLook } from '../../core/player/look';
import type { ClockAttribute } from '../../core/tags/tag-attributes';
import { attributeNumber } from '../../dom/shared/custom-element';

export {
    CLOCK_ATTRIBUTES,
    type ClockAttribute,
} from '../../core/tags/tag-attributes';

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
    const format = element.getAttribute('time-format');

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

    if (format !== null) {
        look.timeFormat = format;
    }

    return Object.keys(look).length > 0 ? look : undefined;
}
