import { defineConfig } from 'vite-plus';
import { docsInputs, docsSite } from './playground/docs/plugin';

// The docs site as static pages for GitHub Pages (`npm run docs:build`), served under /sonicframe/.
// The output folder, `site/`, is never committed.
export default defineConfig({
    root: 'playground',
    base: '/sonicframe/',
    plugins: [docsSite()],
    build: {
        outDir: '../site',
        emptyOutDir: true,
        rollupOptions: { input: docsInputs() },
    },
});
