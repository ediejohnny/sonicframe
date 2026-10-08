import { defineConfig } from 'vite-plus';

export default defineConfig({
    // The playground (playground/index.html) runs on the dev server. IPv4 on purpose: browsers ignore an IPv6
    // address in a Content-Security-Policy, and apps that load SonicFrame often have one.
    server: {
        host: '127.0.0.1',
        port: 5174,
        strictPort: true,
    },
    test: {
        include: ['test/**/*.test.ts'],
        environment: 'node',
    },
    pack: {
        entry: ['src/index.ts'],
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
