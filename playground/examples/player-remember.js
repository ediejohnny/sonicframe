import { createPlayer } from 'sonicframe/player';

const box = document.querySelector('#player-remember');
const note = document.createElement('p');
note.textContent =
    'Play a little, then reload the page: the player resumes where you stopped.';
const forget = document.createElement('button');
forget.type = 'button';
forget.textContent = 'Forget the position';

const player = createPlayer({
    container: box,
    src: './sounds/little-elf.mp3',
    remember: { key: 'docs-example', sound: 'little-elf' },
});
box.append(note, forget);

player.on('resume', (time) => {
    note.textContent = `Resumed at ${time.toFixed(1)} seconds.`;
});
forget.addEventListener('click', () => {
    player.forget(); // clears what it kept
    note.textContent = 'Forgotten: the next visit starts from the beginning.';
});
