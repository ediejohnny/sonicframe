import { createPlayer } from 'sonicframe/player';

createPlayer({
    container: document.querySelector('#zoom-buttons'),
    src: './sounds/little-elf.mp3',
    zoom: { wheel: true, keys: true, pinch: true, buttons: true },
    minimap: true,
    a11y: { zoom: { announce: true }, minimap: { keys: true } },
});
