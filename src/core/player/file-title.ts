/**
 * A sound's name read from its address, for a player that has no other: the file's name without its
 * folder, query or extension, its dashes and underscores as spaces, its first letter in capitals
 * ("/sounds/little-elf.mp3?v=2" is "Little elf"). Pure, and cleaned like any outside text.
 */

import { cleanText } from '../shared/text';

/** The longest name kept, in characters. */
const MAX_NAME = 120;

export function fileTitle(address: string): string {
    const path = address.split(/[?#]/, 1)[0] ?? '';
    const file = path.slice(path.lastIndexOf('/') + 1);
    let name = file;

    try {
        name = decodeURIComponent(file);
    } catch {
        // A broken escape (`%E0%A4%A`) stays as written.
    }

    const dot = name.lastIndexOf('.');
    const bare = cleanText(
        (dot > 0 ? name.slice(0, dot) : name).replace(/[-_]+/g, ' '),
        MAX_NAME,
    );

    return bare.charAt(0).toUpperCase() + bare.slice(1);
}
