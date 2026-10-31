/** The languages an app registers stop at a hundred; one already registered can still be replaced. */

import { expect, it } from 'vite-plus/test';
import { EN } from '../../../src/core/languages/en';
import { registerLanguage } from '../../../src/core/languages/language';

it('registers a hundred languages and no more', () => {
    const results = Array.from({ length: 120 }, (_, index) =>
        registerLanguage(`art-x-n${index}`, EN),
    );

    expect(results.filter(Boolean)).toHaveLength(100);
    expect(results.slice(0, 100).every(Boolean)).toBe(true);
    expect(registerLanguage('art-x-n0', EN)).toBe(true);
});
