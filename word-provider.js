import { letterWords } from '../data/letterWordData.js';
import { letterPhrases } from '../data/letterPhraseData.js';
import { phoneticPhrases } from '../data/phraseData.js';
import { symbolPhrases } from '../data/symbolPhraseData.js';

/**
 * Sceglie un elemento a caso da un array.
 * @param {Array} arr L'array da cui scegliere.
 * @returns {*} Un elemento casuale dall'array.
 */
function getRandomElement(arr) {
    if (!arr || arr.length === 0) {
        return null;
    }
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Rimuove i duplicati da un array di oggetti parola, basandosi sulla proprietà 'text'.
 * @param {Array<Object>} words L'array di parole.
 * @returns {Array<Object>} L'array di parole senza duplicati.
 */
function deduplicateWords(words) {
    const seen = new Set();
    return words.filter(word => {
        if (!word || !word.text) return false; // Controllo di sicurezza
        const lowerCaseText = word.text.toLowerCase();
        if (seen.has(lowerCaseText)) {
            return false;
        } else {
            seen.add(lowerCaseText);
            return true;
        }
    });
}

/**
 * Ottiene una parola casuale associata a una lettera specifica.
 * La selezione avviene tra la parola singola e le parole della frase corrispondente.
 * @param {string} letter La lettera (es. 'A').
 * @returns {Object|null} Un oggetto parola o null se non viene trovato nulla.
 */
export function getWordForLetter(letter) {
    const singleWord = letterWords[letter];
    const phraseWords = letterPhrases[letter]?.words || [];
    
    const combinedWords = [singleWord, ...phraseWords].filter(Boolean); // Filtra eventuali valori null/undefined
    const uniqueWords = deduplicateWords(combinedWords);
    
    return getRandomElement(uniqueWords);
}

/**
 * Ottiene una parola casuale associata a un simbolo fonetico.
 * La selezione avviene tra le parole delle frasi di phoneticPhrases e symbolPhrases.
 * @param {string} symbol Il simbolo fonetico (es. 'p').
 * @returns {Object|null} Un oggetto parola o null se non viene trovato nulla.
 */
export function getWordForSymbol(symbol) {
    // Raccoglie le parole da entrambi i database per il simbolo dato.
    const wordsFromPhonetic = phoneticPhrases[symbol]?.words || [];
    const wordsFromSymbol = symbolPhrases[symbol]?.words || [];

    const combinedWords = [...wordsFromPhonetic, ...wordsFromSymbol];
    
    // Rimuove i duplicati e filtra eventuali elementi non validi.
    const uniqueWords = deduplicateWords(combinedWords);

    if (uniqueWords.length === 0) {
        return null;
    }
    return getRandomElement(uniqueWords);
}

/**
 * Ottiene una parola casuale da tutti i database disponibili che hanno un file audio.
 * @returns {Object|null} Un oggetto parola o null se non viene trovato nulla.
 */
export function getRandomWord() {
    const allPhoneticWords = Object.values(phoneticPhrases).flatMap(p => p.words);
    const allLetterWords = Object.values(letterWords);
    const allLetterPhraseWords = Object.values(letterPhrases).flatMap(p => p.words);
    const allSymbolPhraseWords = Object.values(symbolPhrases).flatMap(p => p.words);

    // Combina tutte le parole e filtra solo quelle che hanno un file audio per la riproduzione
    const combined = [
        ...allPhoneticWords, 
        ...allLetterWords, 
        ...allLetterPhraseWords, 
        ...allSymbolPhraseWords
    ].filter(w => w && w.wordSound);
    
    const uniqueWords = deduplicateWords(combined);
    return getRandomElement(uniqueWords);
}