/**
 * A tool for us, on the dev server only: decodes each sound of the docs site, writes its peaks with
 * `writeWaveform` (8-bit `.dat`, `perSecond` points per second) and posts them to the dev server,
 * which saves them next to the sound. The pages then read these files instead of decoding audio.
 */

import { writeWaveform } from '../src/index';
import { SOUNDS } from './docs/sounds';

const log = document.querySelector('#log') as HTMLUListElement;

function say(text: string): void {
    const item = document.createElement('li');
    item.textContent = text;
    log.append(item);
}

async function make(): Promise<void> {
    const context = new AudioContext();

    try {
        for (const sound of SOUNDS) {
            const response = await fetch(`./${sound.audio}`);
            const buffer = await context.decodeAudioData(
                await response.arrayBuffer(),
            );
            const channels = Array.from(
                { length: buffer.numberOfChannels },
                (_, index) => buffer.getChannelData(index),
            );
            const bytes = writeWaveform(channels, {
                sampleRate: buffer.sampleRate,
                samplesPerPeak: Math.round(buffer.sampleRate / sound.perSecond),
                bits: 8,
            });
            const saved = await fetch(`./__peaks?id=${sound.id}`, {
                method: 'POST',
                body: new Blob([bytes as Uint8Array<ArrayBuffer>]),
            });

            say(
                saved.ok
                    ? `${sound.peaks}: ${bytes.length} bytes, ${buffer.duration.toFixed(1)} s`
                    : `${sound.peaks}: not saved (HTTP ${saved.status})`,
            );
        }
    } finally {
        void context.close();
    }
}

document.querySelector('#make')?.addEventListener('click', () => {
    make().catch((error: unknown) => say(`Failed: ${String(error)}`));
});
