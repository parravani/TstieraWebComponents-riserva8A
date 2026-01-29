// File: Game2Manager.js
import { photoGameManager } from './PhotoGameManager.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTI PRINCIPALI ---
    const wordyToggleButton = document.getElementById('wordyToggleButton');
    const simboToggleButton = document.getElementById('simboToggleButton'); // Aggiunto per coerenza, se dovesse esserci un simboToggleButton
    const photoToggleButton = document.getElementById('photoToggleButton'); // Nuovo bottone foto
    const typyMaestro = document.getElementById('typy-maestro');
    const lookyMaestro = document.getElementById('looky-maestro');
    const animationContainer = document.getElementById('animation-container');

    const keyboards = document.querySelectorAll('alphabet-keyboard');
    const letterKeyboard = keyboards[0];
    const phoneticKeyboard = keyboards[1];

    // --- STATO ---
    let isWordyModeOn = false;
    let isPhotoModeOn = false; // Nuovo stato per il bottone foto
    let isAnimating = false;
    let animationInterrupted = false;
    let lettersData = [];
    let lastLetterData = null;
    let currentAuxiliaryPromise = null;
    const activeAnimations = new Set();

    // --- COSTANTI ---
    const AGAIN_BUTTON_GAP = 20;
    const CLONE_BUTTON_VERTICAL_OFFSET = 300;
    const CLONE_BUTTON_LEFT_GAP = 12;
    const CLONE_BUTTON_BTN_SIZE = 72;
    const LOOKY_CLONE_BTN_SIZE = 96;

    // --- INIZIALIZZAZIONE ---
    initializeManager();

    let animatedDisplayComponent = null;

    async function ensureAnimatedDisplayComponent() {
        if (!animatedDisplayComponent) {
            await customElements.whenDefined('word-display-flying');
            animatedDisplayComponent = document.querySelector('word-display-flying');
        }
    }

    function initializeManager() {
        const dataPath = window.location.pathname.includes('/games/') ? '../data/' : 'data/';
        fetch(`${dataPath}letters.json`)
            .then(res => res.json())
            .then(data => lettersData = data.layout.flatMap(row => row.keys))
            .catch(err => console.error("Errore caricamento letters.json", err));

        attachEventListeners();
        // Disattiva i maestri all'avvio
        disableMaestro(typyMaestro);
        disableMaestro(lookyMaestro);

        // Inizializza lo stato del photoToggleButton come disabilitato all'avvio
        if (photoToggleButton) photoToggleButton.classList.add('disabled-effect');

        // Controlla se il photoToggleButton è attivo al caricamento della pagina e avvia il gioco
        if (photoToggleButton && !photoToggleButton.classList.contains('disabled-effect')) {
            isPhotoModeOn = true;
            photoGameManager.startGame();
        }
    }

    function attachEventListeners() {
        if (wordyToggleButton) wordyToggleButton.addEventListener('click', toggleWordyMode);
        if (simboToggleButton) simboToggleButton.addEventListener('click', toggleSimboMode); // Aggiunto listener per simboToggleButton, se esiste
        if (photoToggleButton) photoToggleButton.addEventListener('click', togglePhotoMode); // Nuovo listener per il bottone foto
        document.body.addEventListener('keyPress', handleKeyPress);

        if (typyMaestro) typyMaestro.addEventListener('click', handleTypyCloneClick);
        if (lookyMaestro) lookyMaestro.addEventListener('click', handleLookyCloneClick);

        // Listener globale per disabilitare Wordy
        document.addEventListener('disable-game2', () => {
            if (!isWordyModeOn) return;
            isWordyModeOn = false;
            wordyToggleButton.classList.add('disabled-effect');
            hideMaestros();
            wordyToggleButton.style.opacity = '0.5';
            wordyToggleButton.style.filter = 'grayscale(70%)';
        });
    }

    // --- TOGGLE WORDY MODE ---
    async function toggleWordyMode(e) {
        e.stopPropagation();
        if (!letterKeyboard || !phoneticKeyboard || !animationContainer) return;

        isWordyModeOn = !isWordyModeOn;
        wordyToggleButton.classList.toggle('disabled-effect', !isWordyModeOn);

        if (isWordyModeOn) {
            letterKeyboard.classList.add('game2-active');
            phoneticKeyboard.classList.add('game2-active');
            enableMaestro(typyMaestro);
            enableMaestro(lookyMaestro);
            startLetterAttentionSequence();
        } else {
            stopLetterAttentionSequence();
            cleanupFlyingElements();
            letterKeyboard.classList.remove('game2-active');
            phoneticKeyboard.classList.remove('game2-active');
            hideMaestros();
            hideAgainButton();
        }
    }

    // --- TOGGLE PHOTO MODE ---
    async function togglePhotoMode(e) {
        e.stopPropagation();
        isPhotoModeOn = !isPhotoModeOn;
        photoToggleButton.classList.toggle('disabled-effect', !isPhotoModeOn);

        if (isPhotoModeOn) {
            console.log("Modalità foto ATTIVA");
            photoToggleButton.style.opacity = '1';
            photoToggleButton.style.filter = 'none';
            photoGameManager.startGame();
        } else {
            console.log("Modalità foto DISATTIVA");
            photoToggleButton.style.opacity = '0.5';
            photoToggleButton.style.filter = 'grayscale(70%)';
            photoGameManager.stopGame();
        }
    }

    // --- TOGGLE SIMBO MODE --- (Da implementare, se necessario, basandosi su una logica simile)
    async function toggleSimboMode(e) {
        e.stopPropagation();
        // Placeholder per la logica di attivazione/disattivazione della modalità simboli
        console.log("Modalità simboli (simbo) cliccata. Implementare la logica qui.");
        // simboToggleButton.classList.toggle('disabled-effect', !isSimboModeOn);
    }

    // --- FUNZIONI MAESTRO ---
    function enableMaestro(maestro) {
        if (!maestro) return;
        maestro.style.opacity = '1';
        maestro.style.pointerEvents = 'auto';
        maestro.style.zIndex = '1000';
        maestro.style.cursor = 'pointer';
    }

    function disableMaestro(maestro) {
        if (!maestro) return;
        maestro.style.opacity = '0';
        maestro.style.pointerEvents = 'none';
        maestro.style.zIndex = '-1';
    }

    function hideMaestros() {
        disableMaestro(typyMaestro);
        disableMaestro(lookyMaestro);
    }

    // --- LETTER ATTENTION ANIMATION ---
    let attentionTimer = null;
    function startLetterAttentionSequence() {
        if (!letterKeyboard || attentionTimer) return;

        const keys = Array.from(letterKeyboard.shadowRoot.querySelectorAll('letter-key'));
        let index = 0;

        attentionTimer = setInterval(() => {
            keys.forEach(k => {
                const inner = k.shadowRoot?.querySelector('.key-box');
                if (inner) inner.style.boxShadow = '';
            });

            const keyEl = keys[index];
            const inner = keyEl?.shadowRoot?.querySelector('.key-box');
            if (inner) {
                inner.animate([
                    { transform: 'scale(1)', boxShadow: '0 0 0 rgba(0,0,0,0)', opacity: 1 },
                    { transform: 'scale(1.12)', boxShadow: '0 0 12px rgba(255,230,150,0.95)', opacity: 0.15 },
                    { transform: 'scale(1)', boxShadow: '0 0 0 rgba(0,0,0,0)', opacity: 1 }
                ], { duration: 100, iterations: 1 });
            }
            index = (index + 1) % keys.length;
        }, 100);
    }

    function stopLetterAttentionSequence() {
        if (attentionTimer) clearInterval(attentionTimer);
        attentionTimer = null;

        const keys = Array.from(letterKeyboard.shadowRoot.querySelectorAll('letter-key'));
        keys.forEach(k => {
            const inner = k.shadowRoot?.querySelector('.key-box');
            if (inner) inner.style.animation = '';
            if (inner) inner.style.boxShadow = '';
        });
    }

    // --- CLICK HANDLER MAESTRI ---
    async function handleTypyCloneClick() {
        if (isAnimating || !lastLetterData) return;
        isAnimating = true;

        await ensureAnimatedDisplayComponent();
        const placeholders = animatedDisplayComponent.setupPlaceholders([...lastLetterData.word]).letterPlaceholders;
        await animateLetters(lastLetterData, placeholders);

        isAnimating = false;
    }

    async function handleLookyCloneClick() {
        if (isAnimating || !lastLetterData) return;
        isAnimating = true;

        await ensureAnimatedDisplayComponent();
        const { letterPlaceholders, phonemePlaceholders } = animatedDisplayComponent.setupPlaceholders([...lastLetterData.word]);
        await animatePhonemes(lastLetterData, phonemePlaceholders, letterPlaceholders);

        isAnimating = false;
    }

    // --- FUNZIONI UTILI ---
    function cleanupFlyingElements() {
        const flyingEls = animationContainer.querySelectorAll('.flying-element');
        flyingEls.forEach(el => el.remove());
    }

    function hideAgainButton() {
        const btn = document.getElementById('again-button');
        if (btn) btn.remove();
    }

    // --- HANDLER KEY PRESS ---
    async function handleKeyPress(event) {
        if (!isWordyModeOn || isAnimating) return;

        stopLetterAttentionSequence();
        const { char } = event.detail;
        const letterData = lettersData.find(l => l.ch === char);
        if (!letterData) return;

        lastLetterData = letterData;
        isAnimating = true;

        letterKeyboard.style.pointerEvents = 'none';
        phoneticKeyboard.style.pointerEvents = 'none';
        await ensureAnimatedDisplayComponent();
        const { letterPlaceholders, phonemePlaceholders } = animatedDisplayComponent.setupPlaceholders([...letterData.word]);
        await animateLetters(letterData, letterPlaceholders);
        await animatePhonemes(letterData, phonemePlaceholders, letterPlaceholders);

        isAnimating = false;
        letterKeyboard.style.pointerEvents = 'auto';
        phoneticKeyboard.style.pointerEvents = 'auto';

        //showAgainButton();
    }

    // --- FUNZIONI DI ANIMAZIONE BASE ---
    async function animateLetters(letterData, placeholders) {
        for (let i = 0; i < letterData.word.length; i++) {
            const char = letterData.word[i];
            const sourceKey = letterKeyboard.shadowRoot.querySelector(`letter-key[data-main-text="${char.toUpperCase()}"]`);
            const targetPlaceholder = placeholders[i];
            if (!sourceKey || !targetPlaceholder) continue;

            await flyToTarget(sourceKey, targetPlaceholder, 'letter-style', typyMaestro);
            await new Promise(res => setTimeout(res, 100));
        }
    }

    async function animatePhonemes(letterData, placeholders, letterPlaceholders) {
        const phonemes = letterData.wordCharPhonetics;
        if (!phonemes) return;

        for (let i = 0; i < phonemes.length; i++) {
            const phoneme = phonemes[i];
            const sourceKey = phoneticKeyboard.shadowRoot.querySelector(`letter-key[data-main-text="${phoneme}"]`);
            const targetPlaceholder = placeholders[i];
            if (sourceKey && targetPlaceholder) {
                await flyToTarget(sourceKey, targetPlaceholder, 'phoneme-style', lookyMaestro);
            }
        }
    }

    async function flyToTarget(source, target, styleClass, intermediateTarget) {
        const prom = new Promise(resolve => {
            const sourceRect = source.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();
            const intermediateRect = intermediateTarget.getBoundingClientRect();

            const flyingEl = document.createElement('div');
            flyingEl.className = `flying-element ${styleClass}`;
            flyingEl.textContent = source.dataset.mainText;
            flyingEl.style.color = source.dataset.color || '#000';
            flyingEl.style.left = `${sourceRect.left}px`;
            flyingEl.style.top = `${sourceRect.top}px`;
            flyingEl.style.width = '60px';
            flyingEl.style.height = '84px';

            animationContainer.appendChild(flyingEl);
            flyingEl.getBoundingClientRect(); // forza reflow

            // Primo volo LENTO verso la tastiera (maestro)
            // Primo volo LENTO verso la tastiera (maestro) - rotazione COMPLETA qui
            flyingEl.style.transition = 'all 1.5s ease-out';
            flyingEl.style.left = `${intermediateRect.right + 20}px`;
            flyingEl.style.top = `${intermediateRect.top}px`;
            flyingEl.style.transform = 'scale(2.2) rotate(360deg)';

            flyingEl.addEventListener('transitionend', () => {
                // Pausa alla tastiera prima di ripartire
                setTimeout(() => {
                    // Pre-popola il placeholder invisibile con il testo e gli stili corretti
                    target.textContent = source.dataset.mainText;
                    target.className = `placeholder ${styleClass}`;
                    
                    // Preserva colore e textShadow dalla lettera originale
                    const originalColor = source.dataset.color || '#000';
                    const originalTextShadow = source.dataset.textshadow || source.dataset.textShadow || '';
                    target.style.color = originalColor;
                    if (originalTextShadow) {
                        target.style.textShadow = originalTextShadow;
                    }
                    target.style.opacity = '0'; // Invisibile finché il flying non arriva
                    
                    // Ricalcola le coordinate del placeholder per massima precisione
                    const updatedTargetRect = target.getBoundingClientRect();
                    
                    // Secondo volo LENTO dal maestro al placeholder - easing dolce e controllato
                    // Usa transform-origin center per garantire scaling uniforme
                    flyingEl.style.transformOrigin = 'center center';
                    flyingEl.style.transition = 'all 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                    flyingEl.style.left = `${updatedTargetRect.left}px`;
                    flyingEl.style.top = `${updatedTargetRect.top}px`;
                    flyingEl.style.transform = 'scale(1) rotate(0deg)';

                    flyingEl.addEventListener('transitionend', () => {
                        // Atterraggio: il flying svanisce e il placeholder appare con fade-in rallentato
                        // Inizia con opacity 0 e scale 0.95
                        target.style.opacity = '0';
                        target.style.transform = 'scale(0.95)';
                        
                        // Delay minimo per sincronizzare con la rimozione del flying
                        setTimeout(() => {
                            // Fade-in lento con ingrandimento: da 0.95 a 1.05
                            target.style.transition = 'all 400ms ease-out';
                            target.style.opacity = '1';
                            target.style.transform = 'scale(1.05)';
                            
                            // Dopo il fade-in, torna a scale(1)
                            setTimeout(() => {
                                target.style.transition = 'transform 200ms ease-out';
                                target.style.transform = 'scale(1)';
                                flyingEl.remove();
                                resolve();
                            }, 400);
                        }, 50);
                    }, { once: true });
                }, 300); // Pausa 300ms alla tastiera
            }, { once: true });
        });

        activeAnimations.add(prom);
        prom.finally(() => activeAnimations.delete(prom));
        return prom;
    }

});