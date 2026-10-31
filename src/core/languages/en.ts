/**
 * English as spoken in the United States (`en`, `en-US`): SonicFrame's own words, what every piece
 * says unless the app picks another language, and the model every other language file follows.
 */

import type { Words } from './words';

export const EN: Words = {
    frame: {
        position: 'Audio position',
    },
    playButton: {
        play: 'Play',
        pause: 'Pause',
    },
    volume: {
        mute: 'Mute',
        unmute: 'Unmute',
        volume: 'Volume',
        muted: 'muted',
    },
    zoom: {
        view: 'Zoom {level}×, {from} to {to}',
    },
    minimap: {
        label: 'Visible part',
        value: '{from} to {to} of {total}',
    },
    chapters: {
        chapter: 'Chapter {index} of {count}',
        list: 'Chapters',
        none: 'No more chapters',
        link: 'Link',
    },
    markers: {
        more: 'and {count} more',
    },
    regions: {
        place: '{from} to {to}',
        loopOn: 'loop on',
        loopOff: 'loop off',
    },
    description: {
        length: '{duration}.',
        silence: '{duration} of silence.',
        continuous: 'Continuous sound.',
        silenceFor: 'Silence for {duration}',
        soundUntil: 'Sound until {at}',
        pause: 'a pause of {duration}',
        thenSoundUntil: 'then sound until {at}',
        thenSoundToEnd: 'then sound to the end',
        thenSilenceToEnd: 'then silence to the end',
        pauses: 'Sound with {count} pauses; the longest, {duration}, at {at}.',
        startsAfter: 'Starts after {duration} of silence.',
        endsWith: 'Ends with {duration} of silence.',
        even: 'Even volume.',
        rises: 'Gets louder toward the end.',
        falls: 'Gets quieter toward the end.',
        loudest: 'Loudest at {at}.',
        loudestStart: 'Loudest at the start.',
        part: 'Part {part} of {count}, {at}.',
        partStart: 'Part {part} of {count}, at the start.',
        noPart: 'No more parts.',
        pauseNote: 'pause',
        silenceNote: 'silence',
        join: ',',
        stop: '.',
    },
    player: {
        player: 'Audio player',
        position: 'Playback position',
        value: '{time} / {duration}',
        back: 'Back {seconds} seconds',
        forward: 'Forward {seconds} seconds',
        speed: 'Playback speed {speed}',
        listen: 'Hear the description',
        stopListening: 'Stop the description',
        speechFailed: 'The description could not be read aloud here.',
        zoomIn: 'Zoom in',
        zoomOut: 'Zoom out',
        zoomReset: 'Show the whole sound',
        previousChapter: 'Previous chapter',
        nextChapter: 'Next chapter',
        closeChapters: 'Close the chapters',
    },
};
