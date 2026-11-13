import { PlayButton, SonicFrame, loadWaveform } from 'sonicframe';

const box = document.querySelector('#plugin-glow');
box.style.display = 'flex';
box.style.alignItems = 'center';
box.style.gap = '0.75rem';
const media = new Audio('./sounds/little-elf.mp3');

PlayButton.create({ container: box, media });
const wave = document.createElement('div');
wave.style.flex = '1';
wave.style.height = '4rem';
box.append(wave);
const frame = new SonicFrame({
    container: wave,
    media,
    peaks: () => loadWaveform('./sounds/little-elf.dat'),
});

const playhead = {
    name: 'playhead-glow',
    layer: 'over', // or 'under', before the bars
    setup(_host) {
        // Called once; keep the host to ask for a redraw later.
    },
    draw(paint) {
        const x = paint.xAt(paint.progress);
        const ctx = paint.ctx;
        ctx.fillStyle = paint.color('var(--sonicframe-progress, #2f6fdb)');
        ctx.fillRect(
            x - 2 * paint.pixelRatio,
            0,
            4 * paint.pixelRatio,
            paint.height,
        );
    },
    destroy() {},
};

frame.use(playhead); // returns the function that removes it
