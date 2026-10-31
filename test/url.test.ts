import { describe, expect, it } from 'vite-plus/test';
import { safeFontUrl } from '../src/core/fonts';
import { safeUrl } from '../src/core/url';

describe('safeUrl', () => {
    it('keeps web and relative addresses', () => {
        for (const url of [
            'https://example.com/a.jpg',
            'HTTP://example.com',
            '/notes#part-2',
            'images/cover.png?size=2',
            'a(1).jpg',
        ]) {
            expect(safeUrl(url), url).toBe(url);
        }
    });

    it('refuses other schemes, another host by //, backslashes, spaces and control characters', () => {
        for (const url of [
            'javascript:alert(1)',
            'JaVaScRiPt:alert(1)',
            'data:image/png;base64,AA',
            'blob:https://example.com/1',
            '//evil.example/x',
            '\\\\evil.example',
            '/\\evil.example',
            ' javascript:alert(1)',
            'java\tscript:alert(1)',
            'https://example.com/\u0000',
            '',
            `https://example.com/${'a'.repeat(2048)}`,
        ]) {
            expect(safeUrl(url), JSON.stringify(url)).toBeNull();
        }
    });

    it('takes more schemes only when asked', () => {
        expect(safeUrl('blob:https://example.com/1', ['https', 'blob'])).toBe(
            'blob:https://example.com/1',
        );
        expect(safeUrl('http://example.com', ['https'])).toBeNull();
    });

    it("keeps a font address's own refusals: nothing that could close url(...)", () => {
        expect(safeFontUrl('a(1).woff2')).toBeNull();
        expect(safeFontUrl('/fonts/"x".woff2')).toBeNull();
        expect(safeFontUrl('/fonts/x.woff2')).toBe('/fonts/x.woff2');
    });
});
