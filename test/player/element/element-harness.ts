/** The tag's tests make their `<sonic-player>` the same way, and take it off the page after the test. */

import type { SonicPlayerElement } from '../../../src/player';
import { afterTest } from '../../support/helpers';

/** A `<sonic-player>` with `attributes`, not yet on the page; removed after the test. */
export function tag(attributes: Record<string, string>): SonicPlayerElement {
    const element = document.createElement('sonic-player');

    for (const [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, value);
    }

    afterTest({ destroy: () => element.remove() });

    return element;
}
