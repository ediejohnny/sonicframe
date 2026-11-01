/** Lengths an app writes with their unit, read into an amount and a unit. */

import { describe, expect, it } from 'vite-plus/test';
import { readLength } from '../../../src/core/shared/length';

describe('readLength', () => {
    it('reads a number followed by rem or px, spaces around it allowed', () => {
        expect(readLength('1.25rem')).toEqual({ amount: 1.25, unit: 'rem' });
        expect(readLength(' 20px ')).toEqual({ amount: 20, unit: 'px' });
        expect(readLength('.5rem')).toEqual({ amount: 0.5, unit: 'rem' });
        expect(readLength('3.px')).toEqual({ amount: 3, unit: 'px' });
        expect(readLength('-2px')).toEqual({ amount: -2, unit: 'px' });
    });

    it('takes nothing else: no unit, another unit, a broken number, more after it, or not a string', () => {
        for (const odd of [
            '20',
            '20em',
            '1.2.3px',
            'px',
            '2 rem',
            '20pxx',
            '1rem 2rem',
            '',
            20,
            null,
        ]) {
            expect(readLength(odd)).toBeNull();
        }
    });
});
