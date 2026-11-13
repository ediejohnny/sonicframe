/** The part of Prism (prismjs, MIT) the docs site uses to color its code blocks. */
declare module 'prismjs' {
    type Grammar = Record<string, unknown>;

    const Prism: {
        languages: Record<string, Grammar>;
        highlight(
            text: string,
            grammar: Grammar | undefined,
            language: string,
        ): string;
    };

    export default Prism;
}

declare module 'prismjs/components/index.js' {
    export default function loadLanguages(languages: string[]): void;
}
