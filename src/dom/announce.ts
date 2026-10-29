/**
 * One polite live region for the whole page, so a plugin can say something to a screen reader (a
 * region selected, a marker reached) without any visible change. Created on first use and reused.
 */

class Announcer {
    private readonly element: HTMLElement;

    constructor() {
        const element = document.createElement('div');
        element.setAttribute('role', 'status');
        element.setAttribute('aria-live', 'polite');

        for (const [property, value] of [
            ['position', 'absolute'],
            ['width', '1px'],
            ['height', '1px'],
            ['margin', '-1px'],
            ['padding', '0'],
            ['overflow', 'hidden'],
            ['clip-path', 'inset(50%)'],
            ['white-space', 'nowrap'],
        ]) {
            element.style.setProperty(property, value);
        }

        document.body.append(element);
        this.element = element;
    }

    say(text: string): void {
        // Clearing first makes a repeat of the same text announce again.
        this.element.textContent = '';
        this.element.textContent = text;
    }
}

let shared: Announcer | null = null;

/** Says `text` through the page's shared polite live region. */
export function announce(text: string): void {
    (shared ??= new Announcer()).say(text);
}
