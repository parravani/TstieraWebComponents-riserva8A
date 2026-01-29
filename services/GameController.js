// /Applications/XAMPP/xamppfiles/htdocs/TastieraWebComponents riserva8A/services/GameController.js

import { phoneticService } from './PhoneticService.js';

export class GameController {
    constructor(view) {
        this.view = view;
        this.state = {
            correctIpaSequence: [],
            correctIpaSet: new Set(),
            nextIpaIndex: 0,
            symbolErrors: 0,
            letterErrors: 0,
            currentWord: '',
            isWordComplete: false,
            isIpaComplete: false,
            silentSlotsTotal: 0,
            silentSlotsFilled: 0,
            timeoutErrors: 0
        };
    }

    reset() {
        this.state = {
            correctIpaSequence: [],
            correctIpaSet: new Set(),
            nextIpaIndex: 0,
            symbolErrors: 0,
            letterErrors: 0,
            currentWord: '',
            isWordComplete: false,
            isIpaComplete: false,
            silentSlotsTotal: 0,
            silentSlotsFilled: 0,
            timeoutErrors: 0
        };
        // Aggiorna i contatori nella vista
        if (this.view.updateErrorCounters) {
            this.view.updateErrorCounters();
        }
    }

    /**
     * Inizializza un nuovo turno di gioco calcolando la sequenza corretta.
     */
    initTurn(wordData) {
        this.reset();
        const word = wordData.text;
        this.state.currentWord = word;

        // Logica di calcolo della sequenza IPA corretta (spostata dal componente)
        const ipaSymbols = phoneticService.parsePhoneticString(wordData.fullPhonetic.trim());
        const lettersArray = Array.from(word);
        const charPhonetics = Array.isArray(wordData.wordCharPhonetics) ? wordData.wordCharPhonetics : null;
        let expectedByIndex = new Array(lettersArray.length);

        if (charPhonetics && charPhonetics.length === lettersArray.length) {
            for (let i = 0; i < expectedByIndex.length; i++) {
                expectedByIndex[i] = charPhonetics[i] === '' ? 'SILENT' : phoneticService.normalizePhonemeSymbol(charPhonetics[i]);
            }
        } else {
            let silentIndexes = Array.isArray(wordData.silentIndexes) ? [...wordData.silentIndexes] : [];
            if (!silentIndexes.length && charPhonetics) {
                silentIndexes = charPhonetics
                    .map((ph, idx) => (ph === '' ? idx : null))
                    .filter(idx => idx !== null);
            }

            if (silentIndexes.length > 0) {
                let ipaCursor = 0;
                for (let i = 0; i < expectedByIndex.length; i++) {
                    if (silentIndexes.includes(i)) {
                        expectedByIndex[i] = 'SILENT';
                    } else {
                        expectedByIndex[i] = ipaSymbols[ipaCursor] || 'SILENT';
                        if (ipaCursor < ipaSymbols.length) ipaCursor++;
                    }
                }
            } else {
                expectedByIndex = phoneticService.alignPhoneticsToLetters(word, wordData.fullPhonetic.trim());
            }
        }

        this.state.correctIpaSequence = expectedByIndex;
        this.state.correctIpaSet = new Set([...ipaSymbols, 'SILENT']);
        this.state.silentSlotsTotal = expectedByIndex.filter(v => v === 'SILENT').length;
        
        // Salta eventuali spazi iniziali
        this.state.nextIpaIndex = 0;
        while (this.state.nextIpaIndex < this.state.correctIpaSequence.length && this.state.correctIpaSequence[this.state.nextIpaIndex] === ' ') {
            this.state.nextIpaIndex++;
        }
    }

    /**
     * Gestisce l'interazione con un simbolo IPA (click).
     */
    handleSymbolInteraction(symbol, element) {
        const targetIndex = this.state.nextIpaIndex;
        const expected = this.state.correctIpaSequence[targetIndex];

        if (symbol === 'SILENT') {
            if (expected === 'SILENT') {
                // Risposta corretta (SILENT)
                this.view.animateSilentCorrect(element, targetIndex);
                this.advanceIpaIndex();
                this.state.silentSlotsFilled++;
                
                // Se tutte le silent sono state trovate, nascondi l'opzione
                if (this.state.silentSlotsFilled >= this.state.silentSlotsTotal) {
                    this.view.hideSilentOption();
                }
                this.checkForWin();
            } else {
                // Errore (SILENT)
                this.state.symbolErrors++;
                this.view.updateErrorCounters();
                this.view.animateError(targetIndex);
            }
        } else {
            if (symbol === expected) {
                // Risposta corretta (Simbolo)
                this.view.animateSymbolCorrect(element, targetIndex, symbol);
                this.advanceIpaIndex();
                this.checkForWin();
            } else {
                // Errore (Simbolo)
                this.state.symbolErrors++;
                this.view.updateErrorCounters();
                this.view.animateError(targetIndex);
                
                // Nascondi l'opzione se non è presente nella parola (distrattore)
                if (!this.state.correctIpaSet.has(symbol)) {
                    this.view.hideOption(element);
                }
            }
        }
    }

    advanceIpaIndex() {
        this.state.nextIpaIndex++;
        // Salta gli spazi
        while (this.state.nextIpaIndex < this.state.correctIpaSequence.length && this.state.correctIpaSequence[this.state.nextIpaIndex] === ' ') {
            this.state.nextIpaIndex++;
        }
    }

    checkForWin() {
        if (this.state.nextIpaIndex === this.state.correctIpaSequence.length) {
            console.log("Riga IPA completata!");
            this.state.isIpaComplete = true;
            this.view.onIpaComplete();
            this.checkBothTasksComplete();
        }
    }

    notifyWordCompleted() {
        console.log("Riga lettere completata!");
        this.state.isWordComplete = true;
        this.view.onWordComplete(this.state.correctIpaSequence);
        this.checkBothTasksComplete();
    }

    checkBothTasksComplete() {
        if (this.state.isWordComplete && this.state.isIpaComplete) {
            console.log("Tutte le attività completate!");
            this.view.onGameComplete();
        }
    }
    
    incrementLetterError(index) {
        this.state.letterErrors++;
        this.view.updateErrorCounters();
        this.view.animateLetterError(index);
    }

    incrementTimeoutError() {
        this.state.timeoutErrors++;
        this.view.updateErrorCounters();
    }

    // Getters per lo stato
    get correctIpaSequence() { return this.state.correctIpaSequence; }
    get correctIpaSet() { return this.state.correctIpaSet; }
    get nextIpaIndex() { return this.state.nextIpaIndex; }
    get symbolErrors() { return this.state.symbolErrors; }
    get letterErrors() { return this.state.letterErrors; }
    get timeoutErrors() { return this.state.timeoutErrors; }
    get currentWord() { return this.state.currentWord; }
    get isWordComplete() { return this.state.isWordComplete; }
    get isIpaComplete() { return this.state.isIpaComplete; }
}
