/**
 * What SonicFrame's tags share: whether a tag name can be registered, a number read from an
 * attribute (untrusted input), the tag shown as a block, and the events of what it built dispatched
 * on it.
 */

/** Something a tag builds, with events to listen to. */
type Heard<Name extends string> = {
    on(event: Name, listener: (...args: unknown[]) => void): () => void;
};

/** A custom element name: lowercase, starting with a letter, with at least one dash. */
const ELEMENT_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/;

/**
 * Whether `name` can be registered: custom elements exist, the name is a valid custom element name,
 * and nothing has it yet.
 */
export function canDefine(name: string): boolean {
    return (
        typeof customElements !== 'undefined' &&
        ELEMENT_NAME.test(name) &&
        customElements.get(name) === undefined
    );
}

/** A number from an attribute, or undefined when it is not one (an empty attribute included). */
export function attributeNumber(value: string | null): number | undefined {
    const text = value?.trim() ?? '';
    const number = Number(text);

    return text !== '' && Number.isFinite(number) ? number : undefined;
}

/** Shows `tag` as a block, unless the page set its `display` itself. */
export function showAsBlock(tag: HTMLElement): void {
    if (tag.style.getPropertyValue('display') === '') {
        tag.style.setProperty('display', 'block');
    }
}

/**
 * Dispatches each of `events` of `built` on `tag` as a `sonicframe:<event>` custom event, with the
 * event's arguments in `detail`; returns the functions that stop listening.
 */
export function forwardEvents<Name extends string>(
    tag: HTMLElement,
    built: Heard<Name>,
    events: readonly Name[],
): (() => void)[] {
    return events.map((event) =>
        built.on(event, (...args) => {
            tag.dispatchEvent(
                new CustomEvent(`sonicframe:${event}`, { detail: args }),
            );
        }),
    );
}
