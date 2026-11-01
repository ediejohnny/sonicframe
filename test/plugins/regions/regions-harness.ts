/**
 * What the regions tests share: a frame with the regions plugin over a sound of a known length, its
 * media and the plugin.
 */

import {
    regions,
    type RegionsOptions,
    type RegionsPlugin,
} from '../../../src/index';
import { fakeMedia, mount, type Mounted } from '../../support/helpers';

/** A frame of a sound `duration` seconds long with the regions plugin, its media and the plugin. */
export function shown(
    options: RegionsOptions = {},
    duration = 40,
    paused = true,
): Mounted & { media: ReturnType<typeof fakeMedia>; plugin: RegionsPlugin } {
    const plugin = regions(options);
    const media = fakeMedia({ duration, paused });

    return { ...mount({ media, plugins: [plugin] }), media, plugin };
}
