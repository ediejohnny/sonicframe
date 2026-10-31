/** French: `fr` and every tag that starts with it (`fr-FR`, `fr-CA`). */

import type { Words } from './words';

export const FR: Words = {
    frame: {
        position: 'Position dans l’audio',
    },
    playButton: {
        play: 'Lecture',
        pause: 'Pause',
    },
    volume: {
        mute: 'Couper le son',
        unmute: 'Rétablir le son',
        volume: 'Volume',
        muted: 'son coupé',
    },
    zoom: {
        view: 'Zoom {level}×, de {from} à {to}',
    },
    minimap: {
        label: 'Partie visible',
        value: '{from} à {to} sur {total}',
    },
    chapters: {
        chapter: 'Chapitre {index} sur {count}',
        list: 'Chapitres',
        none: 'Plus aucun chapitre',
        link: 'Lien',
    },
    markers: {
        more: 'et {count} de plus',
    },
    regions: {
        place: 'de {from} à {to}',
        loopOn: 'boucle activée',
        loopOff: 'boucle désactivée',
    },
    description: {
        length: '{duration}.',
        silence: '{duration} de silence.',
        continuous: 'Son continu.',
        silenceFor: 'Silence pendant {duration}',
        soundUntil: 'Son jusqu’à {at}',
        pause: 'une pause de {duration}',
        thenSoundUntil: 'puis son jusqu’à {at}',
        thenSoundToEnd: 'puis son jusqu’à la fin',
        thenSilenceToEnd: 'puis silence jusqu’à la fin',
        pauses: 'Son avec {count} pauses, la plus longue de {duration} vers {at}.',
        startsAfter: 'Commence après {duration} de silence.',
        endsWith: 'Se termine par {duration} de silence.',
        even: 'Volume régulier.',
        rises: 'Devient plus fort vers la fin.',
        falls: 'Devient plus faible vers la fin.',
        loudest: 'Plus fort vers {at}.',
        loudestStart: 'Plus fort au début.',
        part: 'Partie {part} sur {count}, {at}.',
        partStart: 'Partie {part} sur {count}, au début.',
        noPart: 'Plus aucune partie.',
        pauseNote: 'pause',
        silenceNote: 'silence',
        join: ',',
        stop: '.',
    },
    player: {
        player: 'Lecteur audio',
        position: 'Position de lecture',
        value: '{time} sur {duration}',
        back: 'Reculer de {seconds} secondes',
        forward: 'Avancer de {seconds} secondes',
        speed: 'Vitesse de lecture {speed}',
        listen: 'Écouter la description',
        stopListening: 'Arrêter la description',
        speechFailed: 'La description n’a pas pu être lue à voix haute ici.',
        zoomIn: 'Zoom avant',
        zoomOut: 'Zoom arrière',
        zoomReset: 'Afficher tout le son',
        previousChapter: 'Chapitre précédent',
        nextChapter: 'Chapitre suivant',
        closeChapters: 'Fermer les chapitres',
    },
};
