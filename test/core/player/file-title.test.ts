/**
 * A sound's name read from its address: the file's name alone, without its folder, query, hash or
 * extension, dashes and underscores as spaces, the first letter in capitals, cleaned like outside text.
 */

import { describe, expect, it } from 'vite-plus/test';
import { fileTitle } from '../../../src/core/player/file-title';

describe('fileTitle', () => {
    it.each([
        ['little-elf.mp3', 'Little elf'],
        ['/sounds/little-elf.mp3?v=2', 'Little elf'],
        ['https://cdn.test/a/b/night_walk.ogg#t=10', 'Night walk'],
        ['/s/song.mp3?next=/other/file.ogg', 'Song'],
        ['/s/song.mp3#v1.2', 'Song'],
        ['episode--01__final.mp3', 'Episode 01 final'],
        ['no-extension', 'No extension'],
        ['.hidden', '.hidden'],
        ['take.one.wav', 'Take.one'],
        ['https://cdn.test/sounds/', ''],
        ['', ''],
    ])('%s reads as "%s"', (address, name) => {
        expect(fileTitle(address)).toBe(name);
    });

    it('decodes escapes, and keeps a broken one as written', () => {
        expect(fileTitle('/s/caf%C3%A9%20noir.mp3')).toBe('Café noir');
        expect(fileTitle('/s/bad%E0%A4%A.mp3')).toBe('Bad%E0%A4%A');
    });

    it('splits the folder and the query before decoding: an escaped "/" or "?" is part of the name', () => {
        expect(fileTitle('/s/a%2Fb%3Fc.mp3')).toBe('A/b?c');
    });

    it('cleans what the name hides: controls, direction marks, markup stays text', () => {
        expect(fileTitle('/s/evil%07%E2%80%AEname.mp3')).toBe('Evil name');
        expect(
            fileTitle('/s/%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E.mp3'),
        ).toBe('<img src=x onerror=alert(1)>');
    });

    it('keeps at most 120 characters', () => {
        expect(fileTitle(`/s/${'a'.repeat(300)}.mp3`)).toHaveLength(120);
    });
});
