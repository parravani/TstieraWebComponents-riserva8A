// components/photo-game/photo-game-component.js

import { photoGameManager } from '../../manager/game/PhotoGameManager.js';

class PhotoGameComponent extends HTMLElement {
    constructor() {
        super();
        this.allPhonemes = []; // Conterrà tutti i fonemi caricati da JSON
        this.phonemeStyles = new Map(); // Conterrà gli stili (es. colori) per ogni fonema
        this.phonemeSounds = new Map(); // Conterrà i suoni per ogni fonema
        this.correctIpaSequence = []; // La sequenza corretta di simboli IPA per la parola corrente
        this.correctIpaSet = new Set(); // Un Set per cercare rapidamente se un simbolo è corretto (anche se fuori posto)
        this.nextIpaIndex = 0; // Indice del prossimo simbolo corretto da inserire
        this.symbolErrors = 0; // Contatore per gli errori di simboli
        this.letterErrors = 0; // Contatore per gli errori di lettere (predisposto)

        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    font-family: sans-serif;
                }
                /* Animazione rainbow per il testo */
                .rainbow-text {
                    animation: rainbow-text-animation 2s linear infinite;
                }
                @keyframes rainbow-text-animation {
                    0% { color: #ff0000; }
                    15% { color: #ff7f00; }
                    30% { color: #ffff00; }
                    45% { color: #00ff00; }
                    60% { color: #0000ff; }
                    75% { color: #4b0082; }
                    90% { color: #8f00ff; }
                    100% { color: #ff0000; }
                }

                #photo-game-block {
                    position: relative;
                    bottom: 4vh;
                    border-radius: 10px;
                    padding: 16px;
                    max-width: 800px;
                    margin: 0 auto;
                    background-color: transparent;
                }
                #game-area {
                    position: relative; /* Necessario per posizionare i cloni animati */
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }
                .flying-symbol, .flying-letter {
                    position: absolute;
                    z-index: 1000;
                    pointer-events: none; /* Evita che il clone intercetti i click */
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    border-radius: 8px;
                    font-weight: bold;
                    font-size: 2em;
                    background-color: #fff;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                }
                h2 {
                    text-align: center;
                    color: #333;
                }
                #main-interactive-area {
                    display: flex;
                    /* MODIFICA: Imposta la direzione a colonna per impilare immagine e bottone */
                    flex-direction: column;
                    justify-content: center;
                    align-items: center; /* Centra gli elementi orizzontalmente */
                    gap: 20px;
                }
                #prev-button-placeholder, #next-button-container {
                    /* Rimuoviamo la larghezza fissa per permettere un centraggio naturale */
                    min-width: 130px;
                    display: flex;
                    justify-content: center;
                }
                 #image-container {
                    flex-shrink: 0;
                    width: 150px;
                    height: 150px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    border: 1px solid #ddd;
                }
                #random-image {
                    max-width: 100%;
                    max-height: 100%;
                    cursor: pointer;
                }
                #next-button {
                    background: linear-gradient(to right, #f32170, #ff6b08, #cf23cf, #eedd44);
                    color: white;
                    border: none;
                    padding: 12px 14px;
                    font-size: 1.1em;
                    font-weight: bold;
                    border-radius: 8px;
                    text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                #next-button:hover {
                    transform: scale(1.05);
                }
                .reconstruction-area {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 5px;
                    justify-content: center;
                    padding: 10px;
                    border: none;
                    min-height: 40px;
                }
                .letter-box, .ipa-box {
                    width: 65px;
                    height: 60px;
                    border: 1px dashed lightgreen;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    font-size: 2.5em;
                    font-weight: bold;
                    background-color: transparent;
                }
                .ipa-box {
                    font-size: 47px; /* Allineato alla dimensione del simbolo di opzione */
                }
                .ipa-option-symbol {
                    width: 50px;
                    height: 50px;
                    border: 1px solid transparent;
                    border-radius: 5px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    font-size: 30px;
                    cursor: pointer;
                    background-color: transparent;
                    transition: transform 0.2s, opacity 0.3s;
                }
                .ipa-option-symbol:hover {
                    transform: scale(1.1);
                }
                .ipa-option-symbol.hidden {
                    opacity: 0;
                    pointer-events: none;
                    transform: scale(0.5);
                }
                #error-counters {
                    display: flex;
                    justify-content: space-around;
                    margin-top: 50px;
                    font-size: 1.5em;
                    font-weight: bold;
                    z-index 100;
                }
                .shake {
                    animation: shake 0.5s;
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    75% { transform: translateX(5px); }
                }
            </style>

            <div id="photo-game-block">
                <h2>Photo Game</h2>
                <div id="game-area">
                    <div id="main-interactive-area">
                        <!-- Placeholder rimosso per un centraggio più pulito -->
                        <div id="image-container">
                            <img id="random-image" src="" alt="Random Image">
                        </div>
                        <div id="next-button-container"></div>
                    </div>
                    <div id="reconstruction-areas">
                        <div id="word-reconstruction-area" class="reconstruction-area"></div>
                        <div id="ipa-answer-area" class="reconstruction-area"></div>
                        <div id="ipa-options-area" class="reconstruction-area"></div>
                        <div id="error-counters">
                             <span id="letter-errors">Letter errors: 0</span>
                             <span id="symbol-errors">Symbol errors: 0</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async connectedCallback() {
        console.log('photo-game-component: connectedCallback called.');
        this.wordArea = this.shadowRoot.querySelector('#word-reconstruction-area');
        this.ipaAnswerArea = this.shadowRoot.querySelector('#ipa-answer-area');
        this.ipaOptionsArea = this.shadowRoot.querySelector('#ipa-options-area');
        this.letterErrorsSpan = this.shadowRoot.querySelector('#letter-errors');
        this.symbolErrorsSpan = this.shadowRoot.querySelector('#symbol-errors');
        this.randomImageElement = this.shadowRoot.querySelector('#random-image');
        this.nextButtonContainer = this.shadowRoot.querySelector('#next-button-container');

        // Logica del pulsante di avvio spostata qui
        const reconstructionAreas = this.shadowRoot.querySelector('#reconstruction-areas');
        
        // Nascondi le aree di gioco all'inizio
        reconstructionAreas.style.display = 'none';

        await this.loadPhonemes();

        this.setImage('');
        // Ensure reconstructionAreas are visible on connect, in case they were hidden by deactivate
        reconstructionAreas.style.display = 'none';

        this.randomImageElement.addEventListener('click', () => {
            photoGameManager.playCurrentImageSound();
        });

        // Usiamo la delegazione di eventi per gestire i click sui simboli IPA
        this.ipaOptionsArea.addEventListener('click', (event) => {
            const clickedEl = event.target;
            if (clickedEl.classList.contains('ipa-option-symbol')) {
                this.handleSymbolClick(clickedEl);
            }
        });
    }

    disconnectedCallback() {
        console.log('photo-game-component: disconnectedCallback called.');
        this.deactivate();
    }

    deactivate() {
        console.log('photo-game-component: deactivate called.');
        this.clearBoard();
        this.setImage('');
        // Nasconde l'intera area di gioco tranne l'immagine
        const reconstructionAreas = this.shadowRoot.querySelector('#reconstruction-areas');
        if (reconstructionAreas) {
            reconstructionAreas.style.display = 'none';
        }
    }

    async loadPhonemes() {
        try {
            // Costruisce il percorso dati in modo dinamico per gestire le sottocartelle
            const dataPath = window.location.pathname.includes('/games/') ? '../data/' : 'data/';
            const response = await fetch(`${dataPath}phonemes-new.json`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const phonemesData = await response.json();
            // Estrae tutti i simboli (ch) e i loro stili
            this.allPhonemes = [];
            phonemesData.layout.forEach(row => {
                row.keys.forEach(key => {
                    this.allPhonemes.push(key.ch);
                    if (key.style) {
                        this.phonemeStyles.set(key.ch, key.style);
                    }
                    if (key.sound) {
                        this.phonemeSounds.set(key.ch, key.sound);
                    }
                });
            });
            
            // Ordina i fonemi per lunghezza decrescente per un parsing greedy corretto
            this.allPhonemes.sort((a, b) => b.length - a.length);

        } catch (error) {
            console.error("Could not load phonemes:", error);
        }
    }

    parsePhoneticString(phoneticString) {
        const symbols = [];
        let remainingString = phoneticString;
        while (remainingString.length > 0) {
            // Trova il fonema più lungo che corrisponde all'inizio della stringa
            const matchedPhoneme = this.allPhonemes.find(p => remainingString.startsWith(p));
            if (matchedPhoneme) {
                symbols.push(matchedPhoneme);
                remainingString = remainingString.substring(matchedPhoneme.length);
            } else {
                // Fallback: se nessun fonema corrisponde, considera un singolo carattere e continua.
                // Questo non dovrebbe accadere se i dati fonetici sono corretti.
                console.warn(`Simbolo fonetico sconosciuto o non gestito: ${remainingString[0]}`);
                symbols.push(remainingString[0]);
                remainingString = remainingString.substring(1);
            }
        }
        return symbols;
    }
    
    // Funzione chiamata dal manager per iniziare un nuovo turno
    startGame(wordData) {
        console.log('photo-game-component: startGame called with wordData:', wordData);
        // Assicurati che l'interfaccia sia visibile prima di iniziare
        const reconstructionAreas = this.shadowRoot.querySelector('#reconstruction-areas');
        if (reconstructionAreas) {
            reconstructionAreas.style.display = ''; // Ripristina la visibilità
        }

        this.clearBoard();
        
        const word = wordData.text;
        // Esegue il parsing della stringa fonetica per gestire correttamente i simboli multi-carattere
        const ipaSymbols = this.parsePhoneticString(wordData.fullPhonetic.trim());

        this.correctIpaSequence = ipaSymbols;
        this.correctIpaSet = new Set(ipaSymbols);
        
        this.createEmptyBoxes(word, this.correctIpaSequence);
        this.setupIpaOptions();
    }

    createEmptyBoxes(word, ipaArray) {
        if (word) {
            Array.from(word).forEach(() => {
                const box = document.createElement('div');
                box.className = 'letter-box';
                this.wordArea.appendChild(box);
            });
        }
        if (ipaArray) {
            ipaArray.forEach(() => {
                const box = document.createElement('div');
                box.className = 'ipa-box';
                this.ipaAnswerArea.appendChild(box);
            });
        }
    }
    
    setupIpaOptions() {
        if (!this.correctIpaSequence || this.allPhonemes.length === 0) return;

        const correctSymbols = this.correctIpaSequence;
        
        // Filtra per ottenere solo i distrattori (simboli non presenti nella risposta corretta)
        // Escludi esplicitamente il simbolo "double"
        const distractorsPool = this.allPhonemes.filter(symbol => !this.correctIpaSet.has(symbol) && symbol !== 'double');

        // Mescola i distrattori e prendine un numero definito (5 come richiesto)
        const numberOfDistractors = Math.min(5, distractorsPool.length);
        const randomDistractors = [...distractorsPool].sort(() => 0.5 - Math.random()).slice(0, numberOfDistractors);
        
        // Unisci i simboli corretti con i distrattori e mescola l'array finale
        const options = [...correctSymbols, ...randomDistractors].sort(() => 0.5 - Math.random());

        options.forEach(symbol => {
            const symbolEl = document.createElement('div');
            symbolEl.className = 'ipa-option-symbol';
            symbolEl.textContent = symbol;
            symbolEl.dataset.symbol = symbol; // Salva il simbolo nel dataset per un facile accesso
            
            // Applica il colore del simbolo e del bordo se esistono
            const style = this.phonemeStyles.get(symbol);
            if (style) {
                if (style.color) {
                    symbolEl.style.color = style.color;
                }
                if (style.borderColor) {
                    symbolEl.style.borderColor = style.borderColor;
                }
            }

            this.ipaOptionsArea.appendChild(symbolEl);
        });
    }

    async handleSymbolClick(clickedEl) {
        const clickedSymbol = clickedEl.dataset.symbol;
        const targetBox = this.ipaAnswerArea.children[this.nextIpaIndex];
        let soundPath = this.phonemeSounds.get(clickedSymbol);

        const dataPath = window.location.pathname.includes('/games/') ? '../' : '';
        let fullSoundPath = soundPath ? `${dataPath}${soundPath}` : null;

        if (fullSoundPath) {
            window.soundDispatcher.playSound(fullSoundPath);
        }

        if (clickedSymbol === this.correctIpaSequence[this.nextIpaIndex]) {
            // Risposta corretta
            clickedEl.style.visibility = 'hidden';

            const flyingClone = clickedEl.cloneNode(true);
            flyingClone.style.visibility = 'visible';
            flyingClone.classList.add('flying-symbol');

            const gameArea = this.shadowRoot.querySelector('#game-area');
            const startRect = clickedEl.getBoundingClientRect();
            const targetRect = targetBox.getBoundingClientRect();

            // Posizione iniziale relativa all'area di gioco
            const startX = startRect.left - gameArea.getBoundingClientRect().left;
            const startY = startRect.top - gameArea.getBoundingClientRect().top;

            // Calcola la posizione finale centrata
            const endX = targetRect.left - gameArea.getBoundingClientRect().left + (targetRect.width - startRect.width) / 2;
            const endY = targetRect.top - gameArea.getBoundingClientRect().top + (targetRect.height - startRect.height) / 2;

            flyingClone.style.left = `${startX}px`;
            flyingClone.style.top = `${startY}px`;
            flyingClone.style.width = `${startRect.width}px`;
            flyingClone.style.height = `${startRect.height}px`;

            const originalStyle = this.phonemeStyles.get(clickedSymbol);
            if (originalStyle && originalStyle.color) {
                flyingClone.style.color = originalStyle.color;
            }
            
            gameArea.appendChild(flyingClone);
            
            let duration = 0.6; // Durata di default
            try {
                if (fullSoundPath) duration = await this.getAudioDuration(fullSoundPath);
                if (isNaN(duration) || duration === 0) duration = 0.6;
            } catch {
                duration = 0.6;
            }

            const animation = flyingClone.animate([
                { transform: 'translate(0, 0) rotate(0deg) scale(1)', offset: 0 },
                { transform: `translate(${endX - startX}px, ${endY - startY}px) rotate(360deg) scale(0.8)`, offset: 1 }
            ], {
                duration: duration * 1000, // converte in ms
                easing: 'ease-in-out',
                fill: 'forwards'
            });

            animation.onfinish = () => {
                targetBox.textContent = clickedSymbol;
                if (originalStyle && originalStyle.color) {
                    targetBox.style.color = originalStyle.color;
                }
                flyingClone.remove();
                clickedEl.classList.add('hidden');
                clickedEl.style.visibility = '';

                this.nextIpaIndex++;
                this.checkForWin();
            };

        } else {
            // Risposta sbagliata
            this.symbolErrors++;
            this.updateErrorCounters();
            
            targetBox.classList.add('shake');
            setTimeout(() => targetBox.classList.remove('shake'), 500);

            if (!this.correctIpaSet.has(clickedSymbol)) {
                clickedEl.classList.add('hidden');
            }
        }
    }
    
    /**
     * Fa vibrare un elemento (usato per risposte sbagliate).
     * @param {HTMLElement} element - L'elemento da far vibrare.
     */
    shakeElement(element) {
        element.classList.add('shake');
        setTimeout(() => element.classList.remove('shake'), 500);
    }

    /**
     * Anima una lettera dalla sua sorgente alla scatola di destinazione.
     * @param {HTMLElement} sourceKey - L'elemento letter-key di origine.
     * @param {number} letterIndex - L'indice della scatola di destinazione.
     */
    flyLetterToBox(sourceKey, letterIndex, durationInSeconds) {
        const targetBox = this.wordArea.children[letterIndex];
        if (!targetBox) return;

        const char = sourceKey.dataset.mainText;
        const color = sourceKey.dataset.color;
        const textShadow = sourceKey.dataset.textshadow;

        const flyingClone = document.createElement('div');
        flyingClone.className = 'flying-letter';
        flyingClone.textContent = char;
        if (color) flyingClone.style.color = color;
        if (textShadow) flyingClone.style.textShadow = textShadow;

        const gameArea = this.shadowRoot.querySelector('#game-area');
        const startRect = sourceKey.getBoundingClientRect();
        const targetRect = targetBox.getBoundingClientRect();

        const startX = startRect.left - gameArea.getBoundingClientRect().left;
        const startY = startRect.top - gameArea.getBoundingClientRect().top;

        const endX = targetRect.left - gameArea.getBoundingClientRect().left + (targetRect.width - startRect.width) / 2;
        const endY = targetRect.top - gameArea.getBoundingClientRect().top + (targetRect.height - startRect.height) / 2;
        
        flyingClone.style.left = `${startX}px`;
        flyingClone.style.top = `${startY}px`;
        flyingClone.style.width = `${startRect.width}px`;
        flyingClone.style.height = `${startRect.height}px`;

        gameArea.appendChild(flyingClone);
        
        const animation = flyingClone.animate([
            { transform: 'translate(0, 0) rotate(0deg) scale(1)' },
            { transform: `translate(${endX - startX}px, ${endY - startY}px) rotate(360deg) scale(1)` }
        ], {
            duration: (durationInSeconds || 0.8) * 1000,
            easing: 'ease-in-out',
            fill: 'forwards'
        });

        animation.onfinish = () => {
            targetBox.textContent = char;
            if (color) targetBox.style.color = color;
            if (textShadow) targetBox.style.textShadow = textShadow;
            flyingClone.remove();
        };
    }

    updateErrorCounters() {
        this.letterErrorsSpan.textContent = `Letter errors: ${this.letterErrors}`;
        this.symbolErrorsSpan.textContent = `Symbol errors: ${this.symbolErrors}`;
    }

    checkForWin() {
        // Se l'indice del prossimo simbolo è uguale alla lunghezza della sequenza, l'utente ha finito
        if (this.nextIpaIndex === this.correctIpaSequence.length) {
            console.log("You win!");
            // Aggiungi un feedback visivo per la vittoria
            this.ipaAnswerArea.style.borderColor = 'lime';
            this.showNextButton(); // Mostra il pulsante per procedere
        }
    }

    clearBoard() {
        this.wordArea.innerHTML = '';
        this.ipaAnswerArea.innerHTML = '';
        this.ipaAnswerArea.style.borderColor = ''; // Resetta il bordo di vittoria
        this.ipaOptionsArea.innerHTML = '';
        
        this.correctIpaSequence = [];
        this.correctIpaSet.clear();
        this.nextIpaIndex = 0;
        this.symbolErrors = 0;
        this.letterErrors = 0;
        this.updateErrorCounters();
        this.hideNextButton();
    }
    
    setImage(imageUrl) {
        if (this.randomImageElement) {
            this.randomImageElement.src = imageUrl;
            this.randomImageElement.style.display = imageUrl ? 'block' : 'none';
        }
    }

    showNextButton() {
        if (!this.nextButtonContainer) return;
        // Controlla se il pulsante esiste già per evitare duplicati
        if (this.nextButtonContainer.querySelector('#next-button')) {
            return;
        }
        const nextButton = document.createElement('button');
        nextButton.id = 'next-button';
        nextButton.textContent = 'Next';
        nextButton.addEventListener('click', () => {
            photoGameManager.showNextImage();
        });
        this.nextButtonContainer.appendChild(nextButton);
    }

    hideNextButton() {
        if (this.nextButtonContainer) {
            this.nextButtonContainer.innerHTML = '';
        }
    }

    getAudioDuration(audioUrl) {
        return new Promise((resolve, reject) => {
            const audio = new Audio();
            audio.addEventListener('loadedmetadata', () => {
                console.log(`getAudioDuration - ${audioUrl} loaded. Duration: ${audio.duration}`);
                resolve(audio.duration);
            }, { once: true });
            audio.addEventListener('error', (e) => {
                console.error(`Error loading audio ${audioUrl}:`, e);
                reject(new Error(`Failed to load audio: ${audioUrl}`));
            }, { once: true });
            audio.src = audioUrl;
        });
    }
}

customElements.define('photo-game-component', PhotoGameComponent);