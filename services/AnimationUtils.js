// /Applications/XAMPP/xamppfiles/htdocs/TastieraWebComponents riserva8A/services/AnimationUtils.js

export class AnimationUtils {
    
    /**
     * Crea un effetto fuochi d'artificio in una posizione specifica.
     * @param {number} x - Coordinata X.
     * @param {number} y - Coordinata Y.
     * @param {HTMLElement} container - Il contenitore dove appendere le particelle (default: body).
     */
    static createFirework(x, y, container = document.body) {
        const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff', '#ffffff', '#ffaa00', '#00ffaa'];
        const particleCount = 120; 

        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.style.position = 'fixed';
            particle.style.left = `${x}px`;
            particle.style.top = `${y}px`;
            const size = 4 + Math.random() * 6;
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            particle.style.borderRadius = '50%';
            particle.style.pointerEvents = 'none';
            particle.style.zIndex = '10002';
            particle.style.boxShadow = `0 0 ${size * 2}px ${particle.style.backgroundColor}`;
            
            const angle = Math.random() * Math.PI * 2;
            const velocity = 100 + Math.random() * 400;
            const tx = Math.cos(angle) * velocity;
            const ty = Math.sin(angle) * velocity;

            container.appendChild(particle);

            const anim = particle.animate([
                { transform: 'translate(0, 0) scale(1)', opacity: 1 },
                { transform: `translate(${tx}px, ${ty}px) scale(0)`, opacity: 0 }
            ], {
                duration: 2000 + Math.random() * 1000,
                easing: 'cubic-bezier(0.1, 1, 0.5, 1)',
                fill: 'forwards'
            });

            anim.onfinish = () => particle.remove();
        }
    }

    /**
     * Anima un elemento dal punto A al punto B.
     * @param {HTMLElement} element - L'elemento da animare.
     * @param {DOMRect} startRect - Rettangolo di partenza.
     * @param {DOMRect} targetRect - Rettangolo di arrivo.
     * @param {number} durationSeconds - Durata in secondi.
     * @param {HTMLElement} container - Contenitore per l'animazione.
     * @param {object} finalStyles - Stili opzionali da applicare all'arrivo (es. fontSize).
     * @returns {Promise} Risolve alla fine dell'animazione.
     */
    static flyElement(element, startRect, targetRect, durationSeconds, container, finalStyles = {}) {
        return new Promise(resolve => {
            element.style.position = 'fixed';
            element.style.margin = '0';
            element.style.left = `${startRect.left}px`;
            element.style.top = `${startRect.top}px`;
            element.style.width = `${startRect.width}px`;
            element.style.height = `${startRect.height}px`;
            element.style.pointerEvents = 'none';
            element.style.zIndex = '100000';
            element.style.transition = `all ${durationSeconds}s cubic-bezier(0.4, 0, 0.2, 1)`;
            
            container.appendChild(element);

            // Force reflow
            void element.offsetWidth;

            requestAnimationFrame(() => {
                element.style.left = `${targetRect.left}px`;
                element.style.top = `${targetRect.top}px`;
                element.style.width = `${targetRect.width}px`;
                element.style.height = `${targetRect.height}px`;
                element.style.transform = 'rotate(360deg) scale(1)';
                
                // Applica stili finali opzionali (es. font-size del target)
                if (finalStyles.fontSize) {
                    element.style.fontSize = finalStyles.fontSize;
                }
            });

            element.addEventListener('transitionend', () => {
                resolve();
            }, { once: true });
        });
    }

    /**
     * Sincronizza l'apparizione di una lista di elementi con la riproduzione audio (Effetto Karaoke).
     * @param {HTMLAudioElement} audioEl - L'elemento audio.
     * @param {NodeList|Array} elements - Gli elementi da rivelare progressivamente.
     * @param {Function} onEnd - Callback al termine.
     */
    static syncAnimationToAudio(audioEl, elements, onEnd) {
        let revealed = 0;
        const revealUpTo = (count) => {
            for (let i = revealed; i < Math.min(count, elements.length); i++) {
                const el = elements[i];
                el.style.opacity = '1';
                el.style.transform = 'scale(1)';
            }
            revealed = Math.max(revealed, count);
        };

        const applyProgress = () => {
            if (!audioEl || !isFinite(audioEl.duration) || audioEl.duration <= 0) return;
            const progress = Math.min(Math.max(audioEl.currentTime / audioEl.duration, 0), 1);
            const count = Math.ceil(progress * elements.length);
            revealUpTo(count);
        };

        const onTimeUpdate = () => applyProgress();
        audioEl.addEventListener('timeupdate', onTimeUpdate);
        
        const waitForStart = () => {
            if (audioEl.currentTime > 0.05) {
                applyProgress();
            } else if (!audioEl.ended && !audioEl.paused) {
                requestAnimationFrame(waitForStart);
            }
        };
        requestAnimationFrame(waitForStart);

        audioEl.addEventListener('ended', () => {
            revealUpTo(elements.length);
            audioEl.removeEventListener('timeupdate', onTimeUpdate);
            if (onEnd) onEnd();
        }, { once: true });
    }
}