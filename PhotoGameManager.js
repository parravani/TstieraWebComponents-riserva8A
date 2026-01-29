// manager/game/PhotoGameManager.js
import { dataService } from '../Data/DataService.js';

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
        this.photoGameComponent.showNextButton();
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

        const letterKey = this.letterKeyboard.shadowRoot.querySelector(`letter-key[data-main-text="${char.toUpperCase()}"]`);
        if (!letterKey) {
            console.error(`Impossibile trovare l'elemento letter-key per il carattere: ${char}`);
            return;
        }
        
        const expectedChar = this.currentWord[this.nextLetterIndex];
        if (expectedChar === undefined) {
             console.error('Errore: la lettera attesa è indefinita. La parola potrebbe essere già completa.');
             return;
        }

        // Determina se il prefisso ../ è necessario
        const needsPrefix = window.location.pathname.includes('/games/');
        const correctedSoundPath = sound && needsPrefix && !sound.startsWith('../') ? `../${sound}` : sound;

        if (char.toLowerCase() === expectedChar.toLowerCase()) {
            // LETTERA CORRETTA
            // Riproduce il suono immediatamente con il percorso corretto
            if (correctedSoundPath) {
                this.soundDispatcher.playSound(correctedSoundPath);
            }

            // Avvia l'animazione di volo con una durata fissa
            const flightDuration = 1.2; // Durata fissa in secondi
            if (this.photoGameComponent.flyLetterToBox) {
                this.photoGameComponent.flyLetterToBox(letterKey, this.nextLetterIndex, flightDuration);
            }
            
            this.nextLetterIndex++;

            if (this.nextLetterIndex === this.currentWord.length) {
                console.log("Hai completato la parola!");
            }

        } else {
            // LETTERA SBAGLIATA
            if (this.photoGameComponent.shakeElement) {
                this.photoGameComponent.shakeElement(letterKey);
            }
        }
    }


    /**
     * Carica tutti i dati necessari per il gioco (immagini, suoni, fonemi).
     */
    async loadGameData() {
        try {
            const dataPath = window.location.pathname.includes('/games/') ? '../data/' : 'data/';
            
            // Caricamento parallelo dei dati
            const [lettersData, phonemesData, largeDbData] = await Promise.all([
                dataService.getData(`${dataPath}letters.json`),
                dataService.getData(`${dataPath}phonemes-new.json`),
                dataService.getData(`${dataPath}database_words_complete.json`)
            ]);
            
            this.allPhonemes = phonemesData; // Memorizza i fonemi
            
            // Popola la mappa del database completo
            if (Array.isArray(largeDbData)) {
                largeDbData.forEach(item => {
                    if (item.text) this.largeDbMap.set(item.text.toLowerCase(), item);
                });
            }

            this.extractData(lettersData);
            this.extractData(phonemesData);
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
        if (data && data.layout) {
            data.layout.forEach(row => {
                if (row.keys) {
                    row.keys.forEach(key => {
                        if (key.img && key.wordSound) {
                            const prefix = window.location.pathname.includes('/games/') ? '../' : '';
                            
                            let soundPath = key.wordSound;
                            
                            // Prima normalizziamo il prefisso "audio/" a "Audio/" (case-insensitive)
                            if (soundPath.toLowerCase().startsWith('audio/')) {
                                soundPath = 'Audio/' + soundPath.substring(6); // Rimuove 'audio/' e aggiunge 'Audio/'
                            } else if (!soundPath.startsWith('Audio/')) {
                                soundPath = 'Audio/' + soundPath; // Aggiunge 'Audio/' se non presente
                            }

                            // Normalizza i nomi delle sottocartelle principali a maiuscolo se necessario
                            soundPath = soundPath.replace(/imasimbosuoni/i, 'IMASIMBOSUONI');
                            soundPath = soundPath.replace(/letteparosuoni/i, 'LETTEPAROSUONI');

                            const pathParts = soundPath.split('/');
                            const filename = pathParts.pop().toLowerCase();
                            const dirPath = pathParts.join('/');
                            const finalSoundPath = `${dirPath}/${filename}`;

                            let wordData = {
                                img: `${prefix}${key.img}`,
                                wordSound: `${prefix}${finalSoundPath}`,
                                text: key.word,
                                fullPhonetic: key.wordPhonetic,
                                wordCharPhonetics: key.wordCharPhonetics || null
                            };

                            // MERGE: Se la parola esiste nel database completo, usa i dati fonetici e silent letters da lì
                            if (this.largeDbMap.has(key.word.toLowerCase())) {
                                const largeEntry = this.largeDbMap.get(key.word.toLowerCase());
                                
                                // Sovrascrivi la fonetica completa (spesso più accurata nel DB grande)
                                if (largeEntry.fullPhonetic) {
                                    wordData.fullPhonetic = largeEntry.fullPhonetic.replace(/\/\//g, '');
                                }

                                // Gestione Silent Letters
                                if (largeEntry.silentIndexes && Array.isArray(largeEntry.silentIndexes)) {
                                    wordData.silentIndexes = largeEntry.silentIndexes;
                                    // Genera wordCharPhonetics per le silent letters se non presente o incompleto
                                    if (!wordData.wordCharPhonetics) {
                                        wordData.wordCharPhonetics = key.word.split('').map((char, index) => {
                                            return largeEntry.silentIndexes.includes(index) ? "" : char;
                                        });
                                    }
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
            
            // Resetta lo stato del gioco della parola
            this.currentWord = this.currentImageData.text;
            this.nextLetterIndex = 0;

            this.photoGameComponent.setImage(this.currentImageData.img);
            
            // Costruisce l'oggetto wordData come richiesto dal componente
            const wordData = {
                text: this.currentImageData.text,
                fullPhonetic: this.currentImageData.fullPhonetic,
                wordCharPhonetics: this.currentImageData.wordCharPhonetics,
                silentIndexes: this.currentImageData.silentIndexes
            };

            // Chiama il metodo startGame del componente per impostare il turno
            this.photoGameComponent.startGame(wordData);
            
            this.playCurrentImageSound();
        } else if (!this.currentImageData) {
            console.warn('Nessun dato immagine disponibile da visualizzare.');
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
                fullPhonetic: entry.fullPhonetic ? entry.fullPhonetic.replace(/\/\//g, '') : '',
                silentIndexes: entry.silentIndexes || [],
                // Genera wordCharPhonetics per le silent letters (necessario per il componente)
                wordCharPhonetics: entry.text.split('').map((char, index) => {
                    return (entry.silentIndexes && entry.silentIndexes.includes(index)) ? "" : char;
                }),
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
}

export const photoGameManager = new PhotoGameManager();
