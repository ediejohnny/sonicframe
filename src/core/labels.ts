/**
 * The accessible names and words of the ready-made player, in English and Portuguese. Pure: the app
 * picks the language (English unless it asks for another) and can replace any label; every label it
 * gives is cleaned and capped, and marks are filled with SonicFrame's own values only.
 */

import type { ValueText } from './controller';
import { localeFor, resolveLanguage, type Language } from './language';
import { clamp01 } from './math';
import { cleanText, fillTemplate } from './text';
import { formatTime } from './timing';

/** What the player says. `{name}` marks are filled in. */
export type PlayerLabels = {
    /** The player as a whole (a group). */
    player: string;
    /** The wave, a slider. */
    position: string;
    /** The slider's value: `{time}`, `{duration}`. */
    value: string;
    play: string;
    pause: string;
    /** `{seconds}`. */
    back: string;
    /** `{seconds}`. */
    forward: string;
    /** `{speed}`, as in `1.5×`. */
    speed: string;
    mute: string;
    unmute: string;
    volume: string;
    /** The button that reads the description with the browser's voice. */
    listen: string;
    /** The same button while the voice reads. */
    stopListening: string;
    /** Said when the browser cannot read the description aloud (no voice for the language, say). */
    speechFailed: string;
    zoomIn: string;
    zoomOut: string;
    /** The button back to the whole sound. */
    zoomReset: string;
    /** A new view, said after a zoom: `{level}`, `{from}`, `{to}`. */
    zoomView: string;
    /** The minimap as a slider. */
    minimap: string;
    /** The minimap's value: `{from}`, `{to}`, `{total}`. */
    minimapValue: string;
};

export const PLAYER_LABELS: Readonly<Record<Language, Readonly<PlayerLabels>>> =
    Object.freeze({
        en: Object.freeze({
            player: 'Audio player',
            position: 'Playback position',
            value: '{time} / {duration}',
            play: 'Play',
            pause: 'Pause',
            back: 'Back {seconds} seconds',
            forward: 'Forward {seconds} seconds',
            speed: 'Playback speed {speed}',
            mute: 'Mute',
            unmute: 'Unmute',
            volume: 'Volume',
            listen: 'Hear the description',
            stopListening: 'Stop the description',
            speechFailed: 'The description could not be read aloud here.',
            zoomIn: 'Zoom in',
            zoomOut: 'Zoom out',
            zoomReset: 'Show the whole sound',
            zoomView: 'Zoom {level}×, {from} to {to}',
            minimap: 'Visible part',
            minimapValue: '{from} to {to} of {total}',
        }),
        pt: Object.freeze({
            player: 'Player de áudio',
            position: 'Posição da reprodução',
            value: '{time} de {duration}',
            play: 'Reproduzir',
            pause: 'Pausar',
            back: 'Voltar {seconds} segundos',
            forward: 'Avançar {seconds} segundos',
            speed: 'Velocidade {speed}',
            mute: 'Silenciar',
            unmute: 'Ativar o som',
            volume: 'Volume',
            listen: 'Ouvir a descrição',
            stopListening: 'Parar a descrição',
            speechFailed: 'Não foi possível ler a descrição em voz alta aqui.',
            zoomIn: 'Aproximar',
            zoomOut: 'Afastar',
            zoomReset: 'Mostrar o som inteiro',
            zoomView: 'Zoom {level}×, de {from} a {to}',
            minimap: 'Parte visível',
            minimapValue: '{from} a {to} de {total}',
        }),
    });

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
    /** The slider's value in words, from the `value` label. */
    valueText: ValueText;
};

/** The labels for a language tag, with the app's own over them. */
export function playerWords(
    lang: string | null | undefined,
    own?: Partial<PlayerLabels>,
): PlayerWords {
    const locale = localeFor(lang, own !== undefined);
    const labels = { ...PLAYER_LABELS[resolveLanguage(lang)] };

    for (const key of Object.keys(labels) as (keyof PlayerLabels)[]) {
        const value: unknown = own?.[key];

        if (typeof value === 'string') {
            labels[key] = cleanText(value, MAX_LABEL);
        }
    }

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
        valueText: (time, ratio, duration) =>
            time !== null && duration !== null
                ? fillTemplate(labels.value, {
                      time: formatTime(time),
                      duration: formatTime(duration),
                  })
                : `${Math.round(clamp01(ratio) * 100)}%`,
    };
}
