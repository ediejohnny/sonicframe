import { describe, expect, it } from 'vite-plus/test';
import { applyStyles, type StyleLike } from '../src/core/styles';

/**
 * An inline style that, like browsers, stores some prefixed properties as aliases of the standard
 * one (Chrome keeps `-webkit-user-select` and `user-select` as one value).
 */
class FakeStyle implements StyleLike {
    readonly values = new Map<string, [string, string]>();

    private key(property: string): string {
        return property === '-webkit-user-select' ? 'user-select' : property;
    }

    getPropertyValue(property: string): string {
        return this.values.get(this.key(property))?.[0] ?? '';
    }

    getPropertyPriority(property: string): string {
        return this.values.get(this.key(property))?.[1] ?? '';
    }

    setProperty(property: string, value: string, priority = ''): void {
        this.values.set(this.key(property), [value, priority]);
    }

    removeProperty(property: string): string {
        const value = this.getPropertyValue(property);
        this.values.delete(this.key(property));

        return value;
    }
}

describe('applyStyles', () => {
    it('puts back what was there, keeping priorities', () => {
        const style = new FakeStyle();
        style.setProperty('position', 'absolute', 'important');

        const restore = applyStyles(style, [
            ['position', 'relative'],
            ['touch-action', 'pan-y'],
        ]);

        expect(style.getPropertyValue('position')).toBe('relative');

        restore();

        expect([...style.values]).toEqual([
            ['position', ['absolute', 'important']],
        ]);
    });

    it('leaves nothing behind when two properties are aliases of each other', () => {
        const style = new FakeStyle();

        const restore = applyStyles(style, [
            ['user-select', 'none'],
            ['-webkit-user-select', 'none'],
        ]);
        restore();

        expect([...style.values]).toEqual([]);
    });

    it('brings back an aliased value the page had set', () => {
        const style = new FakeStyle();
        style.setProperty('user-select', 'text');

        const restore = applyStyles(style, [
            ['user-select', 'none'],
            ['-webkit-user-select', 'none'],
        ]);
        restore();

        expect(style.getPropertyValue('user-select')).toBe('text');
    });
});
