/**
 * The waveform voicechan drew before SonicFrame, rebuilt here for comparison: 100 bars stretched over
 * the width by an SVG, the played part clipped on top, moving only when the media reports its time.
 */

import { resample } from '../src/index';

const SVG = 'http://www.w3.org/2000/svg';

function bars(values: number[], color: string): SVGSVGElement {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', `0 0 ${values.length * 3} 100`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.setProperty('position', 'absolute');
    svg.style.setProperty('inset', '0');
    svg.style.setProperty('width', '100%');
    svg.style.setProperty('height', '100%');
    svg.style.setProperty('fill', color);

    values.forEach((value, index) => {
        const height = Math.max(4, value * 100);
        const rect = document.createElementNS(SVG, 'rect');
        rect.setAttribute('x', String(index * 3));
        rect.setAttribute('y', String((100 - height) / 2));
        rect.setAttribute('width', '2');
        rect.setAttribute('height', String(height));
        svg.append(rect);
    });

    return svg;
}

export function oldWaveform(
    container: HTMLElement,
    media: HTMLMediaElement,
    peaks: number[],
): () => void {
    const values = resample(peaks, 100);
    const played = document.createElement('div');
    played.style.setProperty('position', 'absolute');
    played.style.setProperty('inset', '0');
    played.append(bars(values, 'var(--wave-progress)'));

    container.style.setProperty('position', 'relative');
    container.style.setProperty('cursor', 'pointer');
    container.replaceChildren(bars(values, 'var(--wave-idle)'), played);

    const update = (): void => {
        const ratio =
            !media.ended &&
            media.duration > 0 &&
            Number.isFinite(media.duration)
                ? media.currentTime / media.duration
                : 0;
        played.style.setProperty(
            'clip-path',
            `inset(0 ${100 - Math.min(1, Math.max(0, ratio)) * 100}% 0 0)`,
        );
    };
    const seek = (event: MouseEvent): void => {
        const box = container.getBoundingClientRect();

        if (media.duration > 0) {
            media.currentTime =
                Math.min(
                    1,
                    Math.max(0, (event.clientX - box.left) / box.width),
                ) * media.duration;
        }
    };

    update();
    media.addEventListener('timeupdate', update);
    media.addEventListener('ended', update);
    container.addEventListener('click', seek);

    return () => {
        media.removeEventListener('timeupdate', update);
        media.removeEventListener('ended', update);
        container.removeEventListener('click', seek);
    };
}
