/**
 * SVG path data from outside, such as an app's own icon: a move command first, then only the path's
 * command letters, numbers and separators, in at most 4096 characters. Anything else gives way to
 * the fallback, so no markup, address or style can ride in on a path.
 */

/** The longest path data taken, in characters. */
const MAX_PATH = 4096;

const PATH = /^\s*[Mm][MmLlHhVvCcSsQqTtAaZz0-9eE.,+\-\s]*$/;

/** `given` when it is path data as described above, otherwise `fallback`. */
export function svgPath(given: unknown, fallback: string): string {
    return typeof given === 'string' &&
        given.length <= MAX_PATH &&
        PATH.test(given)
        ? given
        : fallback;
}
