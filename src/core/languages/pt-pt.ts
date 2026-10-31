/**
 * Portuguese as spoken in Portugal: `pt-PT`. A variant of the Portuguese of Brazil (`pt.ts`), so it
 * holds only the phrases Portugal says otherwise; every other phrase is Brazil's.
 */

import { PT } from './pt';
import type { Words } from './words';

export const PT_PT: Words = {
    ...PT,
    chapters: {
        ...PT.chapters,
        link: 'Ligação',
    },
    regions: {
        ...PT.regions,
        loopOn: 'repetição ativada',
        loopOff: 'repetição desativada',
    },
    description: {
        ...PT.description,
        silenceFor: 'Silêncio durante {duration}',
        thenSoundToEnd: 'depois som até ao fim',
        thenSilenceToEnd: 'depois silêncio até ao fim',
        startsAfter: 'Começa após {duration} de silêncio.',
        rises: 'Fica mais alto no final.',
        falls: 'Fica mais baixo no final.',
    },
    player: {
        ...PT.player,
        player: 'Leitor de áudio',
        back: 'Recuar {seconds} segundos',
        backOne: 'Recuar {seconds} segundo',
        zoomIn: 'Ampliar',
        zoomOut: 'Reduzir',
        zoomReset: 'Mostrar o som completo',
        nextChapter: 'Capítulo seguinte',
    },
};
