// manager/game/PhotoGameManager.js
import { dataService } from '../Data/DataService.js';
import { letterPhrases } from '../../data/letterPhraseData.js';
import { symbolPhrases } from '../../data/symbolPhraseData.js';

class PhotoGameManager {
    constructor() {
        this.imagesData = []; // Modificato per contenere oggetti {img, wordSound}
        this.allPhonemes = null; // Aggiunto per memorizzare tutti i fonemi
        this.photoGameComponent = null;
        this.isGameActive = false;
        this.soundDispatcher = window.soundDispatcher;
        this.currentImageData = null; // Aggiunto per memorizzare l'immagine corrente
        this.largeDbMap = new Map(); // Mappa per il database completo

        // Nuove proprietà per il gioco di parole
        this.currentWord = null;
        this.nextLetterIndex = 0;
        this.letterKeyboard = null; // Riferimento alla tastiera delle lettere
        this.boundHandleLetterClick = this.handleLetterClick.bind(this); // Per event listener
    }

    /**
     * Inizializza il manager, caricando le immagini e impostando il componente.
     * @param {HTMLElement} photoGameComponent - L'istanza di photo-game-component.
     */
    async init(photoGameComponent) {
        console.log('PhotoGameManager: Inizializzazione in corso...');
        this.photoGameComponent = photoGameComponent;
        // Trova la tastiera principale nell'ambito del documento
        this.letterKeyboard = document.querySelector('alphabet-keyboard[data-src="../data/letters.json"]');

        console.log('PhotoGameManager: photoGameComponent impostato:', this.photoGameComponent);
        await this.loadGameData();
        console.log('PhotoGameManager: Dati di gioco caricati.');
        console.log('PhotoGameManager: Inizializzazione completata.');
    }

    startGame() {
        console.log('PhotoGameManager: Avvio del gioco...');
        if (!this.photoGameComponent) {
            console.error('PhotoGameManager: photoGameComponent non impostato. Impossibile avviare il gioco.');
            return;
        }
        this.isGameActive = true;

        // Aggiunge l'ascoltatore per i click sulle lettere
        if (this.letterKeyboard) {
            this.letterKeyboard.addEventListener('keyPress', this.boundHandleLetterClick);
        }

        this.showNextImage();
        console.log('PhotoGameManager: Gioco avviato.');
    }

    stopGame() {
        if (!this.photoGameComponent) return;
        this.isGameActive = false;
        this.currentImageData = null; // Resetta i dati dell'immagine corrente
        this.currentWord = null; // Resetta la parola corrente

        // Rimuove l'ascoltatore per i click sulle lettere
        if (this.letterKeyboard) {
            this.letterKeyboard.removeEventListener('keyPress', this.boundHandleLetterClick);
        }

        if (this.soundDispatcher) {
            this.soundDispatcher.stop();
        }
        this.photoGameComponent.deactivate(); // Chiama il metodo corretto che nasconde l'UI e pulisce lo stato
    }
    
    async handleLetterClick(event) {
        if (!this.isGameActive || !this.currentWord) return;

        const { char, sound } = event.detail;
        if (!char) return;

        // Logica di ricerca robusta del tasto in tutte le tastiere disponibili
        let letterKey = null;
        
        // 1. Usa il target dell'evento se è un tasto valido (incluso dummy key per autospelling)
        if (event.target && (event.target.tagName === 'LETTER-KEY' || (event.target.classList && event.target.classList.contains('dummy-key-voice')))) {
            letterKey = event.target;
        }

        const searchKeyInRoot = (root) => {
            if (!root) return null;
            // 1. Cerca per attributo (più veloce)
            let k = root.querySelector(`letter-key[data-main-text="${char.toUpperCase()}"]`) ||
                    root.querySelector(`letter-key[data-ch="${char.toUpperCase()}"]`);
            
            // 2. Fallback: cerca per contenuto testuale se gli attributi mancano
            if (!k) {
                const allKeys = root.querySelectorAll('letter-key');
                for (const key of allKeys) {
                    const txt = key.getAttribute('data-main-text') || key.getAttribute('data-ch') || key.textContent.trim();
                    if (txt && txt.toUpperCase() === char.toUpperCase()) {
                        return key;
                    }
                    // Cerca anche nello shadowRoot del tasto se accessibile
                    if (key.shadowRoot) {
                        const mainText = key.shadowRoot.querySelector('.main-text');
                        if (mainText && mainText.textContent.trim().toUpperCase() === char.toUpperCase()) {
                            return key;
                        }
                    }
                }
            }
            return k;
        };

        // 2. Se non trovato nel target, cerca nelle tastiere
        if (!letterKey) {
            // Costruisci lista di tastiere candidate
            let candidateKeyboards = [];
            if (this.letterKeyboard && this.letterKeyboard.isConnected) {
                candidateKeyboards.push(this.letterKeyboard);
            }
            
            // Aggiungi tastiere dal documento
            document.querySelectorAll('alphabet-keyboard').forEach(kb => candidateKeyboards.push(kb));
            
            // Aggiungi tastiere dallo scope del componente (se in Shadow DOM)
            if (this.photoGameComponent) {
                const root = this.photoGameComponent.getRootNode();
                if (root && root.querySelectorAll) {
                    root.querySelectorAll('alphabet-keyboard').forEach(kb => candidateKeyboards.push(kb));
                }
            }

            // Rimuovi duplicati
            candidateKeyboards = [...new Set(candidateKeyboards)];

            // Cerca il tasto nelle tastiere trovate
            for (const kb of candidateKeyboards) {
                const root = kb.shadowRoot || kb;
                letterKey = searchKeyInRoot(root);
                if (letterKey) {
                    this.letterKeyboard = kb; // Aggiorna riferimento
                    break;
                }
            }
        }
        
        // FIX: Controllo di sicurezza se la parola è già completa
        if (this.nextLetterIndex >= this.currentWord.length) {
             return;
        }

        const expectedChar = this.currentWord[this.nextLetterIndex];
        if (expectedChar === undefined) {
             console.error('Errore: la lettera attesa è indefinita. La parola potrebbe essere già completa.');
             return;
        }

        // Determina se il prefisso ../ è necessario
        // Normalizza il percorso del suono della lettera usando la stessa logica dei wordSound
        const correctedSoundPath = this.buildAudioPath(sound);

        if (char.toLowerCase() === expectedChar.toLowerCase()) {
            // LETTERA CORRETTA
            // Riproduce il suono immediatamente con il percorso corretto
            if (correctedSoundPath && this.soundDispatcher) {
                this.soundDispatcher.playSound(correctedSoundPath);
            }

            // Avvia l'animazione di volo con una durata fissa
            const flightDuration = 1.2; // Durata fissa in secondi
            if (this.photoGameComponent && this.photoGameComponent.flyLetterToBox) {
                // Passa anche 'char' per gestire il caso in cui letterKey non sia trovato (es. comando vocale)
                this.photoGameComponent.flyLetterToBox(letterKey, this.nextLetterIndex, flightDuration, correctedSoundPath, char);
            }
            
            this.nextLetterIndex++;

            if (this.nextLetterIndex === this.currentWord.length) {
                console.log("Hai completato la parola!");
                // Notifica al componente che la parola è completa
                if (this.photoGameComponent && this.photoGameComponent.notifyWordCompleted) {
                    this.photoGameComponent.notifyWordCompleted();
                }
            }

        } else {
            // LETTERA SBAGLIATA
            // 1. Fa vibrare il tasto premuto sulla tastiera
            if (letterKey && this.photoGameComponent && this.photoGameComponent.shakeElement) {
                this.photoGameComponent.shakeElement(letterKey);
            }
            // 2. Notifica al componente di incrementare l'errore e far pulsare il box di destinazione
            if (this.photoGameComponent && this.photoGameComponent.incrementLetterError) {
                this.photoGameComponent.incrementLetterError(this.nextLetterIndex);
            }
        }
    }

    /**
     * Normalizza e costruisce un percorso audio completo, gestendo il prefisso relativo.
     * @param {string} path - Il percorso audio originale.
     * @returns {string|null} Il percorso audio completo e corretto, o null.
     */
    buildAudioPath(path) {
        if (!path) return null;

        const prefix = window.location.pathname.includes('/games/') ? '../' : '';
        
        // Rimuove un eventuale prefisso "Audio/" o "audio/" per evitare duplicazioni.
        let cleanPath = path.replace(/^(..\/)?(audio|Audio)\//, '');

        // Costruisce il percorso finale corretto.
        return `${prefix}Audio/${cleanPath}`;
    }


    /**
     * Carica tutti i dati necessari per il gioco (immagini, suoni, fonemi).
     */
    async loadGameData() {
        try {
            const dataPath = window.location.pathname.includes('/games/') ? '../data/' : 'data/';
            
            // Carica il database completo per primo per popolare la mappa
            try {
                const largeDbData = await dataService.getData(`${dataPath}database_words_complete.json`);
                if (Array.isArray(largeDbData)) {
                    largeDbData.forEach(item => {
                        if (item.text) this.largeDbMap.set(item.text.toLowerCase(), item);
                    });
                }
            } catch (e) {
                console.warn("Database completo non caricato o non trovato:", e);
            }

            await this.loadAndProcessData(`${dataPath}letters.json`, 'letters.json');
            await this.loadAndProcessData(`${dataPath}phonemes-new.json`, 'phonemes-new.json');

            console.log(`Caricati ${this.imagesData.length} elementi totali.`);
        } catch (error) {
            console.error('Errore durante il caricamento dei dati:', error);
        }
    }

    /**
     * Estrae i dati (immagini e suoni) e li aggiunge all'array this.imagesData.
     * @param {object} data - L'oggetto dati contenente il layout delle chiavi.
     */
    extractData(data) {
        // Determina quale set di dati di frasi usare in base al file di origine
        let phraseDataSource;
        if (data.source === 'letters.json') {
            phraseDataSource = letterPhrases;
        } else if (data.source === 'phonemes-new.json') {
            phraseDataSource = symbolPhrases;
        } else {
            phraseDataSource = {};
        }

        if (data && data.layout) {
            data.layout.forEach(row => {
                if (row.keys) {
                    row.keys.forEach(key => {
                        if (key.img && key.wordSound) {
                            // Cerca la frase corrispondente usando la chiave 'ch' (per i simboli)
                            // o la prima lettera della parola (per le lettere)
                            const phraseData = phraseDataSource[key.ch] || {};
                            
                            let wordData = {
                                img: this.buildImagePath(key.img),
                                wordSound: this.buildAudioPath(key.wordSound),
                                text: key.word,
                                fullPhonetic: key.wordPhonetic,
                                wordCharPhonetics: key.wordCharPhonetics,
                                // Unisce i dati della frase
                                fullPhraseSound: this.buildAudioPath(phraseData.fullPhraseSound),
                                fullPhraseText: phraseData.words ? phraseData.words.map(w => w.text).join(' ') : null,
                                translation: phraseData.translation || null,
                                translationWord: phraseData.translationWord || null
                            };

                            // MERGE: Se la parola esiste nel database completo, usa i dati fonetici e silent letters da lì
                            if (this.largeDbMap.has(key.word.toLowerCase())) {
                                const largeEntry = this.largeDbMap.get(key.word.toLowerCase());
                                
                                // Sovrascrivi la fonetica completa (spesso più accurata nel DB grande)
                                if (largeEntry.fullPhonetic) {
                                    wordData.fullPhonetic = largeEntry.fullPhonetic.replace(/\/\//g, '');
                                }

                                // Aggiungi silentIndexes se presenti (fondamentale per la corretta ricostruzione)
                                if (largeEntry.silentIndexes && Array.isArray(largeEntry.silentIndexes)) {
                                    wordData.silentIndexes = largeEntry.silentIndexes;
                                }
                            }

                            this.imagesData.push(wordData);
                        }
                    });
                }
            });
        }
    }

    /**
     * Costruisce un percorso immagine completo, gestendo il prefisso relativo.
     * @param {string} path - Il percorso immagine originale.
     * @returns {string|null} Il percorso immagine completo e corretto, o null.
     */
    buildImagePath(path) {
        if (!path) return null;
        const prefix = window.location.pathname.includes('/games/') ? '../' : '';
        return `${prefix}${path}`;
    }
    
    /**
     * Carica i dati e assegna una fonte per identificarli.
     */
    async loadAndProcessData(path, sourceName) {
        const data = await dataService.getData(path);
        data.source = sourceName; // Aggiunge un identificatore
        this.extractData(data);
    }
    /**
     * Unifica gli stili dopo il caricamento dei dati.
     */
    unifyStyles() {
        // Questa logica non è più necessaria qui, la spostiamo nel componente
        // dove i dati vengono effettivamente utilizzati per creare l'UI.
        // Manteniamo il metodo per future logiche di stile globali se necessario.
    }

    /**
     * Restituisce un oggetto immagine casuale.
     * @returns {{img: string, wordSound: string, text: string, fullPhonetic: string}|null}
     */
    getRandomImageData() {
        if (this.imagesData.length === 0) {
            return null;
        }
        const randomIndex = Math.floor(Math.random() * this.imagesData.length);
        return this.imagesData[randomIndex];
    }

    /**
     * Seleziona un'immagine casuale, la visualizza e prepara le aree di gioco.
     */
    showNextImage() {
        this.currentImageData = this.getRandomImageData();
        if (this.photoGameComponent && this.currentImageData) {
            this.isGameActive = true;
            this.currentWord = this.currentImageData.text;
            this.nextLetterIndex = 0;
            this.photoGameComponent.setImage(this.currentImageData.img);
            const wordData = {
                text: this.currentImageData.text,
                fullPhonetic: this.currentImageData.fullPhonetic,
                wordCharPhonetics: this.currentImageData.wordCharPhonetics
            };
            this.photoGameComponent.startGame(wordData);
            // Blocca la riproduzione automatica dell'audio se la pagina non è pronta
            if (this.photoGameComponent.voiceCommandManager && this.photoGameComponent.voiceCommandManager.isReadyForVoiceCommands) {
                this.playCurrentImageSound();
            }
        } else if (!this.currentImageData) {
            console.warn('Nessun dato immagine disponibile da visualizzare.');
        }
    }

    /**
     * Visualizza e prepara un turno per un'immagine specifica (usata per la pratica).
     * @param {object} imageData - Oggetto con campi {img, wordSound, text, fullPhonetic, wordCharPhonetics, fullPhraseSound?, fullPhraseText?, translation?, translationWord?}
     */
    showImageData(imageData) {
        if (!imageData || !this.photoGameComponent) return;
        this.currentImageData = imageData;
        this.isGameActive = true; // Forza lo stato attivo

        // Imposta stato parola per la tastiera lettere
        this.currentWord = imageData.text;
        this.nextLetterIndex = 0;

        if (imageData.img) {
            this.photoGameComponent.setImage(imageData.img);
        }

        const wordData = {
            text: imageData.text,
            fullPhonetic: imageData.fullPhonetic,
            wordCharPhonetics: imageData.wordCharPhonetics,
            silentIndexes: imageData.silentIndexes,
            isPracticeWord: imageData.isPracticeWord
        };
        this.photoGameComponent.startGame(wordData);

        // Riproduci il suono della parola solo se la pagina è pronta
        if (imageData.wordSound && this.photoGameComponent.voiceCommandManager && this.photoGameComponent.voiceCommandManager.isReadyForVoiceCommands) {
            this.playCurrentImageSound();
        }
    }

    /**
     * Recupera i dati di una parola dal database completo o dai dati caricati.
     * Utile per la modalità pratica quando la parola non è nelle immagini predefinite.
     * @param {string} text - La parola da cercare.
     * @returns {object|null} I dati della parola o null.
     */
    getWordData(text) {
        if (!text) return null;
        const lowerText = text.toLowerCase();
        
        // 1. Cerca in imagesData (priorità ai dati curati manualmente con immagini)
        const existing = this.imagesData.find(d => d.text.toLowerCase() === lowerText);
        if (existing) return existing;

        // 2. Cerca nel database completo
        if (this.largeDbMap.has(lowerText)) {
            const entry = this.largeDbMap.get(lowerText);
            return {
                text: entry.text,
                fullPhonetic: entry.fullPhonetic ? entry.fullPhonetic.replace(/\//g, '') : '',
                silentIndexes: entry.silentIndexes || [],
                // IMPORTANTE: Lasciare null! Non generare array di lettere, il componente userà la fonetica.
                wordCharPhonetics: null, 
                img: null, 
                wordSound: null 
            };
        }
        return null;
    }

    /**
     * Riproduce il suono dell'immagine corrente.
     */
    playCurrentImageSound() {
        console.log('playCurrentImageSound chiamato.');
        console.log('this.soundDispatcher:', this.soundDispatcher);
        console.log('this.currentImageData:', this.currentImageData);
        console.log('this.currentImageData.wordSound:', this.currentImageData ? this.currentImageData.wordSound : 'N/A');

        if (this.soundDispatcher && this.currentImageData && this.currentImageData.wordSound) {
            this.soundDispatcher.playSound(this.currentImageData.wordSound);
        } else {
            console.warn("Nessun suono da riprodurre per l'immagine corrente.");
        }
    }

    /**
     * Avvia la sequenza di fine gioco: prima il suono della parola, poi l'animazione della frase.
     */
    async startEndGameSequence() {
        if (!this.currentImageData || !this.currentImageData.wordSound) {
            console.warn("Nessun suono della parola da riprodurre. Avvio direttamente l'animazione della frase.");
            this.playFullPhraseAnimation();
            return;
        }

        // 1. Riproduce il suono della parola
        this.playCurrentImageSound();

        try {
            // 2. Attende la fine del suono della parola
            const wordSoundDuration = await this.photoGameComponent.getAudioDuration(this.currentImageData.wordSound);
            setTimeout(() => {
                // 3. Avvia l'animazione della frase
                this.playFullPhraseAnimation();
            }, wordSoundDuration * 1000);
        } catch (error) {
            console.error("Errore nel recuperare la durata del suono, avvio l'animazione della frase immediatamente.", error);
            this.playFullPhraseAnimation();
        }
    }

    /**
     * Avvia l'animazione della frase completa, sincronizzata con l'audio.
     */
    async playFullPhraseAnimation() {
        if (!this.currentImageData || !this.currentImageData.fullPhraseSound || !this.currentImageData.fullPhraseText) {
            console.warn("Dati della frase completa non disponibili.");
            return;
        }

        // Avvia l'animazione sul componente
        await this.photoGameComponent.animateFullPhrase(this.currentImageData.fullPhraseText, this.currentImageData.fullPhraseSound, this.currentImageData.translation);
    }
}

export const photoGameManager = new PhotoGameManager();
