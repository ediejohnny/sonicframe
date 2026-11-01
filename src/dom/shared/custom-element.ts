/**
 * What SonicFrame's tags share: whether a tag name can be registered, and a number read from an
 * attribute, which is untrusted input.
 */

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
