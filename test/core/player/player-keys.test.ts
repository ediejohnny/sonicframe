import { describe, expect, it } from 'vite-plus/test';
import {
    playerKeyAction,
    resolvePlayerKeys,
    speedAfter,
} from '../../../src/core/player/player-keys';

describe('resolvePlayerKeys', () => {
    it('is off unless asked for', () => {
        expect(resolvePlayerKeys(undefined)).toBeNull();
        expect(resolvePlayerKeys(false)).toBeNull();
    });

    it('gives every key its default when turned on', () => {
        expect(resolvePlayerKeys(true)).toEqual({
            scope: 'player',
            play: [' '],
            mute: ['m'],
            back: ['ArrowLeft'],
            forward: ['ArrowRight'],
            seconds: 5,
            volumeUp: ['ArrowUp'],
            volumeDown: ['ArrowDown'],
            volumeStep: 0.05,
            faster: ['>'],
            slower: ['<'],
        });
    });

    it('takes your own keys, switches one off, and keeps its numbers in range', () => {
        const settings = resolvePlayerKeys({
            scope: 'page',
            play: [' ', 'k'],
            mute: false,
            faster: '+',
            seconds: 500,
            volumeStep: -1,
        });

        expect(settings).toMatchObject({
            scope: 'page',
            play: [' ', 'k'],
            mute: [],
            faster: ['+'],
            slower: ['<'],
            seconds: 120,
            volumeStep: 0.01,
        });
        expect(
            resolvePlayerKeys({
                scope: 'everywhere' as 'page',
                seconds: Number.NaN,
                volumeStep: '0.2' as unknown as number,
            }),
        ).toMatchObject({ scope: 'player', seconds: 5, volumeStep: 0.05 });
        expect(resolvePlayerKeys({ seconds: 0.2 })?.seconds).toBe(1);
        expect(resolvePlayerKeys({ volumeStep: 3 })?.volumeStep).toBe(1);
    });
});

describe('playerKeyAction', () => {
    const settings = resolvePlayerKeys(true);

    if (settings === null) {
        throw new Error('test: the keys are off');
    }

    it('finds the action of each key', () => {
        const actions = [
            [' ', 'play'],
            ['m', 'mute'],
            ['ArrowLeft', 'back'],
            ['ArrowRight', 'forward'],
            ['ArrowUp', 'volumeUp'],
            ['ArrowDown', 'volumeDown'],
            ['>', 'faster'],
            ['<', 'slower'],
            ['x', null],
            ['Enter', null],
        ] as const;

        for (const [key, action] of actions) {
            expect(playerKeyAction(key, {}, settings), key).toBe(action);
        }
    });

    it('takes a letter whatever its case, and leaves Ctrl, Alt and ⌘ to the browser', () => {
        expect(playerKeyAction('M', {}, settings)).toBe('mute');
        expect(playerKeyAction('m', { ctrlKey: true }, settings)).toBeNull();
        expect(playerKeyAction(' ', { altKey: true }, settings)).toBeNull();
        expect(
            playerKeyAction('ArrowLeft', { metaKey: true }, settings),
        ).toBeNull();
    });

    it('plays and mutes once for a held key, while a held arrow keeps stepping', () => {
        expect(playerKeyAction(' ', { repeat: true }, settings)).toBeNull();
        expect(playerKeyAction('m', { repeat: true }, settings)).toBeNull();
        expect(playerKeyAction('ArrowUp', { repeat: true }, settings)).toBe(
            'volumeUp',
        );
        expect(playerKeyAction('>', { repeat: true }, settings)).toBe('faster');
    });
});

describe('speedAfter', () => {
    const speeds = [2, 1, 1.5, 1];

    it('goes up and down the speeds in order, without going round', () => {
        expect(speedAfter(1, speeds, 1)).toBe(1.5);
        expect(speedAfter(1.5, speeds, 1)).toBe(2);
        expect(speedAfter(2, speeds, 1)).toBeNull();
        expect(speedAfter(1.5, speeds, -1)).toBe(1);
        expect(speedAfter(2, speeds, -1)).toBe(1.5);
        expect(speedAfter(1, speeds, -1)).toBeNull();
    });

    it('finds the next speed from one that is not in the list, or a hair off one that is', () => {
        expect(speedAfter(1.25, speeds, 1)).toBe(1.5);
        expect(speedAfter(1.25, speeds, -1)).toBe(1);
        expect(speedAfter(1.499, speeds, 1)).toBe(2);
        expect(speedAfter(0.5, speeds, -1)).toBeNull();
    });
});
