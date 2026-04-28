async (events, configuration, elementCreator, scriptRegistry) => {

    await scriptRegistry.isLoaded();

    const ANIMATION_SPEED_MIN = 0;
    const ANIMATION_SPEED_DEFAULT = 5;
    const ANIMATION_SPEED_MAX = 50;

    const ENABLED_PAGES = ['taming'];

    let enabled = false;
    let random_start_enabled = false;
    let animation_speed = ANIMATION_SPEED_DEFAULT;

    async function initialise() {
        configuration.registerCheckbox({
            category: 'Pet Animation Speed',
            key: 'animated-loot-enabled',
            name: 'Pet Animation Speed Modifier Enabled',
            default: false,
            handler: handleConfigEnabledStateChange,
        });

        configuration.registerCheckbox({
            category: 'Pet Animation Speed',
            key: 'pet-animation-random-start-enabled',
            name: 'Desynchronize the animations',
            default: false,
            handler: handleConfigRandomStartChange,
        });

        configuration.registerInput({
            category: 'Pet Animation Speed',
            key: 'pet-animation-speed',
            name: `[${ANIMATION_SPEED_MIN} - ${ANIMATION_SPEED_MAX}]`,
            default: ANIMATION_SPEED_DEFAULT,
            inputType: 'number',
            text: 'Speed of the pet animations [Default: 5]',
            light: true,
            noHeader: true,
            handler: handleConfigAnimationSpeedChange,
        });

        elementCreator.addStyles(styles);
        events.register('page', handlePage);
    }

    function handleConfigEnabledStateChange(state) {
        enabled = state;
    }

    function handleConfigRandomStartChange(state) {
        random_start_enabled = state;
    }

    function handleConfigAnimationSpeedChange(state) {
        if (!state || state === '') {
            animation_speed = ANIMATION_SPEED_DEFAULT;
            return;
        }
        if (state < ANIMATION_SPEED_MIN) {
            animation_speed = ANIMATION_SPEED_MIN;
            return;
        }
        if (state > ANIMATION_SPEED_MAX) {
            animation_speed = ANIMATION_SPEED_MAX;
            return;
        }
        animation_speed = state;
    }

    async function handlePage(page) {
        if (!enabled) return;
        if (!ENABLED_PAGES.includes(page.type)) return;

        if (typeof ImageDecoder === 'undefined') {
            return;
        }

        const speed = Number(animation_speed) || ANIMATION_SPEED_DEFAULT;
        const speedMultiplier = Math.max(0.1, speed / ANIMATION_SPEED_DEFAULT);

        const gifs = [...document.querySelectorAll('img')]
            .filter(img => img.src && img.src.includes('.gif') && !img.dataset.petAnimationSpeedDone);

        for (const img of gifs) {
            img.dataset.petAnimationSpeedDone = '1';

            try {

                const res = await fetch(img.src);

                if (!res.ok) {
                    continue;
                }

                const buffer = await res.arrayBuffer();

                const decoder = new ImageDecoder({
                    data: buffer,
                    type: 'image/gif',
                });

                await decoder.tracks.ready;

                const frameCount = decoder.tracks.selectedTrack.frameCount;
                const frames = [];

                for (let i = 0; i < frameCount; i++) {
                    const result = await decoder.decode({ frameIndex: i });
                    const frame = result.image;

                    const bitmap = await createImageBitmap(frame);
                    const delay = Math.max(10, ((frame.duration || 100000) / 1000) / speedMultiplier);

                    frames.push({ bitmap, delay });
                    frame.close();
                }

                if (!frames.length) {
                    continue;
                }

                const wrapper = document.createElement('span');
                const imgStyle = getComputedStyle(img);

                wrapper.style.position = 'relative';
                wrapper.style.display = imgStyle.display === 'block' ? 'block' : 'inline-block';
                wrapper.style.width = img.clientWidth + 'px';
                wrapper.style.height = img.clientHeight + 'px';
                wrapper.style.verticalAlign = imgStyle.verticalAlign || 'middle';

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                canvas.width = frames[0].bitmap.width;
                canvas.height = frames[0].bitmap.height;

                ctx.imageSmoothingEnabled = false;

                canvas.style.position = 'absolute';
                canvas.style.left = '0';
                canvas.style.top = '0';
                canvas.style.width = '100%';
                canvas.style.height = '100%';
                canvas.style.pointerEvents = 'none';
                canvas.style.imageRendering = 'pixelated';

                img.parentNode.insertBefore(wrapper, img);
                wrapper.appendChild(img);
                wrapper.appendChild(canvas);

                img.style.opacity = '0';

                let index = random_start_enabled
                    ? Math.floor(Math.random() * frames.length)
                    : 0;

                function draw() {
                    const frame = frames[index];

                    ctx.imageSmoothingEnabled = false;
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(frame.bitmap, 0, 0);

                    index = (index + 1) % frames.length;

                    setTimeout(draw, frame.delay);
                }

                const randomDelay = random_start_enabled
                    ? Math.floor(Math.random() * 1000)
                    : 0;

                setTimeout(draw, randomDelay);

            } catch (e) {
            }
        }
    }

    const styles = `
        
    `;

    initialise();
}