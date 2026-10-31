/**
 * Addresses that come from outside (a chapters file, the app's options) are used only when they are
 * plainly web or relative addresses, so a link or an image can never run script, read a data URL the
 * app did not mean, or reach another host through `//` or a backslash.
 */

/** The longest address taken, in characters. */
const MAX_URL = 2048;

/** The schemes `safeUrl` takes unless it is given others. */
const WEB_SCHEMES: readonly string[] = ['http', 'https'];

/**
 * The address when it has one of `schemes` (http and https by default) or is relative; null when it
 * has another scheme, starts with `//`, holds a backslash, a space or a control character, or is
 * empty or longer than 2048 characters.
 */
export function safeUrl(
    url: string,
    schemes: readonly string[] = WEB_SCHEMES,
): string | null {
    if (url.length === 0 || url.length > MAX_URL || url.startsWith('//')) {
        return null;
    }

    // A backslash counts as a slash in web addresses, so `/\host` would reach another host.
    // oxlint-disable-next-line no-control-regex -- control characters are exactly what is refused
    if (/[\\\s\u0000-\u001f\u007f]/.test(url)) {
        return null;
    }

    const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url);

    if (scheme !== null) {
        return schemes.includes(scheme[1].toLowerCase()) ? url : null;
    }

    return url;
}
