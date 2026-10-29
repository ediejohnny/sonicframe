import { describe, expect, it } from 'vite-plus/test';
import {
    FONT_NAMES,
    FONT_STACKS,
    resolveFont,
    safeFontUrl,
} from '../src/core/fonts';

describe('font stacks', () => {
    it('name a system stack for every font name, ending in a generic family', () => {
        for (const name of FONT_NAMES) {
            expect(FONT_STACKS[name]).toMatch(
                /(sans-serif|serif|monospace|cursive)$/,
            );
        }
    });
});

describe('resolveFont', () => {
    it('takes a stack by name', () => {
        expect(resolveFont('mono', 'system')).toEqual({
            family: FONT_STACKS.mono,
            load: null,
        });
    });

    it('falls back to the given stack when nothing is chosen', () => {
        expect(resolveFont(undefined, 'rounded').family).toBe(
            FONT_STACKS.rounded,
        );
    });

    it('quotes a family the app brings and keeps a stack behind it', () => {
        const font = resolveFont(
            {
                family: 'Brand Sans',
                src: '/fonts/brand.woff2',
                fallback: 'humanist',
            },
            'system',
        );

        expect(font.family).toBe(`"Brand Sans", ${FONT_STACKS.humanist}`);
        expect(font.load).toEqual({
            family: 'Brand Sans',
            src: '/fonts/brand.woff2',
            stylesheet: undefined,
        });
    });

    it('takes a plain font-family list as it is, capped', () => {
        expect(resolveFont('Inter, sans-serif', 'system').family).toBe(
            'Inter, sans-serif',
        );
        expect(resolveFont('x'.repeat(500), 'system').family.length).toBe(200);
    });

    it('strips quotes and backslashes from a family name', () => {
        const font = resolveFont(
            { family: 'Evil"; } body { x: "\\y' },
            'system',
        );

        expect(font.family.startsWith('"Evil; } body { x: y", ')).toBe(true);
    });

    it('drops a font address it cannot trust, keeping the family', () => {
        const font = resolveFont(
            { family: 'Brand', src: 'javascript:alert(1)' },
            'system',
        );

        expect(font.load).toEqual({
            family: 'Brand',
            src: undefined,
            stylesheet: undefined,
        });
    });
});

describe('safeFontUrl', () => {
    it('accepts http(s) and relative paths', () => {
        for (const url of [
            'https://fonts.example.com/css2?family=Brand',
            'http://localhost:5174/fonts/a.woff2',
            '/fonts/a.woff2',
            './a.woff2',
            '../fonts/a.woff2',
            'fonts/a.woff2',
        ]) {
            expect(safeFontUrl(url)).toBe(url);
        }
    });

    it('refuses other schemes and anything that could break out of url()', () => {
        for (const url of [
            'javascript:alert(1)',
            'data:font/woff2;base64,AAAA',
            '//evil.example/a.woff2',
            'a.woff2") ; x',
            "a'.woff2",
            'a(.woff2',
            'a\\b.woff2',
            'a b.woff2',
            '',
            `https://x/${'a'.repeat(3000)}`,
        ]) {
            expect(safeFontUrl(url)).toBeNull();
        }
    });
});
