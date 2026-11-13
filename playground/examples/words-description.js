import { createPlayer } from 'sonicframe/player';

createPlayer({
    container: document.querySelector('#words-description'),
    src: './sounds/little-elf.mp3',
    a11y: {
        lang: 'pt',
        description: {
            keys: true,
            pauseInValue: true,
            button: { animation: true, animationType: 'pulse' },
        },
    },
});
