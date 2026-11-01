/**
 * `<sonic-recorder>`: the recorder's screen as an HTML tag. Nothing is registered on import;
 * `defineSonicRecorder()` does it once. Attributes are untrusted input: a number counts only when it
 * is one, a part only when it is a known name or one of the page's `actions`, and any other word is
 * ignored. Changing an attribute
 * builds the screen again (a recording under way is dropped); taking the element out of the page lets
 * the microphone go. The screen's events are dispatched on the element as `sonicframe:<event>`
 * custom events, with their arguments in `detail`; Send hands the recording over in
 * `sonicframe:send` and counts as sent, or with `upload-url` sends it to that address first.
 */

import type { RecorderUpload } from '../../core/recording/upload';
import { attributeNumber, canDefine } from '../../dom/shared/custom-element';
import { RecorderScreen } from '../screen/recorder-screen';
import type {
    RecorderAction,
    RecorderIcon,
    RecorderScreenOptions,
} from '../screen/screen-options';

/** The attributes the tag reads. */
export const RECORDER_ATTRIBUTES: readonly string[] = Object.freeze([
    'max',
    'live',
    'window',
    'theme',
    'palette',
    'hold',
    'keep',
    'idle-parts',
    'recording-parts',
    'review-parts',
    'actions',
    'after-stop',
    'align',
    'icon-record',
    'icon-stop',
    'icon-pause',
    'icon-resume',
    'icon-discard',
    'icon-send',
    'icon-cancel',
    'upload-url',
    'upload-method',
    'upload-field',
    'cancel-send',
    'record-style',
    'record-color',
    'rec-place',
    'record-blink',
    'mic-style',
    'mic-color',
    'a11y-lang',
    'a11y-announce-every',
]);

const ICONS: readonly RecorderIcon[] = [
    'record',
    'stop',
    'pause',
    'resume',
    'discard',
    'send',
    'cancel',
];

const EVENTS = [
    'state',
    'recorded',
    'send',
    'progress',
    'uploaded',
    'sent',
    'error',
] as const;

/** The words of a parts attribute, in order (the screen shows only the names it knows); undefined without the attribute. */
function partsOf(value: string | null): string[] | undefined {
    return value?.split(/\s+/).filter((word) => word !== '');
}

/**
 * The page's own buttons, from `actions` ("name:label, name"): each one's icon is its `icon-<name>`
 * attribute, read when the screen is built, and a press tells the page through `sonicframe:action`,
 * with the name and the recording in `detail`.
 */
function actionsOf(element: Element): Record<string, RecorderAction> {
    return Object.fromEntries(
        // A name the screen does not allow (an empty one, say) shows nothing.
        (element.getAttribute('actions') ?? '').split(',').map((entry) => {
            const colon = entry.indexOf(':');
            const name = (colon < 0 ? entry : entry.slice(0, colon)).trim();
            const action: RecorderAction = {
                label: colon < 0 ? '' : entry.slice(colon + 1),
                icon: element.getAttribute(`icon-${name}`) ?? undefined,
                press: (recording) =>
                    element.dispatchEvent(
                        new CustomEvent('sonicframe:action', {
                            detail: [name, recording],
                        }),
                    ),
            };

            return [name, action] as const;
        }),
    );
}

/** Where Send sends, from `upload-url`, `upload-method` and `upload-field` (checked when sending); none without an address. */
function uploadOf(element: Element): RecorderUpload | undefined {
    const url = element.getAttribute('upload-url');

    return url === null
        ? undefined
        : {
              url,
              method: (element.getAttribute('upload-method') ??
                  undefined) as RecorderUpload['method'],
              field: element.getAttribute('upload-field') ?? undefined,
          };
}

/** Everything the tag's attributes say, as the screen's options (all but the container). */
function optionsOf(element: Element): Omit<RecorderScreenOptions, 'container'> {
    const get = (name: string): string | null => element.getAttribute(name);

    return {
        maxSeconds: attributeNumber(get('max')),
        live: get('live') === 'fit' ? 'fit' : 'scroll',
        window: attributeNumber(get('window')),
        theme: get('theme') ?? undefined,
        palette: (get('palette') ??
            undefined) as RecorderScreenOptions['palette'],
        hold: element.hasAttribute('hold'),
        afterSend: element.hasAttribute('keep') ? 'keep' : 'reset',
        cancelSend: element.hasAttribute('cancel-send'),
        upload: uploadOf(element),
        // The screen checks these words and path data, and falls back on its own.
        afterStop: (get('after-stop') ??
            undefined) as RecorderScreenOptions['afterStop'],
        align: (get('align') ?? undefined) as RecorderScreenOptions['align'],
        recordStyle: (get('record-style') ??
            undefined) as RecorderScreenOptions['recordStyle'],
        recordColor: get('record-color') ?? undefined,
        recPlace: (get('rec-place') ??
            undefined) as RecorderScreenOptions['recPlace'],
        recordBlink: element.hasAttribute('record-blink'),
        micStyle: (get('mic-style') ??
            undefined) as RecorderScreenOptions['micStyle'],
        micColor: (get('mic-color') ??
            undefined) as RecorderScreenOptions['micColor'],
        icons: Object.fromEntries(
            ICONS.map((icon) => [icon, get(`icon-${icon}`) ?? undefined]),
        ),
        actions: actionsOf(element),
        parts: {
            idle: partsOf(get('idle-parts')),
            recording: partsOf(get('recording-parts')),
            review: partsOf(get('review-parts')),
        },
        a11y: {
            lang: get('a11y-lang') ?? undefined,
            announceEvery: attributeNumber(get('a11y-announce-every')),
        },
    };
}

/**
 * Registers the tag (`<sonic-recorder>` unless another name is given). Returns false when custom
 * elements are not available, the name is not a valid custom element name, or it is already taken.
 */
export function defineSonicRecorder(name: string = 'sonic-recorder'): boolean {
    if (!canDefine(name)) {
        return false;
    }

    customElements.define(
        name,
        class SonicRecorderElement extends HTMLElement {
            static get observedAttributes(): string[] {
                return [...RECORDER_ATTRIBUTES];
            }

            private screen: RecorderScreen | null = null;

            connectedCallback(): void {
                this.mount();
            }

            disconnectedCallback(): void {
                this.unmount();
            }

            attributeChangedCallback(
                _attribute: string,
                before: string | null,
                after: string | null,
            ): void {
                if (this.screen !== null && before !== after) {
                    this.unmount();
                    this.mount();
                }
            }

            private mount(): void {
                if (this.screen !== null) {
                    return;
                }

                if (this.style.getPropertyValue('display') === '') {
                    this.style.setProperty('display', 'block');
                }

                const screen = new RecorderScreen({
                    container: this,
                    ...optionsOf(this),
                });
                this.screen = screen;

                for (const event of EVENTS) {
                    screen.on(event, (...args: unknown[]) => {
                        this.dispatchEvent(
                            new CustomEvent(`sonicframe:${event}`, {
                                detail: args,
                            }),
                        );
                    });
                }
            }

            private unmount(): void {
                this.screen?.destroy();
                this.screen = null;
            }
        },
    );

    return true;
}
