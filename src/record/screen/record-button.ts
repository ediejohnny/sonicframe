/**
 * The record button, in the style the app asks for: the dot on a red button (`'red'`, the default),
 * the dot in the player's button colors (`'dot'`), a microphone (`'mic'`), or the retro REC mark
 * (`'rec'`, see `rec-badge`),
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
    MIC_STYLES,
    type MicStyle,
    REC_PLACES,
    RECORD_STYLES,
    type RecordStyle,
    type RecorderScreenOptions,
} from './screen-options';
import type { PartHost } from './screen-parts';

/** A press shorter than this, in milliseconds, is a click even with `hold`: recording goes on. */
const HOLD = 300;

/**
 * The microphones of the `'mic'` style, on the 24 × 24 grid of the screen's icons: a body, its
 * holder and its stem, the body drawn as its outline or filled.
 */
const MIC_ICONS: Readonly<Record<MicStyle, string>> = {
    outline:
        'M12 2a3.5 3.5 0 0 1 3.5 3.5v6a3.5 3.5 0 0 1 -7 0V5.5a3.5 3.5 0 0 1 3.5 -3.5zM12 3.75a1.75 1.75 0 0 0 -1.75 1.75v6a1.75 1.75 0 0 0 3.5 0V5.5a1.75 1.75 0 0 0 -1.75 -1.75zM5 11.5a7 7 0 0 0 14 0h-1.75a5.25 5.25 0 0 1 -10.5 0zM11.125 18.3h1.75V22h-1.75z',
    filled: 'M12 2a3.5 3.5 0 0 1 3.5 3.5v6a3.5 3.5 0 0 1 -7 0V5.5a3.5 3.5 0 0 1 3.5 -3.5zM5 11.5a7 7 0 0 0 14 0h-1.75a5.25 5.25 0 0 1 -10.5 0zM11.125 18.3h1.75V22h-1.75z',
};

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
    const recordStyle = oneOf(options.recordStyle, RECORD_STYLES, 'red');
    const red = readColor(options.recordColor ?? RECORD_RED);

    return {
        recordStyle,
        recordColor: red === null ? RECORD_RED : rgbaString(red),
        recPlace: oneOf(options.recPlace, REC_PLACES, 'badge'),
        icon: (name) =>
            svgPath(
                options.icons?.[name],
                name === 'record' && recordStyle === 'mic'
                    ? MIC_ICONS[oneOf(options.micStyle, MIC_STYLES, 'outline')]
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
