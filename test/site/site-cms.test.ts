/**
 * The "On a CMS or WordPress" page: the KSES filter it gives allows exactly what `SONIC_TAGS` lists,
 * the attributes for trusted authors only left out, so the copy a site pastes never falls behind.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';
import { SONIC_TAGS } from '../../src/index';

const page = readFileSync(
    join(import.meta.dirname, '../../playground/cms.html'),
    'utf8',
);

/** The quoted names in the PHP `array( … )` that follows `'tag' =&gt; array(`. */
function phpList(tag: string): string[] {
    const start = page.indexOf(`'${tag}' =&gt; array(`);
    const end = page.indexOf('),', start);

    if (start < 0 || end < 0) {
        throw new Error(`test: no PHP list for ${tag}`);
    }

    return [
        ...page.slice(start + tag.length + 2, end).matchAll(/'([a-z0-9-]+)'/g),
    ].map((match) => match[1]);
}

/** The quoted names of the playlist links' list, between its comment and `true`. */
function linkList(): string[] {
    const from = page.indexOf(
        'array_fill_keys(',
        page.indexOf("// The playlist's links"),
    );
    const end = page.indexOf('true', from);

    return [...page.slice(from, end).matchAll(/'([a-z0-9-]+)'/g)].map(
        (match) => match[1],
    );
}

describe('the CMS page', () => {
    it('allows in WordPress exactly the attributes of SONIC_TAGS, but those for trusted authors only', () => {
        for (const { tag, attributes, trustedOnly } of SONIC_TAGS) {
            expect(phpList(tag), tag).toEqual(
                attributes.filter((name) => !trustedOnly.includes(name)),
            );
        }

        expect(linkList()).toEqual(SONIC_TAGS[1].children[0].attributes);
    });

    it('never allows an event handler or the recording upload address', () => {
        expect(page).not.toMatch(/'on[a-z]+'/);
        expect(phpList('sonic-recorder')).not.toContain('upload-url');
    });
});
