import { defineConfig } from 'vite-plus';
import { docsSite } from './playground/docs/plugin';

export default defineConfig({
    // The docs site (playground/index.html and its pages) runs on the dev server; the plugin draws the
    // parts every page shares. IPv4 on purpose: browsers ignore an IPv6 address in a
    // Content-Security-Policy, and apps that load SonicFrame often have one.
    plugins: [docsSite()],
    server: {
        host: '127.0.0.1',
        port: 5174,
        strictPort: true,
    },
    // Two test projects. test/ mirrors src/, each test beside its subject: the pure core
    // (test/core/) and the tests of the whole package (test/*.test.ts) run in Node, fast and with no
    // DOM; every other layer and the docs site run under happy-dom with the stand-ins from
    // test/support/setup.ts.
    test: {
        projects: [
            {
                extends: true,
                test: {
                    name: 'core',
                    environment: 'node',
                    include: ['test/*.test.ts', 'test/core/**/*.test.ts'],
                },
            },
            {
                extends: true,
                test: {
                    name: 'dom',
                    environment: 'happy-dom',
                    include: [
                        'test/{dom,controls,plugins,player,site}/**/*.test.ts',
                    ],
                    setupFiles: ['./test/support/setup.ts'],
                },
            },
        ],
    },
    pack: {
        entry: ['src/index.ts', 'src/analysis.ts', 'src/player.ts'],
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
