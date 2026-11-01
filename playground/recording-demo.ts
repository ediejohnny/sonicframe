/**
 * The recording page's demos: a recorder screen built from a `data-demo="recorder"` element's
 * `data-options` (any screen option), and the `<sonic-recorder>` tag. Nothing leaves the page: what
 * Send would hand over is written in the line after the demo, `[data-sent]`.
 */

import { formatTime } from '../src/index';
import {
    createRecorder,
    defineSonicRecorder,
    type Recording,
    type RecorderScreenOptions,
} from '../src/record';

/** Writes what Send would hand over in the line that follows `demo`. */
function showSent(demo: Element, recording: Recording): void {
    const line = demo.nextElementSibling;

    if (line instanceof HTMLElement && line.hasAttribute('data-sent')) {
        const size = Math.max(1, Math.round(recording.size / 1024));
        line.textContent = `Ready to send: ${formatTime(recording.duration)} of ${recording.type || 'audio'}, ${size} KB, ${recording.peaks.length} peaks. It stays on this page.`;
    }
}

for (const host of document.querySelectorAll<HTMLElement>(
    '[data-demo="recorder"]',
)) {
    const options = JSON.parse(host.dataset.options ?? '{}') as Omit<
        RecorderScreenOptions,
        'container' | 'onSend'
    >;
    const screen = createRecorder({
        container: host,
        ...options,
        onSend: (recording) => showSent(host, recording),
    });
    screen.on('error', (error) => console.error(error));
}

defineSonicRecorder();

for (const tag of document.querySelectorAll('sonic-recorder')) {
    tag.addEventListener('sonicframe:send', (event) => {
        const [recording] = (event as CustomEvent<[Recording]>).detail;
        showSent(tag, recording);
    });
}
