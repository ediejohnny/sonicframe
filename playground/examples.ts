/**
 * Runs the docs pages' examples: each `.example-result` box with an id is drawn by the example file
 * of the same name (`playground/examples/<id>.js`), the very code shown above it. A box of markup
 * (a `.html` example) holds the tags themselves; the tags are defined here when it has any.
 */

const EXAMPLES = import.meta.glob('./examples/*.js');

export function runExamples(): void {
    if (document.querySelector('.example-result sonic-player') !== null) {
        import('../src/player')
            .then(({ defineSonicPlayer }) => defineSonicPlayer())
            .catch((error: unknown) => console.error(error));
    }

    for (const box of document.querySelectorAll<HTMLElement>(
        '.example-result[id]',
    )) {
        const load = EXAMPLES[`./examples/${box.id}.js`];

        if (load === undefined) {
            console.error(`docs: no example file for #${box.id}`);
        } else {
            load().catch((error: unknown) => console.error(error));
        }
    }
}
