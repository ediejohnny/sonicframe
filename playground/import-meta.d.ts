/** Vite's file globs, which the docs site uses to load its example files. */
interface ImportMeta {
    glob(pattern: string): Record<string, () => Promise<unknown>>;
}
