import { describe, expect, it } from 'vite-plus/test';
import {
    levelAt,
    unmutedLevel,
    volumeAfterKey,
    volumeIcon,
    volumeText,
} from '../src/core/volume';

describe('volumeIcon', () => {
    it('shows a muted speaker when muted or silent, one wave when low, two when loud', () => {
        expect(volumeIcon(0.8, true)).toBe('muted');
        expect(volumeIcon(0, false)).toBe('muted');
        expect(volumeIcon(0.3, false)).toBe('low');
        expect(volumeIcon(0.5, false)).toBe('high');
        expect(volumeIcon(Number.NaN, false)).toBe('muted');
    });
});

describe('volumeAfterKey', () => {
    it('steps with the arrows, jumps with the page keys, Home and End', () => {
        expect(volumeAfterKey('ArrowRight', 0.5, 0.05)).toBe(0.55);
        expect(volumeAfterKey('ArrowUp', 0.5, 0.05)).toBe(0.55);
        expect(volumeAfterKey('ArrowLeft', 0.5, 0.05)).toBe(0.45);
        expect(volumeAfterKey('ArrowDown', 0.5, 0.05)).toBe(0.45);
        expect(volumeAfterKey('PageUp', 0.5, 0.05)).toBe(0.6);
        expect(volumeAfterKey('PageDown', 0.5, 0.05)).toBe(0.4);
        expect(volumeAfterKey('Home', 0.5, 0.05)).toBe(0);
        expect(volumeAfterKey('End', 0.5, 0.05)).toBe(1);
    });

    it('never leaves 0..1 and ignores other keys', () => {
        expect(volumeAfterKey('ArrowRight', 0.98, 0.05)).toBe(1);
        expect(volumeAfterKey('ArrowLeft', 0.02, 0.05)).toBe(0);
        expect(volumeAfterKey('Enter', 0.5, 0.05)).toBeNull();
    });
});

describe('volumeText', () => {
    it('says the level in percent, or muted', () => {
        expect(volumeText(0.4, false)).toBe('40%');
        expect(volumeText(0.4, true)).toBe('muted');
    });
});

describe('unmutedLevel', () => {
    it('brings back the last level, or half after silence', () => {
        expect(unmutedLevel(0.7)).toBe(0.7);
        expect(unmutedLevel(0)).toBe(0.5);
    });
});

describe('levelAt', () => {
    it('reads the level under the pointer, kept inside 0..1', () => {
        expect(levelAt(40, 80)).toBe(0.5);
        expect(levelAt(-10, 80)).toBe(0);
        expect(levelAt(200, 80)).toBe(1);
        expect(levelAt(10, 0)).toBe(0);
    });
});
