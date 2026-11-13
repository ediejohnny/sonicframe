import { describe, expect, it } from 'vite-plus/test';
import { id3Size, soundKind } from '../../../src/core/audio/sniff';
import {
    adtsHeader,
    ascii,
    bytes,
    MP3_HEADER,
} from '../../support/sound-files';

describe('soundKind', () => {
    it('tells each format by its first bytes', () => {
        const cases: [Uint8Array, string | null][] = [
            [bytes(ascii('RIFF'), 0, 0, 0, 0, ascii('WAVE')), 'wav'],
            [bytes(ascii('RF64'), 0, 0, 0, 0, ascii('WAVE')), 'wav'],
            [bytes(ascii('OggS'), 0, 2, 0, 0, 0, 0, 0, 0), 'ogg'],
            [bytes(ascii('fLaC'), 0, 0, 0, 34, 0, 0, 0, 0), 'flac'],
            [bytes(0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0), 'webm'],
            [bytes(0, 0, 0, 0x20, ascii('ftypM4A ')), 'mp4'],
            [bytes(adtsHeader(300), 0, 0, 0, 0, 0), 'adts'],
            [bytes(MP3_HEADER, 0, 0, 0, 0, 0, 0, 0, 0), 'mp3'],
            [bytes(ascii('RIFF'), 0, 0, 0, 0, ascii('AVI ')), null],
            [bytes(ascii('<html><body>')), null],
            [new Uint8Array(12), null],
        ];

        for (const [data, kind] of cases) {
            expect(soundKind(data)).toBe(kind);
        }
    });
});

describe('id3Size', () => {
    it('reads the tag size, safe-synced, with the footer when its flag is set', () => {
        expect(id3Size(bytes(ascii('ID3'), 4, 0, 0, 0, 0, 0x02, 0x01))).toBe(
            10 + 257,
        );
        expect(id3Size(bytes(ascii('ID3'), 4, 0, 0x10, 0x01, 0, 0, 0))).toBe(
            10 + 0x200000 + 10,
        );
    });

    it('says 0 when there is no tag, or its size bytes break the rule', () => {
        expect(id3Size(bytes(MP3_HEADER, 0, 0, 0, 0, 0, 0))).toBe(0);
        expect(id3Size(bytes(ascii('ID3'), 4, 0, 0, 0, 0, 0x80, 0))).toBe(0);
        expect(id3Size(bytes(ascii('IDX'), 0))).toBe(0);
    });

    it('waits for more bytes while what came may still be a tag', () => {
        expect(id3Size(bytes(ascii('ID')))).toBeNull();
        expect(id3Size(bytes(ascii('ID3'), 4, 0, 0, 0))).toBeNull();
    });
});
