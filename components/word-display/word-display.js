// File: components/word-display/word-display.js

class WordDisplay extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        this.phoneticAudioMap = {}; // Mappa dei suoni interna al componente
        this.lettersData = {};
        this.colormap = {};
    }

    async connectedCallback() {
        const template = await this.fetchTemplate();
        this.shadowRoot.appendChild(template.content.cloneNode(true));

        // Riferimenti agli elementi interni
        this.wordContainer = this.shadowRoot.getElementById('word-container');
        //this.transcriptionContainer = this.shadowRoot.getElementById('transcription-container');

        // Carica i dati necessari una sola volta
        await this.buildPhoneticSoundMap();
        await this.AllLettersMap();
    }

    async fetchTemplate() {
        const templateUrl = new URL('word-display.html', import.meta.url);
        const response = await fetch(templateUrl);
        const text = await response.text();
        const html = new DOMParser().parseFromString(text, 'text/html');
        return html.querySelector('#word-display-template');
    }


    async AllLettersMap() {
        try {
            const dataPath = window.location.pathname.includes('/games/') ? '../data/' : 'data/';
            // Carica i dati delle lettere
            const lettersResponse = await fetch(`${dataPath}letters.json`);
            const letterJson = await lettersResponse.json();
            // Appiattiamo l'array per una ricerca più facile
            this.lettersData = letterJson.layout.flatMap(row => row.keys);
        } catch (error) {
            console.error("WordDisplay: Errore nel caricare i dati delle lettere.", error);
        }




    }

    generateColorMap(data) {
        const colorMap = {};
        data.layout.forEach(row => {
            row.keys.forEach(key => {
                if (key.style && key.style.color) {
                    colorMap[key.ch] = key.style.color;
                }
            });
        });
        return colorMap;
    }

    // Metodo per caricare e creare la mappa dei suoni
    async buildPhoneticSoundMap() {
        try {
            const dataPath = window.location.pathname.includes('/games/') ? '../data/' : 'data/';
            const response = await fetch(`${dataPath}phonemes-new.json`);
            const data = await response.json();

            const allPhoneticKeys = data.layout.flatMap(row => row.keys);
            this.colormap = this.generateColorMap(data);
            // Codice reso più robusto: se una chiave non esiste, usa un array vuoto.
            //const allPhoneticKeys = [
            //    ...(data.phoneticKeys || []),
            //    ...(data.phoneticKeys2 || []),
            //    ...(data.phoneticKeys3 || []),
            //    ...(data.phoneticKeys4 || [])
            //];

            allPhoneticKeys.forEach(key => {
                const cleanSymbol = key.cleanSymbol || (key.symbol ? key.symbol.replace(/<[^>]*>?/gm, '') : '');
                if (cleanSymbol && key.sound) {
                    this.phoneticAudioMap[cleanSymbol] = key.sound;
                }
            });
            this.phoneticAudioMap['ɑː'] = 'suoni/alunga.wav';
            this.phoneticAudioMap['ɡ'] = 'suoni/g.wav';
        } catch (error) {
            console.error("WordDisplay: Errore nel caricare i dati dei fonemi.", error);
        }
    }

    /**
     * Anima un tasto sulla tastiera principale.
     * @param {string} char - Il carattere del tasto da animare.
     */
    animateKey(char) {
        const keyboards = document.querySelectorAll('alphabet-keyboard');
        for (const keyboard of keyboards) {
            const keyElement = keyboard.getKeyElement(char);
            if (keyElement) {
                keyElement.classList.add('key-pulse');
                setTimeout(() => keyElement.classList.remove('key-pulse'), 300); // Rimuove la classe dopo l'animazione
            }
        }
    }

    // Metodo pubblico per mostrare e popolare il componente
    show(data) {
        if (!data || !data.word || !data.wordPhonetic) return;

        this.wordContainer.innerHTML = '';
        data.word.split('').forEach((char, index) => {
            const div = document.createElement('div');
            div.className = "letterAndTranscript";
            const btn = document.createElement('button');
            btn.className = `word-char-btn`;
            btn.textContent = char;

            const letterData = this.lettersData.find(letter => letter.ch === char);
            btn.style.color = letterData.style.color;


            // Logica per suono e tooltip del singolo carattere
            btn.dataset.charPhonetic = data.wordCharPhonetics[index] || '';
            btn.addEventListener('mousedown', (e) => { this.letterClick(e); });



            div.appendChild(btn);

            const btn2 = document.createElement('button');
            btn2.className = "trans-char-btn";

            let fonema = data.wordCharPhonetics[index];
            btn2.textContent = fonema || '';
            const color = this.colormap[fonema];
            btn2.innerHTML = `<span style="color: ${color};" class="phonetic-transcription-char">${fonema}</span>`;

            if (btn2.textContent == '') {
                btn2.className = "trans-char-btn muta";
                // --- TEST: Aggiunge l'evento per riprodurre il suono al click ---
                btn2.addEventListener('mouseup', (e) => {
                    e.stopPropagation(); // Evita che il click si propaghi ad altri elementi
                    this.animateKey(btn.textContent); // Anima il tasto della lettera corrispondente
                    this.letterClick(e);
                });
                // --- FINE TEST ---
            }
            else {
                btn2.dataset.charPhonetic = fonema;
                btn2.addEventListener('mouseup', (e) => { this.letterClick(e); });
            }
            div.appendChild(btn2);

            this.wordContainer.appendChild(div);

            //this.transcriptionContainer.innerHTML = this.formatPhoneticString(data.wordPhonetic);
            this.classList.add('visible');

        });
    }

    letterClick(e) {
        e.stopPropagation();
        const btn = e.currentTarget;
        const symbol = btn.dataset.charPhonetic;
        if (symbol && this.phoneticAudioMap[symbol]) {
            this.animateKey(symbol); // Anima il tasto del fonema
            //new Audio(this.phoneticAudioMap[symbol]).play();

            //GENIALATA!!! uso il sound Dispatcher per riprodurre i suoni
            this.dispatchEvent(new CustomEvent('keyRelease', {
                bubbles: true,
                composed: true,
                // Al mouseup, invia il suono della parola e la posizione per l'animazione
                detail: {
                    char: btn.dataset.charPhonetic,
                    sound: this.phoneticAudioMap[symbol], // Aggiunto per la sequenza audio                    
                }
            }));


        } else if (!symbol || symbol.trim() === '') {
            this.animateKey(btn.textContent); // Anima il tasto della lettera0
            //new Audio('suoni/tunoncanti.wav').play();
            this.dispatchEvent(new CustomEvent('keyRelease', {
                bubbles: true,
                composed: true,
                // Al mouseup, invia il suono della parola e la posizione per l'animazione
                detail: {
                    char: btn.dataset.charPhonetic,
                    sound: 'suoni/tunoncanti.wav', // Aggiunto per la sequenza audio                    
                }
            }));
        }
    }

    // Metodo pubblico per nascondere il componente
    hide() {
        this.classList.remove('visible');
    }

    // Funzione interna per formattare la trascrizione
    formatPhoneticString(phoneticString) {
        if (!phoneticString) return '';
        const regex = /dʒ|tʃ|eɪ|eə|əʊ|ɪə|ɔɪ|aɪ|aʊ|ʊə|aɪə|aʊə|iː|uː|ɜː|ɔː|aː|./g;
        const symbols = phoneticString.match(regex) || [];
        return symbols.map(symbol => `<span class="phonetic-transcription-char">${symbol}</span>`).join('');
    }
}

customElements.define('word-display', WordDisplay);