import { createPlayer } from 'sonicframe/player';

createPlayer({
    container: document.querySelector('#motion-fade'),
    src: './sounds/little-elf.mp3',
    a11y: {
        description: {
            button: { animation: true, animationType: 'fade' }, // 'pulse' by default
        },
    },
});
