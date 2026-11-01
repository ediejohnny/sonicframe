/** The part of `CSSStyleDeclaration` used to change an element's inline style and put it back. */
export type StyleLike = {
    getPropertyValue(property: string): string;
    getPropertyPriority(property: string): string;
    setProperty(property: string, value: string, priority?: string): void;
    removeProperty(property: string): string;
};

/**
 * Sets inline style properties and returns the function that puts back what was there before.
 * Browsers store some prefixed properties as aliases of the standard one (`-webkit-user-select` and
 * `user-select`), so every value is read before any is changed, and put back in reverse order.
 */
export function applyStyles(
    style: StyleLike,
    values: readonly (readonly [property: string, value: string])[],
): () => void {
    const saved = values.map(([property]) => [
        property,
        style.getPropertyValue(property),
        style.getPropertyPriority(property),
    ]);

    for (const [property, value] of values) {
        style.setProperty(property, value);
    }

    return () => {
        for (const [property, value, priority] of saved.reverse()) {
            if (value === '') {
                style.removeProperty(property);
            } else {
                style.setProperty(property, value, priority);
            }
        }
    };
}
