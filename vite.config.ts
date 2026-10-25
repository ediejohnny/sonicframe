import { defineConfig } from 'vite-plus';

export default defineConfig({
    // The playground (playground/index.html) runs on the dev server. IPv4 on purpose: browsers ignore an IPv6
    // address in a Content-Security-Policy, and apps that load SonicFrame often have one.
    server: {
        host: '127.0.0.1',
        port: 5174,
        strictPort: true,
    },
    // Two test projects: the pure core runs in Node (fast, no DOM), and the page layer runs under
    // happy-dom with the stand-ins from test/dom/setup.ts. Core tests stay flat in test/; page tests
    // live under test/dom/, so the globs keep them apart without fighting Vitest's default excludes.
    test: {
        projects: [
            {
                extends: true,
                test: {
                    name: 'core',
                    environment: 'node',
                    include: ['test/*.test.ts'],
                },
            },
            {
                extends: true,
                test: {
                    name: 'dom',
                    environment: 'happy-dom',
                    include: ['test/dom/**/*.test.ts'],
                    setupFiles: ['./test/dom/setup.ts'],
                },
            },
        ],
    },
    pack: {
        entry: ['src/index.ts', 'src/analysis.ts'],
        format: 'esm',
        platform: 'neutral',
        target: 'es2022',
        dts: true,
        clean: true,
    },
    lint: {
        ignorePatterns: ['dist/**', 'node_modules/**', 'coverage/**'],
        options: {
            denyWarnings: true,
            typeAware: true,
        },
    },
    fmt: {
        printWidth: 80,
        tabWidth: 4,
        singleQuote: true,
        semi: true,
        ignorePatterns: ['dist/**'],
    },
});
