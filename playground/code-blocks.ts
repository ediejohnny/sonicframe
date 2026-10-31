/**
 * The docs pages' code blocks (`.code`: a `<pre>` and its copy button). The button copies the code,
 * whatever it says at the time, is described by the heading over the block (a page has many "Copy"
 * buttons), and its result is also said aloud, since a button's new words are not. A block too wide
 * for the screen becomes a named region in the tab order, so the keyboard can scroll it; it leaves
 * the tab order once it fits.
 */

/** How long a copy button says it copied, in milliseconds. */
const COPIED_FOR = 1500;

const STATUS_ID = 'site-status';

/** The page's one polite status line, heard only, made the first time it is needed. */
function statusLine(): HTMLElement {
    const found = document.getElementById(STATUS_ID);

    if (found !== null) {
        return found;
    }

    const line = document.createElement('p');
    line.id = STATUS_ID;
    line.className = 'visually-hidden';
    line.setAttribute('role', 'status');
    document.body.append(line);

    return line;
}

let headings = 0;

/** The id of the last heading before `element` in the page, given one if it has none; '' without. */
function headingOver(element: Element): string {
    const before = [...document.querySelectorAll('h1, h2, h3, h4')].filter(
        (heading) =>
            heading.compareDocumentPosition(element) &
            Node.DOCUMENT_POSITION_FOLLOWING,
    );
    const heading = before.at(-1);

    if (heading === undefined) {
        return '';
    }

    if (heading.id === '') {
        headings += 1;
        heading.id = `code-heading-${headings}`;
    }

    return heading.id;
}

/** Makes the button of a `.code` block copy the block's code, described by the heading over it. */
export function copyButton(block: HTMLElement): void {
    const button = block.querySelector('button');
    const code = block.querySelector('code');

    if (button === null || code === null) {
        return;
    }

    const heading = headingOver(block);

    if (heading !== '') {
        button.setAttribute('aria-describedby', heading);
    }

    copyOnClick(button, () => code.textContent ?? '');
}

/**
 * Makes a button copy the text `text` gives at the time of the click, and say whether it did: on
 * itself for a while, and once on the page's status line.
 */
export function copyOnClick(
    button: HTMLButtonElement,
    text: () => string,
): void {
    const label = button.textContent?.trim() ?? 'Copy';
    const status = statusLine();
    let timer = 0;
    const say = (message: string): void => {
        button.textContent = message;
        status.textContent = `${message}.`;
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
            button.textContent = label;
            status.textContent = '';
        }, COPIED_FOR);
    };

    button.addEventListener('click', () => {
        navigator.clipboard.writeText(text()).then(
            () => say('Copied'),
            () => say('Copy failed'),
        );
    });
}

/** Puts in the tab order, as a named region, every code block wider than its box, and only those. */
export function fitCodeBlocks(): void {
    for (const pre of document.querySelectorAll<HTMLElement>('.code pre')) {
        if (pre.scrollWidth > pre.clientWidth) {
            pre.tabIndex = 0;
            pre.setAttribute('role', 'region');
            pre.setAttribute('aria-label', 'Code');

            const heading = headingOver(pre);

            if (heading !== '') {
                pre.setAttribute('aria-describedby', heading);
            }
        } else {
            for (const name of [
                'tabindex',
                'role',
                'aria-label',
                'aria-describedby',
            ]) {
                pre.removeAttribute(name);
            }
        }
    }
}

let fitting = false;

export function setupCodeBlocks(): void {
    statusLine();

    for (const block of document.querySelectorAll<HTMLElement>('.code')) {
        copyButton(block);
    }

    fitCodeBlocks();

    if (!fitting) {
        fitting = true;
        let queued = false;
        window.addEventListener('resize', () => {
            if (!queued) {
                queued = true;
                requestAnimationFrame(() => {
                    queued = false;
                    fitCodeBlocks();
                });
            }
        });
    }
}
