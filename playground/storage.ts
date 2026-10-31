/**
 * The reader's choices the site keeps between visits (the scheme, the font). Storage can be off or
 * full; a choice then lasts for this visit only, and reading one gives nothing.
 */

export function store(key: string, value: string): void {
    try {
        localStorage.setItem(key, value);
    } catch {
        // The choice lasts for this visit only.
    }
}

export function stored(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}
