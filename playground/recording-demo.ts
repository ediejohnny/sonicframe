/**
 * The recording page's demos: a recorder screen built from a `data-demo="recorder"` element's
 * `data-options` (any screen option), and the `<sonic-recorder>` tag. `data-extra` adds what JSON
 * cannot hold: `"save"` a page button of its own, `"slow"` a send that takes a few seconds and tells
 * how far it got. Nothing leaves the page: what Send would hand over is written in the line after
 * the demo, `[data-sent]`.
 */

import { formatTime } from '../src/index';
import {
    createRecorder,
    defineSonicRecorder,
    type Recording,
    type RecorderAction,
    type RecorderScreenOptions,
    type SendControl,
} from '../src/record';

/** A floppy disk, on the 24 × 24 grid of the screen's icons. */
const SAVE_ICON = 'M5 3h11l3 3v15H5zM8 5v4h7V5zM8 13v6h8v-6z';

/** Writes `text` in the line that follows `demo`. */
function tell(demo: Element, text: string): void {
    const line = demo.nextElementSibling;

    if (line instanceof HTMLElement && line.hasAttribute('data-sent')) {
        line.textContent = text;
    }
}

/** What a recording is, in a few words. */
function describe(recording: Recording): string {
    const size = Math.max(1, Math.round(recording.size / 1024));

    return `${formatTime(recording.duration)} of ${recording.type || 'audio'}, ${size} KB, ${recording.peaks.length} peaks`;
}

/** Writes what Send would hand over in the line that follows `demo`. */
function showSent(demo: Element, recording: Recording): void {
    tell(demo, `Ready to send: ${describe(recording)}. It stays on this page.`);
}

/** A send that takes three seconds, telling how far it got, and stops when canceled. */
function slowSend(demo: Element) {
    return (
        recording: Recording,
        control: Required<SendControl>,
    ): Promise<void> =>
        new Promise((resolve, reject) => {
            let tenths = 0;
            const step = window.setInterval(() => {
                tenths += 1;
                control.progress(tenths / 10);

                if (tenths === 10) {
                    window.clearInterval(step);
                    showSent(demo, recording);
                    resolve();
                }
            }, 300);
            control.signal.addEventListener('abort', () => {
                window.clearInterval(step);
                tell(
                    demo,
                    'The send was canceled; the recording is still here.',
                );
                reject(control.signal.reason);
            });
        });
}

/** The page's own Save button: it shows what it would keep. */
function saveAction(demo: Element): RecorderAction {
    return {
        label: 'Save the recording',
        icon: SAVE_ICON,
        main: true,
        press: (recording) => {
            if (recording !== null) {
                tell(demo, `Saved on this page: ${describe(recording)}.`);
            }
        },
    };
}

for (const host of document.querySelectorAll<HTMLElement>(
    '[data-demo="recorder"]',
)) {
    const options = JSON.parse(host.dataset.options ?? '{}') as Omit<
        RecorderScreenOptions,
        'container' | 'onSend'
    >;
    const extra = host.dataset.extra;
    const screen = createRecorder({
        container: host,
        ...options,
        actions: extra === 'save' ? { save: saveAction(host) } : undefined,
        onSend:
            extra === 'slow'
                ? slowSend(host)
                : (recording) => showSent(host, recording),
    });
    screen.on('error', (error) => console.error(error));

    if (options.afterStop === 'none') {
        screen.on('recorded', (recording) =>
            tell(host, `Handed to the page: ${describe(recording)}.`),
        );
    }
}

defineSonicRecorder();

for (const tag of document.querySelectorAll('sonic-recorder')) {
    tag.addEventListener('sonicframe:send', (event) => {
        const [recording] = (event as CustomEvent<[Recording]>).detail;
        showSent(tag, recording);
    });
}
