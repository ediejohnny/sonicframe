/** The grain effect's noise, drawn by SonicFrame on a canvas: no image file, nothing fetched. */

/** The largest noise drawn, in CSS pixels each way; a larger player stretches it a little. */
const MAX_SIDE = 2048;

/** Paints gray noise over `canvas`, `width` × `height` CSS pixels (at least 1, at most 2048 each way). */
export function paintGrain(
    canvas: HTMLCanvasElement,
    width: number,
    height: number,
    random: () => number = Math.random,
): void {
    const across = Math.max(1, Math.min(MAX_SIDE, Math.round(width)));
    const down = Math.max(1, Math.min(MAX_SIDE, Math.round(height)));
    canvas.width = across;
    canvas.height = down;
    const context = canvas.getContext('2d');

    if (context === null) {
        return;
    }

    const image = context.createImageData(across, down);
    const { data } = image;

    for (let at = 0; at < data.length; at += 4) {
        const light = Math.floor(random() * 256);
        data[at] = light;
        data[at + 1] = light;
        data[at + 2] = light;
        data[at + 3] = 255;
    }

    context.putImageData(image, 0, 0);
}
