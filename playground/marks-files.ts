/**
 * The regions page's files demo: a player with three regions, its regions shown as each file format
 * writes them, saved as that file, and read back from a file the visitor picks. Saving makes the file
 * on the page (a Blob), never on a server.
 */

import {
    readRegions,
    regions,
    writeRegions,
    type MarksFormat,
    type RegionsPlugin,
} from '../src/index';
import type { PlayerOptions } from '../src/player';
import { byId } from './site';

/** Builds a player on the page's sound with these options; returns what takes it down. */
type MakePlayer = (
    host: HTMLElement,
    options: Omit<PlayerOptions, 'container' | 'src' | 'peaks' | 'duration'>,
) => () => void;

/** What each format's file is called and its media type. */
const FILES: Readonly<Record<MarksFormat, { name: string; type: string }>> = {
    json: { name: 'regions.json', type: 'application/json' },
    vtt: { name: 'regions.vtt', type: 'text/vtt' },
    csv: { name: 'regions.csv', type: 'text/csv' },
    audacity: { name: 'regions.txt', type: 'text/plain' },
};

/** Saves `text` as a file of that name, made on the page. */
function save(text: string, name: string, type: string): void {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
}

/** The demo in `host`, with its buttons, its file field, its text and its status elsewhere on the page. */
export function regionFiles(host: HTMLElement, make: MakePlayer): () => void {
    const text = byId('files-text');
    const status = byId('files-status');
    const picker = byId('files-pick') as HTMLInputElement;
    const choices = Array.from(
        document.querySelectorAll<HTMLButtonElement>('[data-files-format]'),
    );
    let format: MarksFormat = 'json';
    const parts: RegionsPlugin = regions({
        items: [
            { start: 2, end: 6, label: 'Intro', id: 'intro' },
            { start: 9, end: 14, label: 'Verse, "one"', id: 'verse' },
            { start: 18, end: 21, label: '=Chorus' },
        ],
        onChange: () => show(),
    });

    const show = (): void => {
        text.textContent = writeRegions(parts.items, { format });

        for (const choice of choices) {
            choice.setAttribute(
                'aria-pressed',
                String(choice.dataset.filesFormat === format),
            );
        }
    };

    const pick = (event: Event): void => {
        const chosen = (event.currentTarget as HTMLButtonElement).dataset
            .filesFormat as MarksFormat;
        format = chosen;
        show();
    };

    const download = (): void => {
        const file = FILES[format];
        save(text.textContent ?? '', file.name, file.type);
        status.textContent = `Saved ${file.name}.`;
    };

    const open = (): void => picker.click();

    const read = async (): Promise<void> => {
        const file = picker.files?.[0];

        if (file === undefined) {
            return;
        }

        // A file that is no regions file, or holds none, leaves the regions as they were.
        const found = await file
            .text()
            .then((text) => readRegions(text))
            .catch(() => []);

        if (found.length === 0) {
            status.textContent = `${file.name} has no regions to read.`;
        } else {
            parts.set(found);
            status.textContent = `Read ${found.length} ${found.length === 1 ? 'region' : 'regions'} from ${file.name}.`;
        }

        picker.value = '';
    };

    const listeners: [EventTarget, string, EventListener][] = [
        ...choices.map((choice): [EventTarget, string, EventListener] => [
            choice,
            'click',
            pick,
        ]),
        [byId('files-save'), 'click', download],
        [byId('files-open'), 'click', open],
        [picker, 'change', () => void read()],
    ];

    for (const [target, type, listener] of listeners) {
        target.addEventListener(type, listener);
    }

    const stop = make(host, {
        a11y: { label: 'Regions to save and read' },
        plugins: [parts],
    });
    show();

    return () => {
        for (const [target, type, listener] of listeners) {
            target.removeEventListener(type, listener);
        }

        stop();
    };
}
