/** Shortcut letters an app chooses, and which way a press of one steps. */

import { describe, expect, it } from 'vite-plus/test';
import { letterKeys, letterStep } from '../../../src/core/shared/keys';

describe('letterKeys', () => {
    it('gives the fallback letter and a second of grace when on, and no letter when off', () => {
        expect(letterKeys(true, 'c')).toEqual({ letter: 'c', backGrace: 1 });
        expect(letterKeys(undefined, 'c')).toEqual({
            letter: 'c',
            backGrace: 1,
        });
        expect(letterKeys(false, 'c')).toEqual({ letter: null, backGrace: 1 });
    });

    it('takes its own letter in lower case, false, and a grace kept from the least given up', () => {
        expect(letterKeys({ letter: 'N', backGrace: 3 }, 'c')).toEqual({
            letter: 'n',
            backGrace: 3,
        });
        expect(letterKeys({ letter: false }, 'c').letter).toBeNull();
        expect(letterKeys({ letter: 'Enter' }, 'c').letter).toBeNull();
        expect(letterKeys({ backGrace: -2 }, 'c').backGrace).toBe(0);
        expect(letterKeys({ backGrace: 0 }, 'm', 0.01).backGrace).toBe(0.01);
        expect(letterKeys({ backGrace: Number.NaN }, 'c').backGrace).toBe(1);
    });
});

describe('letterStep', () => {
    it('steps forward on the letter and back with Shift, whatever its case', () => {
        expect(letterStep('c', {}, 'c')).toBe(1);
        expect(letterStep('C', {}, 'c')).toBe(1);
        expect(letterStep('c', { shiftKey: true }, 'c')).toBe(-1);
        expect(letterStep('C', { shiftKey: true }, 'c')).toBe(-1);
    });

    it('takes no other key, no letter, and no press with Ctrl, Alt or Meta', () => {
        expect(letterStep('d', {}, 'c')).toBeNull();
        expect(letterStep('c', {}, null)).toBeNull();

        for (const held of ['ctrlKey', 'altKey', 'metaKey']) {
            expect(letterStep('c', { [held]: true }, 'c')).toBeNull();
        }
    });
});
