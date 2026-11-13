import { describe, expect, it } from 'vite-plus/test';
import { textAt, uint32, uint32le } from '../../../src/core/audio/bytes';

describe('uint32', () => {
    it('reads big-endian numbers up to 2^32 - 1, never negative', () => {
        expect(uint32(Uint8Array.from([0, 0, 0x01, 0x02]), 0)).toBe(258);
        expect(uint32(Uint8Array.from([9, 0x80, 0, 0, 1]), 1)).toBe(
            2_147_483_649,
        );
        expect(uint32(Uint8Array.from([0xff, 0xff, 0xff, 0xff]), 0)).toBe(
            4_294_967_295,
        );
    });
});

describe('uint32le', () => {
    it('reads little-endian numbers up to 2^32 - 1, never negative', () => {
        expect(uint32le(Uint8Array.from([0x02, 0x01, 0, 0]), 0)).toBe(258);
        expect(uint32le(Uint8Array.from([9, 1, 0, 0, 0x80]), 1)).toBe(
            2_147_483_649,
        );
        expect(uint32le(Uint8Array.from([0xff, 0xff, 0xff, 0xff]), 0)).toBe(
            4_294_967_295,
        );
    });
});

describe('textAt', () => {
    it('matches a name at its place, and never past the end', () => {
        const bytes = Uint8Array.from([0x41, 0x42, 0x43]);

        expect(textAt(bytes, 1, 'BC')).toBe(true);
        expect(textAt(bytes, 0, 'BC')).toBe(false);
        expect(textAt(bytes, 2, 'CD')).toBe(false);
    });
});
