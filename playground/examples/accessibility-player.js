import { createPlayer } from 'sonicframe/player';

createPlayer({
    container: document.querySelector('#accessibility-player'),
    src: './sounds/little-elf.mp3',
    a11y: {
        lang: 'pt-BR', // the language of every word the player says
        label: 'Nota de voz da Ana', // the player's accessible name
        words: { play: 'Ouvir' }, // your own names, over the language's
        description: { keys: true, button: true }, // the wave in words
    },
});
