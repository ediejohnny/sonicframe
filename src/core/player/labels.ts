/**
 * The accessible names and words of the ready-made player, in each language SonicFrame speaks. Pure:
 * the app picks the language (English unless it asks for another) and can replace any label; every
 * label it gives is cleaned and capped, and marks are filled with SonicFrame's own values only.
 */

import type { ValueText } from '../frame/controller';
import {
    byLanguage,
    localeFor,
    wordsFor,
    type Language,
} from '../languages/language';
import { mergeWords } from '../languages/merge-words';
import type { PlayerLabels, Words } from '../languages/words';
import { clamp01 } from '../shared/math';
import { cleanText, fillTemplate } from '../shared/text';
import { formatPosition, formatTime } from '../shared/timing';

/** The player's labels in one language: its own words, and those of the pieces it is built of. */
function playerLabels(words: Readonly<Words>): PlayerLabels {
    const { player, playButton, volume, zoom, minimap, chapters } = words;

    return {
        player: player.player,
        position: player.position,
        value: player.value,
        play: playButton.play,
        pause: playButton.pause,
        back: player.back,
        backOne: player.backOne,
        forward: player.forward,
        forwardOne: player.forwardOne,
        speed: player.speed,
        mute: volume.mute,
        unmute: volume.unmute,
        volume: volume.volume,
        muted: volume.muted,
        listen: player.listen,
        stopListening: player.stopListening,
        speechFailed: player.speechFailed,
        zoomIn: player.zoomIn,
        zoomOut: player.zoomOut,
        zoomReset: player.zoomReset,
        zoomView: zoom.view,
        minimap: minimap.label,
        minimapValue: minimap.value,
        chapter: chapters.chapter,
        chapters: chapters.list,
        noChapter: chapters.none,
        chapterLink: chapters.link,
        previousChapter: player.previousChapter,
        nextChapter: player.nextChapter,
        previousTrack: player.previousTrack,
        nextTrack: player.nextTrack,
        closeChapters: player.closeChapters,
        resume: player.resume,
    };
}

/** The player's labels in each built-in language. */
export const PLAYER_LABELS: Readonly<Record<Language, Readonly<PlayerLabels>>> =
    byLanguage(playerLabels);

/** The longest label taken from the app, in characters. */
const MAX_LABEL = 120;

/** The player's words in one language. */
export type PlayerWords = {
    /** The language tag the words are in. */
    readonly locale: string;
    readonly labels: Readonly<PlayerLabels>;
    /** A label with its marks filled in. */
    say(
        name: keyof PlayerLabels,
        values?: Readonly<Record<string, string>>,
    ): string;
    /** A number in the language (`1,5` in Portuguese). */
    number(value: number): string;
    /** Whether the language says `value` in the singular ("1 second"), by its plural rules. */
    one(value: number): boolean;
    /** The slider's value in words, from the `value` label. */
    valueText: ValueText;
};

/** The labels for a language tag, with the app's own over them. */
export function playerWords(
    lang: string | null | undefined,
    own?: Partial<PlayerLabels>,
): PlayerWords {
    const locale = localeFor(lang, own !== undefined);
    const labels = mergeWords(playerLabels(wordsFor(lang)), own, MAX_LABEL);

    // The app's own plural without its singular stands for both, never mixed with the language's.
    for (const [many, single] of [
        ['back', 'backOne'],
        ['forward', 'forwardOne'],
    ] as const) {
        if (
            typeof own?.[many] === 'string' &&
            typeof own[single] !== 'string'
        ) {
            labels[single] = labels[many];
        }
    }

    const plural = new Intl.PluralRules(locale);
    const number = (value: number): string =>
        new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
            value,
        );

    return {
        locale,
        labels,
        say: (name, values = {}) =>
            cleanText(fillTemplate(labels[name], values), MAX_LABEL),
        number,
        one: (value) => plural.select(value) === 'one',
        valueText: (time, ratio, duration) =>
            time !== null && duration !== null
                ? fillTemplate(labels.value, {
                      time: formatPosition(time, duration),
                      duration: formatTime(duration),
                  })
                : `${Math.round(clamp01(ratio) * 100)}%`,
    };
}
