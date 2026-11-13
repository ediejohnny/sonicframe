/** Codec names as WebCodecs takes them, from what a container stores. */

/**
 * The AAC codec of an AudioSpecificConfig (ISO/IEC 14496-3): `mp4a.40.` and its object type, read
 * past the escape when the first five bits are 31. Null when the setup is shorter than two bytes.
 */
export function aacCodec(setup: Uint8Array): string | null {
    if (setup.length < 2) {
        return null;
    }

    const kind = setup[0] >> 3;
    const type =
        kind === 31 ? 32 + (((setup[0] & 7) << 3) | (setup[1] >> 5)) : kind;

    return `mp4a.40.${type}`;
}
