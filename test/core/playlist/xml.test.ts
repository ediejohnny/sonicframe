/**
 * Our own XML reader, for feeds: elements, attributes and text, CDATA and entities read; comments,
 * processing instructions and a doctype skipped; what is not well formed or declares entities
 * refused; the ceilings (depth, elements, attributes, names) at the defaults the most used readers
 * settled on, raised by options up to the most open of them; and a hostile text read in one pass.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vite-plus/test';
import { readXml } from '../../../src/core/playlist/xml';

/** `depth` elements, each in the one before. */
function nested(depth: number): string {
    return '<a>'.repeat(depth) + '</a>'.repeat(depth);
}

/** `count` elements: a root and its empty children. */
function many(count: number): string {
    return '<a>' + '<b/>'.repeat(count - 1) + '</a>';
}

describe('readXml', () => {
    it('reads elements, their attributes and their own text', () => {
        const root = readXml(
            `<?xml version="1.0"?>\n<rss version="2.0"><channel a='1' b = "two">Show<item/>more</channel></rss>`,
        );

        expect(root.name).toBe('rss');
        expect(root.attributes.get('version')).toBe('2.0');

        const [channel] = root.children;

        expect(channel.name).toBe('channel');
        expect([...channel.attributes]).toEqual([
            ['a', '1'],
            ['b', 'two'],
        ]);
        expect(channel.text).toBe('Showmore');
        expect(channel.children.map((child) => child.name)).toEqual(['item']);
    });

    it('reads CDATA as text as written, markup and references in it included', () => {
        const root = readXml('<t><![CDATA[<b>bold</b> & &amp;lt; "x"]]></t>');

        expect(root.text).toBe('<b>bold</b> & &amp;lt; "x"');
        expect(root.children).toEqual([]);
    });

    it('reads the five named entities and numeric ones, in text and attributes', () => {
        const root = readXml(
            '<t a="&quot;&#65;&#x42;">&lt;&gt;&amp;&apos;&#233;&#x1F600;</t>',
        );

        expect(root.attributes.get('a')).toBe('"AB');
        expect(root.text).toBe("<>&'é😀");
    });

    it('leaves an unknown entity as written, never reading a name off the object prototype', () => {
        const root = readXml(
            '<t>&toString; &__proto__; &nbsp; &AMP; &#12x; &amp;lt; & alone</t>',
        );

        expect(root.text).toBe(
            '&toString; &__proto__; &nbsp; &AMP; &#12x; &lt; & alone',
        );
    });

    it('reads a number that is no character as the replacement character', () => {
        expect(readXml('<t>&#0;&#xD800;&#x110000;</t>').text).toBe('���');
    });

    it('skips comments, processing instructions and a doctype', () => {
        const root = readXml(
            '<!DOCTYPE rss [<!ELEMENT rss ANY>]><rss><!-- <fake/> -->a<?pi <b/> ?>b</rss>',
        );

        expect(root.text).toBe('ab');
        expect(root.children).toEqual([]);
    });

    it('refuses a doctype that declares entities', () => {
        expect(() =>
            readXml('<!DOCTYPE t [<!entity a "x">]><t>&a;</t>'),
        ).toThrow(new TypeError('sonicframe: a feed may not declare entities'));
        expect(() => readXml('<!ENTITY a "x"><t>&a;</t>')).toThrow(
            new TypeError('sonicframe: a feed may not declare entities'),
        );
    });

    it.each([
        ['an unclosed tag', '<rss><channel>', 'an unclosed element'],
        ['a tag without its end', '<rss', 'an unclosed tag'],
        [
            'a closing tag that does not match',
            '<a><b></a></b>',
            'does not match',
        ],
        ['a closing tag with nothing open', '</a>', 'does not match'],
        ['two roots', '<a/><b/>', 'more than one root'],
        ['no element', 'just text', 'no element'],
        ['an attribute without quotes', '<a b=c/>', 'without quotes'],
        ['an unclosed attribute', '<a b="c/>', 'an unclosed attribute'],
        ['an unclosed CDATA', '<a><![CDATA[x</a>', 'an unclosed CDATA'],
        ['a tag without a name', '<a>< b/></a>', 'without a name'],
    ])('refuses %s', (_, text, why) => {
        expect(() => readXml(text)).toThrow(SyntaxError);
        expect(() => readXml(text)).toThrow(why);
    });

    it('reads 100 levels of nesting by default, and refuses 101, naming the option', () => {
        let deepest = readXml(nested(100));
        let levels = 1;

        while (deepest.children.length > 0) {
            deepest = deepest.children[0];
            levels += 1;
        }

        expect(levels).toBe(100);
        expect(() => readXml(nested(101))).toThrow(
            new RangeError('sonicframe: the XML goes past maxDepth (100)'),
        );
    });

    it('takes maxDepth from 1 to 256, from the most used readers', () => {
        expect(() => readXml(nested(2), { maxDepth: 1 })).toThrow(
            'maxDepth (1)',
        );
        expect(() => readXml(nested(2), { maxDepth: 0 })).toThrow(
            new RangeError('sonicframe: maxDepth goes under its least, 1 (0)'),
        );
        expect(readXml(nested(256), { maxDepth: 256 }).name).toBe('a');
        expect(() => readXml(nested(257), { maxDepth: 256 })).toThrow(
            'maxDepth (256)',
        );
        expect(() => readXml(nested(2), { maxDepth: 1000 })).toThrow(
            new RangeError(
                'sonicframe: maxDepth goes past its most, 256 (1000)',
            ),
        );
    });

    it('reads 200000 elements by default, and up to 1000000 when asked', () => {
        expect(readXml(many(200_000)).children).toHaveLength(199_999);
        expect(() => readXml(many(200_001))).toThrow(
            new RangeError(
                'sonicframe: the XML goes past maxElements (200000)',
            ),
        );
        expect(readXml(many(3), { maxElements: 3 }).children).toHaveLength(2);
        expect(() => readXml(many(3), { maxElements: 2 })).toThrow(
            'maxElements (2)',
        );
        expect(
            readXml(many(200_001), { maxElements: 1_000_000 }).children,
        ).toHaveLength(200_000);
        expect(() =>
            readXml(many(1_000_001), { maxElements: 1_000_000 }),
        ).toThrow('maxElements (1000000)');
        expect(() => readXml(many(3), { maxElements: 1e9 })).toThrow(
            'maxElements goes past its most, 1000000',
        );
    });

    it('reads 200 attributes on an element by default, and up to 10000 when asked', () => {
        const attributes = (count: number): string =>
            `<a ${Array.from({ length: count }, (_, at) => `n${at}="${at}"`).join(' ')}/>`;

        expect(readXml(attributes(200)).attributes.size).toBe(200);
        expect(() => readXml(attributes(201))).toThrow(
            new RangeError('sonicframe: the XML goes past maxAttributes (200)'),
        );
        expect(
            readXml(attributes(10_000), { maxAttributes: 10_000 }).attributes
                .size,
        ).toBe(10_000);
        expect(() =>
            readXml(attributes(10_001), { maxAttributes: 10_000 }),
        ).toThrow('maxAttributes (10000)');
        expect(() => readXml(attributes(2), { maxAttributes: 10_001 })).toThrow(
            'maxAttributes goes past its most, 10000',
        );
        expect(() => readXml(attributes(2), { maxAttributes: 1 })).toThrow(
            'maxAttributes (1)',
        );
    });

    it('reads names of 1000 characters by default, and up to 50000 when asked', () => {
        const element = (length: number): string => `<${'e'.repeat(length)}/>`;
        const attribute = (length: number): string =>
            `<a ${'n'.repeat(length)}="1"/>`;

        expect(readXml(element(1000)).name).toHaveLength(1000);
        expect(() => readXml(element(1001))).toThrow(
            new RangeError(
                'sonicframe: the XML goes past maxNameLength (1000)',
            ),
        );
        expect(readXml(attribute(1000)).attributes.size).toBe(1);
        expect(() => readXml(attribute(1001))).toThrow('maxNameLength (1000)');
        expect(
            readXml(element(50_000), { maxNameLength: 50_000 }).name,
        ).toHaveLength(50_000);
        expect(() =>
            readXml(attribute(50_001), { maxNameLength: 50_000 }),
        ).toThrow('maxNameLength (50000)');
        expect(() => readXml(element(1), { maxNameLength: 50_001 })).toThrow(
            'maxNameLength goes past its most, 50000',
        );
    });

    it.each([
        ['lone ampersands', '<a>' + '&'.repeat(262_144) + '</a>'],
        ['bare doctypes', '<a/>' + '<!a>'.repeat(65_536)],
        ['empty elements', '<a>' + '<b/>'.repeat(65_536) + '</a>'],
    ])('reads 256 KB of %s in one pass', (_, text) => {
        // One pass takes about 0.03 s; searching the rest of the text again at each `&` or `<!` (what
        // this guards against) takes 3 s or more at this size, and finishes, so the test can fail.
        const started = performance.now();

        try {
            readXml(text);
        } catch {
            // Refusing is fine; only the time is measured.
        }

        expect(performance.now() - started).toBeLessThan(1000);
    });

    it('never throws anything but a SyntaxError, a TypeError or a RangeError', () => {
        const piece = fc.constantFrom(
            '<a>',
            '</a>',
            '<b x="1">',
            '</b>',
            '<c/>',
            '<!--',
            '-->',
            '<![CDATA[',
            ']]>',
            '<?',
            '?>',
            '<!DOCTYPE [',
            ']>',
            '<!ENTITY',
            '&amp;',
            '&#',
            '&',
            ';',
            '"',
            '=',
            '<',
            '>',
            'text',
        );

        fc.assert(
            fc.property(fc.array(piece, { maxLength: 30 }), (pieces) => {
                try {
                    readXml(pieces.join(''));
                } catch (error) {
                    expect(
                        error instanceof SyntaxError ||
                            error instanceof TypeError ||
                            error instanceof RangeError,
                    ).toBe(true);
                }
            }),
        );
    });
});
