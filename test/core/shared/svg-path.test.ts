import { describe, expect, it } from 'vite-plus/test';
import { svgPath } from '../../../src/core/shared/svg-path';

const FALLBACK = 'M7 7h10v10H7z';

describe('svgPath', () => {
    it('keeps path data made of commands, numbers and separators', () => {
        for (const path of [
            'M12 2a10 10 0 1 0 0 20z',
            'm3,20.5 18-8.5L3 3.5V10l12 2-12 2z',
            ' M1e-3 2E+2 L4.5.5 Z ',
            'M0 0C1 1 2 2 3 3S4 4 5 5Q6 6 7 7T8 8H9V10z',
        ]) {
            expect(svgPath(path, FALLBACK), path).toBe(path);
        }
    });

    it('gives the fallback for anything else: other characters, no move first, too long, not text', () => {
        for (const given of [
            'M0 0<script>',
            'M0 0 url(#a)',
            'M0 0"/><image href="x',
            'L0 0h10',
            '',
            `M0 0${' h1'.repeat(2000)}`,
            42,
            null,
            undefined,
        ]) {
            expect(svgPath(given, FALLBACK), String(given)).toBe(FALLBACK);
        }
    });

    it('keeps a path of exactly 4096 characters', () => {
        const path = `M0 0${' '.repeat(4092)}`;

        expect(path).toHaveLength(4096);
        expect(svgPath(path, FALLBACK)).toBe(path);
        expect(svgPath(`${path} `, FALLBACK)).toBe(FALLBACK);
    });
});
