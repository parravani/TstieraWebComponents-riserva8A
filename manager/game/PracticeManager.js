import { photoGameManager } from './PhotoGameManager.js';
import { symbolPhrases } from '../../data/symbolPhraseData.js';
import { letterPhrases } from '../../data/letterPhraseData.js';

export class PracticeManager {
    constructor(component) {
        this.component = component;
        this.practiceEnabled = false;
        this.practiceEnabledAt = 0;
        this.selectionEnabled = false;
        this.selectionGlobalClickHandler = null;
        this.practiceGlobalClickHandler = null;
    }

    getAssetPrefix() {
        return this.component.getAssetPrefix();
    }

    enablePractice() {
        this.practiceEnabled = true;
        this.practiceEnabledAt = Date.now();
        this.setupPracticeSelectionListeners();
        this.setupGlobalPracticeListener();
    }

    disablePractice() {
        this.practiceEnabled = false;
        if (this.practiceGlobalClickHandler) {
            window.removeEventListener('click', this.practiceGlobalClickHandler, true);
            this.practiceGlobalClickHandler = null;
        }
    }

    setupPracticeSelectionListeners() {
        const nextButton = this.component.shadowRoot.querySelector('#next-button');
        if (!this.practiceEnabled || !nextButton || nextButton.style.display === 'none') return;
        
        const now = Date.now();
        const activatedMsAgo = now - (this.practiceEnabledAt || 0);
        if (activatedMsAgo < 200) return;

        const ipaBoxes = this.component.shadowRoot.querySelectorAll('#ipa-answer-area .ipa-box');
        const letterBoxes = this.component.shadowRoot.querySelectorAll('#word-reconstruction-area .letter-box');

        ipaBoxes.forEach((box) => {
            // Rimuovi listener precedenti clonando il nodo (metodo rapido per pulizia) o gestendo flag.
            // Qui ci affidiamo al fatto che setupPracticeSelectionListeners viene chiamato una volta per fine gioco.
            box.addEventListener('click', (e) => {
                if (!this.practiceEnabled) return;
                const now = Date.now();
                if (now - (this.practiceEnabledAt || 0) < 200) return;
                
                this.component.stopSuggestions();
                let symbol = null;
                const img = box.querySelector('img');
                const span = box.querySelector('.main-text');
                if (img) symbol = 'SILENT';
                else if (span) symbol = span.textContent;
                if (!symbol) return;

                if (symbol === 'SILENT') {
                    const sorrySound = `${this.getAssetPrefix()}Audio/Tastiere/tunoncanti.wav`;
                    window.soundDispatcher.playSound(sorrySound);
                    const midImg = box.querySelector('img');
                    if (midImg) {
                        midImg.classList.add('midispiace-pulse');
                        setTimeout(() => midImg.classList.remove('midispiace-pulse'), 700);
                    }
                } else {
                    const soundPath = this.component.phonemeSounds.get(symbol);
                    if (soundPath) {
                        const fullSoundPath = `${this.getAssetPrefix()}${soundPath}`;
                        window.soundDispatcher.playSound(fullSoundPath);
                        
                        const phraseEntry = symbolPhrases[symbol];
                        if (phraseEntry && phraseEntry.words && phraseEntry.fullPhraseSound) {
                            const phraseText = phraseEntry.words.map(w => w.text).join(' ').trim();
                            const phraseSoundUrl = `${this.getAssetPrefix()}${phraseEntry.fullPhraseSound}`;
                            const translationText = phraseEntry.translation || null;
                            
                            this.component.animationManager && this.component.animationManager.getAudioDuration(fullSoundPath)
                                .then((dur) => {
                                    const ms = (isFinite(dur) && dur > 0) ? dur * 1000 : 600;
                                    setTimeout(() => {
                                        if (this.component.animationManager && !this.component.animationManager.floatingInProgress) {
                                            this.component.animationManager.animateFloatingPhrase(phraseText, phraseSoundUrl, translationText, phraseEntry.words);
                                        }
                                    }, ms);
                                })
                                .catch(() => {
                                    if (this.component.animationManager && !this.component.animationManager.floatingInProgress) {
                                        this.component.animationManager.animateFloatingPhrase(phraseText, phraseSoundUrl, translationText, phraseEntry.words);
                                    }
                                });
                        }
                    }
                }
                e.stopPropagation();
            });
        });

        letterBoxes.forEach((box) => {
            box.addEventListener('click', (e) => {
                if (!this.practiceEnabled) return;
                const now = Date.now();
                if (now - (this.practiceEnabledAt || 0) < 200) return;
                
                this.component.stopSuggestions();
                const span = box.querySelector('.main-text');
                if (!span) return;
                const letter = span.textContent.toUpperCase();

                const info = this.component.letterInfo ? this.component.letterInfo.get(letter) : null;
                const soundPath = info && info.sound ? info.sound : null;
                if (soundPath) {
                    const fullSoundPath = `${this.getAssetPrefix()}${soundPath}`;
                    window.soundDispatcher.playSound(fullSoundPath);
                    
                    const phraseEntry = letterPhrases[letter];
                    if (phraseEntry && phraseEntry.words && phraseEntry.fullPhraseSound) {
                        const phraseText = phraseEntry.words.map(w => w.text).join(' ').trim();
                        const phraseSoundUrl = `${this.getAssetPrefix()}${phraseEntry.fullPhraseSound}`;
                        const translationText = phraseEntry.translation || null;
                        
                        this.component.animationManager && this.component.animationManager.getAudioDuration(fullSoundPath)
                            .then((dur) => {
                                const ms = (isFinite(dur) && dur > 0) ? dur * 1000 : 600;
                                setTimeout(() => {
                                    if (this.component.animationManager && !this.component.animationManager.floatingInProgress) {
                                        this.component.animationManager.animateFloatingPhrase(phraseText, phraseSoundUrl, translationText, phraseEntry.words);
                                    }
                                }, ms);
                            })
                            .catch(() => {
                                if (this.component.animationManager && !this.component.animationManager.floatingInProgress) {
                                    this.component.animationManager.animateFloatingPhrase(phraseText, phraseSoundUrl, translationText, phraseEntry.words);
                                }
                            });
                    }
                }
                e.stopPropagation();
            });
        });
    }

    startPracticeBySymbol(symbol) {
        if (symbol === 'SILENT') {
            const sorrySound = `${this.getAssetPrefix()}Audio/Tastiere/tunoncanti.wav`;
            window.soundDispatcher.playSound(sorrySound);
            return;
        }

        const info = this.component.phonemeInfo ? this.component.phonemeInfo.get(symbol) : null;
        if (!info || !info.word || !info.wordPhonetic) return;

        this.component._blockAutoStart = false;
        const imageData = {
            img: info.img ? `${this.getAssetPrefix()}${info.img}` : null,
            wordSound: info.wordSound ? `${this.getAssetPrefix()}${info.wordSound}` : null,
            text: info.word,
            fullPhonetic: info.wordPhonetic,
            wordCharPhonetics: Array.isArray(info.wordCharPhonetics) ? info.wordCharPhonetics : null
        };

        const phraseEntry = symbolPhrases[symbol];
        if (phraseEntry) {
            imageData.fullPhraseSound = phraseEntry.fullPhraseSound ? `${this.getAssetPrefix()}${phraseEntry.fullPhraseSound}` : null;
            imageData.fullPhraseText = (phraseEntry.words || []).map(w => w.text).join(' ').trim();
            imageData.translation = phraseEntry.translation || null;
            imageData.translationWord = phraseEntry.translationWord || null;
        }

        if (window.photoGameManager || photoGameManager) {
            photoGameManager.showImageData(imageData);
        } else {
            this.component.setImage(imageData.img || '');
            this.component.startGame({ text: imageData.text, fullPhonetic: imageData.fullPhonetic, wordCharPhonetics: imageData.wordCharPhonetics });
        }
    }

    startPracticeByLetter(letter) {
        const info = this.component.letterInfo ? this.component.letterInfo.get(letter.toUpperCase()) : null;
        if (!info || !info.word || !info.wordPhonetic) return;

        this.component._blockAutoStart = false;
        const imageData = {
            img: info.img ? `${this.getAssetPrefix()}${info.img}` : null,
            wordSound: info.wordSound ? `${this.getAssetPrefix()}${info.wordSound}` : null,
            text: info.word,
            fullPhonetic: info.wordPhonetic,
            wordCharPhonetics: Array.isArray(info.wordCharPhonetics) ? info.wordCharPhonetics : null
        };

        if (window.photoGameManager || photoGameManager) {
            photoGameManager.showImageData(imageData);
        } else {
            this.component.setImage(imageData.img || '');
            this.component.startGame({ text: imageData.text, fullPhonetic: imageData.fullPhonetic, wordCharPhonetics: imageData.wordCharPhonetics });
        }
    }

    setupGlobalPracticeListener() {
        if (this.practiceGlobalClickHandler) return;
        this.practiceGlobalClickHandler = (e) => {
            if (!this.practiceEnabled || !(this.component.gameController.isWordComplete && this.component.gameController.isIpaComplete)) return;
            const now = Date.now();
            if (now - (this.practiceEnabledAt || 0) < 200) return;
            
            const path = e.composedPath ? e.composedPath() : [];
            const insideComponent = path.includes(this.component) || (this.component.shadowRoot && path.some(node => node instanceof Node && this.component.shadowRoot.contains(node)));
            if (insideComponent) return;

            let text = this._findTextInPath(path);
            if (!text) return;

            const isSymbol = this.component.allPhonemes.includes(text);
            const isLetter = this.component.letterStyles.has(text.toUpperCase());

            if (isSymbol) {
                this.startPracticeBySymbol(text);
                e.stopImmediatePropagation(); e.stopPropagation(); e.preventDefault();
            } else if (isLetter) {
                this.startPracticeByLetter(text);
                e.stopImmediatePropagation(); e.stopPropagation(); e.preventDefault();
            }
        };
        window.addEventListener('click', this.practiceGlobalClickHandler, true);
    }

    enableSelectionModeAfterClear() {
        if (this.selectionGlobalClickHandler) {
            try { window.removeEventListener('click', this.selectionGlobalClickHandler, true); } catch {}
            this.selectionGlobalClickHandler = null;
        }
        this.selectionEnabled = true;
        this.selectionGlobalClickHandler = (e) => {
            if (!this.selectionEnabled) return;
            const path = e.composedPath ? e.composedPath() : [];
            const insideComponent = path.includes(this.component) || (this.component.shadowRoot && path.some(node => node instanceof Node && this.component.shadowRoot.contains(node)));
            if (insideComponent) return;

            let text = this._findTextInPath(path);
            if (!text) return;

            const isSymbol = this.component.allPhonemes.includes(text);
            const isLetter = this.component.letterStyles.has(text.toUpperCase());
            if (isSymbol) {
                this.startPracticeBySymbol(text);
                e.stopImmediatePropagation(); e.stopPropagation(); e.preventDefault();
            } else if (isLetter) {
                this.startPracticeByLetter(text);
                e.stopImmediatePropagation(); e.stopPropagation(); e.preventDefault();
            }
        };
        window.addEventListener('click', this.selectionGlobalClickHandler, true);
    }

    enableSoundOnlyMode() {
        if (this.selectionGlobalClickHandler) {
            try { window.removeEventListener('click', this.selectionGlobalClickHandler, true); } catch {}
            this.selectionGlobalClickHandler = null;
        }
        this.selectionEnabled = true;
        this.selectionGlobalClickHandler = (e) => {
            if (!this.selectionEnabled) return;
            const path = e.composedPath ? e.composedPath() : [];
            const insideComponent = path.includes(this.component) || (this.component.shadowRoot && path.some(node => node instanceof Node && this.component.shadowRoot.contains(node)));
            if (insideComponent) return;

            let text = this._findTextInPath(path);
            if (!text) return;

            const isSymbol = this.component.allPhonemes.includes(text);
            const isLetter = this.component.letterStyles.has(text.toUpperCase());
            
            if (isSymbol || isLetter) {
                e.stopImmediatePropagation(); 
                e.stopPropagation(); 
                e.preventDefault();
            }

            if (isSymbol) {
                this.playSoundOnlyBySymbol(text);
            } else if (isLetter) {
                this.playSoundOnlyByLetter(text);
            }
        };
        window.addEventListener('click', this.selectionGlobalClickHandler, true);
    }

    async playSoundOnlyBySymbol(symbol) {
        if (symbol === 'SILENT') {
            const sorrySound = `${this.getAssetPrefix()}Audio/Tastiere/tunoncanti.wav`;
            if (window.soundDispatcher) window.soundDispatcher.playSound(sorrySound);
            return;
        }

        const soundPath = this.component.phonemeSounds.get(symbol);
        const fullSoundPath = soundPath ? `${this.getAssetPrefix()}${soundPath}` : null;
        
        const info = this.component.phonemeInfo ? this.component.phonemeInfo.get(symbol) : null;
        const wordSoundPath = (info && info.wordSound) ? `${this.getAssetPrefix()}${info.wordSound}` : null;

        if (fullSoundPath) {
            if (window.soundDispatcher) window.soundDispatcher.playSound(fullSoundPath);
            if (wordSoundPath) {
                let duration = 0.8;
                if (this.component.animationManager) {
                    try { const d = await this.component.animationManager.getAudioDuration(fullSoundPath); if (d > 0) duration = d; } catch {}
                }
                setTimeout(() => { if (window.soundDispatcher) window.soundDispatcher.playSound(wordSoundPath); }, duration * 1000);
            }
        } else if (wordSoundPath) {
            if (window.soundDispatcher) window.soundDispatcher.playSound(wordSoundPath);
        }
    }

    async playSoundOnlyByLetter(letter) {
        const upper = letter.toUpperCase();
        const info = this.component.letterInfo ? this.component.letterInfo.get(upper) : null;
        if (info) {
            const letterSound = info.sound ? `${this.getAssetPrefix()}${info.sound}` : null;
            const wordSound = info.wordSound ? `${this.getAssetPrefix()}${info.wordSound}` : null;
            if (letterSound) {
                if (window.soundDispatcher) window.soundDispatcher.playSound(letterSound);
                if (wordSound) {
                    let duration = 0.8;
                    if (this.component.animationManager) {
                        try { const d = await this.component.animationManager.getAudioDuration(letterSound); if (d > 0) duration = d; } catch {}
                    }
                    setTimeout(() => { if (window.soundDispatcher) window.soundDispatcher.playSound(wordSound); }, duration * 1000);
                }
            } else if (wordSound) {
                if (window.soundDispatcher) window.soundDispatcher.playSound(wordSound);
            }
        }
    }

    disableSelectionModeAfterStart() {
        this.selectionEnabled = false;
        if (this.selectionGlobalClickHandler) {
            try { window.removeEventListener('click', this.selectionGlobalClickHandler, true); } catch {}
            this.selectionGlobalClickHandler = null;
        }
    }

    _findTextInPath(path) {
        for (const node of path) {
            try {
                if (node && node.classList && node.classList.contains('main-text')) {
                    const t = (node.textContent || '').trim();
                    if (t) return t;
                }
                if (node && node.getAttribute) {
                    if (node.hasAttribute('data-main-text')) return (node.getAttribute('data-main-text') || '').trim();
                    if (node.hasAttribute('data-symbol')) return (node.getAttribute('data-symbol') || '').trim();
                    if (node.hasAttribute('data-ch')) return (node.getAttribute('data-ch') || '').trim();
                }
            } catch {}
        }
        return null;
    }
}