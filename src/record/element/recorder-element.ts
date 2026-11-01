/**
 * `<sonic-recorder>`: the recorder's screen as an HTML tag. Nothing is registered on import;
 * `defineSonicRecorder()` does it once. Attributes are untrusted input: a number counts only when it
 * is one, a part only when it is a known name, and any other word is ignored. Changing an attribute
 * builds the screen again (a recording under way is dropped); taking the element out of the page lets
 * the microphone go. The screen's events are dispatched on the element as `sonicframe:<event>`
 * custom events, with their arguments in `detail`; Send hands the recording over in
 * `sonicframe:send` and counts as sent.
 */

import { isOneOf } from '../../core/shared/checked';
import { attributeNumber, canDefine } from '../../dom/shared/custom-element';
import { RecorderScreen } from '../screen/recorder-screen';
import {
    RECORDER_PARTS,
    type RecorderIcon,
    type RecorderPart,
    type RecorderScreenOptions,
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
    'after-stop',
    'align',
    'icon-record',
    'icon-stop',
    'icon-pause',
    'icon-resume',
    'icon-discard',
    'icon-send',
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
];

const EVENTS = ['state', 'recorded', 'send', 'sent', 'error'] as const;

/** The known part names of an attribute, in order; undefined without the attribute. */
function partsOf(value: string | null): RecorderPart[] | undefined {
    if (value === null) {
        return undefined;
    }

    return value
        .split(/\s+/)
        .filter((word): word is RecorderPart => isOneOf(word, RECORDER_PARTS));
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
        // The screen checks these words and path data, and falls back on its own.
        afterStop: (get('after-stop') ??
            undefined) as RecorderScreenOptions['afterStop'],
        align: (get('align') ?? undefined) as RecorderScreenOptions['align'],
        icons: Object.fromEntries(
            ICONS.map((icon) => [icon, get(`icon-${icon}`) ?? undefined]),
        ),
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
