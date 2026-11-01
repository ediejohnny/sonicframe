/**
 * The record button, in the style the app asks for: the screen's filled dot (`'dot'`), the dot on a
 * red button (`'red'`), a microphone (`'mic'`), or the retro REC mark (`'rec'`, see `rec-badge`),
 * whose letters are only seen: screen readers hear the button's name. A press records; with `hold`,
 * recording stops when a long press ends.
 */

import type { PlayerLook } from '../../core/player/look';
import { oneOf } from '../../core/shared/checked';
import { rgbaString } from '../../core/shared/color';
import { svgPath } from '../../core/shared/svg-path';
import { css } from '../../dom/shared/css';
import { readColor } from '../../dom/shared/paint';
import { dressRec } from './rec-badge';
import { RECORDER_ICONS, screenButton, setBusy } from './screen-buttons';
import {
    REC_PLACES,
    RECORD_STYLES,
    type RecordStyle,
    type RecorderScreenOptions,
} from './screen-options';
import type { PartHost } from './screen-parts';

/** A press shorter than this, in milliseconds, is a click even with `hold`: recording goes on. */
const HOLD = 300;

/** The microphone of the `'mic'` style, on the 24 × 24 grid of the screen's icons. */
export const MIC_ICON =
    'M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3zM6 10h2a4 4 0 0 0 8 0h2a6 6 0 0 1-5 5.9V19h3v2H8v-2h3v-3.1A6 6 0 0 1 6 10z';

/** The red of the `'red'` and `'rec'` styles: it reads on the REC mark's ground and under white. */
export const RECORD_RED = '#f44336';

/**
 * What the app's options say of the buttons' looks: the record button's style and red (read as
 * numbers, so only a color reaches a style; ours when it cannot be read), where the REC mark shows,
 * and each button's icon, the app's own when its path data passes.
 */
export function recordLook(
    options: RecorderScreenOptions,
): Pick<PartHost, 'recordStyle' | 'recordColor' | 'recPlace' | 'icon'> {
    const recordStyle = oneOf(options.recordStyle, RECORD_STYLES, 'dot');
    const red = readColor(options.recordColor ?? RECORD_RED);

    return {
        recordStyle,
        recordColor: red === null ? RECORD_RED : rgbaString(red),
        recPlace: oneOf(options.recPlace, REC_PLACES, 'badge'),
        icon: (name) =>
            svgPath(
                options.icons?.[name],
                name === 'record' && recordStyle === 'mic'
                    ? MIC_ICON
                    : RECORDER_ICONS[name],
            ),
    };
}

/** The record button of the screen's style. */
export function recordButton(host: PartHost): HTMLButtonElement {
    const path = host.icon('record');
    const button = screenButton(
        host.look,
        'record',
        path,
        host.words.record,
        () => host.start(),
    );
    dress(button, host.look, host.recordStyle, host.recordColor, path);
    setBusy(button, host.state() === 'asking');

    if (host.hold) {
        holdToRecord(button, host);
    }

    return button;
}

/** Paints `button` in `style`, with `red` already read as numbers and `path` its icon's. */
function dress(
    button: HTMLButtonElement,
    look: PlayerLook,
    style: RecordStyle,
    red: string,
    path: string,
): void {
    if (style === 'red') {
        css(button, [
            ['background-color', red],
            ['color', '#ffffff'],
        ]);
    } else if (style === 'rec') {
        dressRec(button, look, red, path);
    }
}

/** Records while `button` is held: a long press ends the recording when it is let go. */
function holdToRecord(button: HTMLButtonElement, host: PartHost): void {
    button.addEventListener('pointerdown', () => {
        const pressed = performance.now();
        const release = (): void => {
            document.removeEventListener('pointerup', release);
            document.removeEventListener('pointercancel', release);

            if (
                performance.now() - pressed >= HOLD &&
                host.state() === 'recording'
            ) {
                host.stop();
            }
        };

        document.addEventListener('pointerup', release);
        document.addEventListener('pointercancel', release);
        host.start();
    });
}
