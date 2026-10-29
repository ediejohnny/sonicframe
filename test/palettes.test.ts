import { describe, expect, it } from 'vite-plus/test';
import { contrastRatio, parseHex, type Rgba } from '../src/core/color';
import {
    PALETTE_NAMES,
    PALETTES,
    paletteVariables,
    pickPalette,
    type Palette,
} from '../src/core/palettes';

function rgb(hex: string): Rgba {
    const color = parseHex(hex);

    if (color === null) {
        throw new Error(`not a hex color: ${hex}`);
    }

    return color;
}

function contrast(a: string, b: string): number {
    return contrastRatio(rgb(a), rgb(b));
}

describe('parseHex', () => {
    it('reads three, four, six and eight digits', () => {
        expect(parseHex('#fff')).toEqual([255, 255, 255, 1]);
        expect(parseHex('#0008')).toEqual([0, 0, 0, 0.533]);
        expect(parseHex('#2f6fdb')).toEqual([47, 111, 219, 1]);
        expect(parseHex('#2f6fdb80')).toEqual([47, 111, 219, 0.502]);
    });

    it('refuses anything else', () => {
        for (const value of ['', '2f6fdb', '#12', '#ggg', 'red', '#12345']) {
            expect(parseHex(value)).toBeNull();
        }
    });
});

describe('palettes', () => {
    const entries = Object.entries(PALETTES) as [string, Palette][];

    it('are plain hex colors only', () => {
        for (const [, palette] of entries) {
            for (const value of Object.values(palette)) {
                expect(parseHex(value)).not.toBeNull();
            }
        }
    });

    it('keep text readable and controls visible (WCAG)', () => {
        for (const [name, p] of entries) {
            const report = `${name}`;

            expect(contrast(p.text, p.surface), report).toBeGreaterThanOrEqual(
                4.5,
            );
            expect(contrast(p.muted, p.surface), report).toBeGreaterThanOrEqual(
                4.5,
            );
            expect(
                contrast(p.onAccent, p.accent),
                report,
            ).toBeGreaterThanOrEqual(4.5);
            expect(
                contrast(p.onAccent, p.progress),
                report,
            ).toBeGreaterThanOrEqual(4.5);
            expect(
                contrast(p.onAccent, p.marker),
                report,
            ).toBeGreaterThanOrEqual(4.5);
            expect(
                contrast(p.accent, p.surface),
                report,
            ).toBeGreaterThanOrEqual(3);
            expect(
                contrast(p.progress, p.surface),
                report,
            ).toBeGreaterThanOrEqual(3);
            expect(
                contrast(p.marker, p.surface),
                report,
            ).toBeGreaterThanOrEqual(3);
            expect(contrast(p.progress, p.wave), report).toBeGreaterThanOrEqual(
                3,
            );
            expect(contrast(p.wave, p.surface), report).toBeGreaterThanOrEqual(
                1.4,
            );
        }
    });

    it('lists every palette by name', () => {
        expect([...PALETTE_NAMES].sort()).toEqual(Object.keys(PALETTES).sort());
        expect(PALETTE_NAMES).toHaveLength(8);
    });

    it('follows the system for auto and knows only its own names', () => {
        expect(pickPalette('auto', false)).toBe(PALETTES.light);
        expect(pickPalette('auto', true)).toBe(PALETTES.dark);
        expect(pickPalette('ocean', true)).toBe(PALETTES.ocean);
        expect(pickPalette('lava', false)).toBeNull();
    });

    it('turns into the custom properties the frame and plugins read', () => {
        const variables = new Map(paletteVariables(PALETTES.light));

        expect(variables.get('--sonicframe-wave')).toBe(PALETTES.light.wave);
        expect(variables.get('--sonicframe-progress')).toBe(
            PALETTES.light.progress,
        );
        expect(variables.get('--sonicframe-button')).toBe(
            PALETTES.light.accent,
        );
        expect(variables.get('--sonicframe-region')).toBe(
            PALETTES.light.region,
        );
        for (const name of variables.keys()) {
            expect(name.startsWith('--sonicframe-')).toBe(true);
        }
    });
});
