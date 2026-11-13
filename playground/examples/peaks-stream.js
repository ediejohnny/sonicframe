import { createPlayer } from 'sonicframe/player';

createPlayer({
    container: document.querySelector('#peaks-stream'),
    src: './sounds/music/november-snow.mp3',
    decode: { stream: true },
});
