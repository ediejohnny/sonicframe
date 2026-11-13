import { createPlayer } from 'sonicframe/player';

createPlayer({
    container: document.querySelector('#player-stream'),
    src: './sounds/music/november-snow.mp3',
    decode: { stream: { maxSeconds: 14_400, progressive: true } },
});
