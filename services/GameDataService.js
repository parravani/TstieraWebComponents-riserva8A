// /Applications/XAMPP/xamppfiles/htdocs/TastieraWebComponents riserva8A/services/GameDataService.js

export class GameDataService {
    constructor() {
        // Contenitori dati
        this.phonemeStyles = new Map();
        this.phonemeSounds = new Map();
        this.phonemeInfo = new Map();
        this.allPhonemes = [];
        this.letterStyles = new Map();
        this.letterInfo = new Map();
        this.allWordsData = [];
    }

    getDataPath() {
        return window.location.pathname.includes('/games/') ? '../data/' : 'data/';
    }

    /**
     * Carica e processa tutti i dati necessari per il gioco.
     * @returns {Promise<Object>} Oggetto contenente tutte le mappe e array di dati popolati.
     */
    async loadAllGameData() {
        const dataPath = this.getDataPath();
        
        // Reset dei contenitori per evitare duplicati in caso di ricaricamento
        this.phonemeStyles.clear();
        this.phonemeSounds.clear();
        this.phonemeInfo.clear();
        this.allPhonemes = [];
        this.letterStyles.clear();
        this.letterInfo.clear();
        this.allWordsData = [];

        await Promise.all([
            this.loadPhonemes(`${dataPath}phonemes-new.json`),
            this.loadLetters(`${dataPath}letters.json`),
            this.loadWords(`${dataPath}database_words_complete.json`)
        ]);

        return {
            phonemeStyles: this.phonemeStyles,
            phonemeSounds: this.phonemeSounds,
            phonemeInfo: this.phonemeInfo,
            allPhonemes: this.allPhonemes,
            letterStyles: this.letterStyles,
            letterInfo: this.letterInfo,
            allWordsData: this.allWordsData
        };
    }

    async loadPhonemes(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            
            data.layout.forEach(row => {
                row.keys.forEach(key => {
                    this.allPhonemes.push(key.ch);
                    if (key.style) this.phonemeStyles.set(key.ch, key.style);
                    if (key.sound) this.phonemeSounds.set(key.ch, key.sound);
                    this.phonemeInfo.set(key.ch, {
                        img: key.img,
                        word: key.word,
                        wordSound: key.wordSound,
                        sound: key.sound,
                        wordPhonetic: key.wordPhonetic,
                        wordCharPhonetics: key.wordCharPhonetics
                    });
                });
            });

            // Ordina i fonemi per lunghezza decrescente per un parsing greedy corretto
            this.allPhonemes.sort((a, b) => b.length - a.length);

            // Gestione speciale per 'ks' (es. in EXIT)
            if (!this.phonemeStyles.has('ks')) {
                const refStyle = this.phonemeStyles.get('k') || this.phonemeStyles.get('s');
                if (refStyle) this.phonemeStyles.set('ks', { ...refStyle });
            }

            // Gestione speciale per 'i' (happy vowel)
            if (!this.allPhonemes.includes('i')) {
                this.allPhonemes.push('i');
                this.allPhonemes.sort((a, b) => b.length - a.length);
            }
            if (!this.phonemeStyles.has('i')) {
                const refStyle = this.phonemeStyles.get('ɪ');
                if (refStyle) this.phonemeStyles.set('i', { ...refStyle });
            }
            if (!this.phonemeSounds.has('i')) {
                const refSound = this.phonemeSounds.get('ɪ');
                if (refSound) this.phonemeSounds.set('i', refSound);
            }

            // Gestione speciale per 'ju:'
            if (!this.allPhonemes.includes('ju:')) {
                this.allPhonemes.push('ju:');
                this.allPhonemes.sort((a, b) => b.length - a.length);
            }
            this.phonemeSounds.set('ju:', 'Audio/Tastiere/ulunga.wav');

        } catch (error) {
            console.error("Could not load phonemes:", error);
        }
    }

    async loadLetters(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            
            data.layout.forEach(row => {
                row.keys.forEach(key => {
                    if (key.style) this.letterStyles.set(key.ch.toUpperCase(), key.style);
                    this.letterInfo.set(key.ch.toUpperCase(), {
                        img: key.img,
                        word: key.word,
                        wordSound: key.wordSound,
                        sound: key.sound,
                        wordPhonetic: key.wordPhonetic,
                        wordCharPhonetics: key.wordCharPhonetics
                    });
                });
            });
        } catch (error) {
            console.error("Could not load letters:", error);
        }
    }

    async loadWords(url) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                this.allWordsData = await response.json();
            } else {
                console.warn('Word database not found (database_words_complete.json), extended practice mode limited.');
                this.allWordsData = [];
            }
        } catch (e) {
            console.warn('Error loading word database:', e);
            this.allWordsData = [];
        }
    }
}

export const gameDataService = new GameDataService();
