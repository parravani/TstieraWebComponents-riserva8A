import { AnimationUtils } from '../../services/AnimationUtils.js';
import { phoneticService } from '../../services/PhoneticService.js';
import { voiceService } from '../../services/VoiceService.js';
import { photoGameManager } from './PhotoGameManager.js';
import { symbolPhrases } from '../../data/symbolPhraseData.js';
import { letterPhrases } from '../../data/letterPhraseData.js';

export class AnimationManager {
    constructor(component) {
        this.component = component;
        this.floatingInProgress = false;
        this._floatingGuardStyle = null;
        this._againArrow = null;
        this._arrows = [];
        
        // Stato per animazione frasi
        this.activePhraseAudio = null;
        this.translationTimeoutId = null;
        this.phraseFadeOutTimeoutId = null;
        this.clearPhraseTimeoutId = null;
        this.lastAnimatePhraseArgs = null;
        this._currentFlyPromise = null;
    }

    getAssetPrefix() {
        return this.component.getAssetPrefix();
    }

    getAudioDuration(audioUrl) {
        return new Promise((resolve, reject) => {
            const audio = new Audio();
            const timeout = setTimeout(() => {
                console.warn(`getAudioDuration timeout for ${audioUrl}`);
                resolve(0); // Risolve con 0 per non bloccare il flusso
            }, 2000); // Timeout di 2 secondi

            audio.addEventListener('loadedmetadata', () => {
                clearTimeout(timeout);
                console.log(`getAudioDuration - ${audioUrl} loaded. Duration: ${audio.duration}`);
                resolve(audio.duration);
            }, { once: true });
            audio.addEventListener('error', (e) => {
                clearTimeout(timeout);
                console.error(`Error loading audio ${audioUrl}:`, e);
                reject(new Error(`Failed to load audio: ${audioUrl}`));
            }, { once: true });
            audio.src = audioUrl;
        });
    }

    animateSilentCorrect(clickedEl, targetIndex) {
        const targetBox = this.component.ipaAnswerArea.children[targetIndex];
        const gameArea = this.component.shadowRoot.querySelector('#game-area');
        const startRect = clickedEl.getBoundingClientRect();
        const targetRect = targetBox.getBoundingClientRect();
        const startX = startRect.left - gameArea.getBoundingClientRect().left;
        const startY = startRect.top - gameArea.getBoundingClientRect().top;
        const endX = targetRect.left - gameArea.getBoundingClientRect().left + (targetRect.width - startRect.width) / 2;
        const endY = targetRect.top - gameArea.getBoundingClientRect().top + (targetRect.height - startRect.height) / 2;

        const flyingClone = clickedEl.cloneNode(true);
        flyingClone.style.visibility = 'visible';
        flyingClone.classList.add('flying-symbol');
        flyingClone.style.left = `${startX}px`;
        flyingClone.style.top = `${startY}px`;
        flyingClone.style.width = `${startRect.width}px`;
        flyingClone.style.height = `${startRect.height}px`;
        gameArea.appendChild(flyingClone);

        const animation = flyingClone.animate([
            { transform: 'translate(0, 0) rotate(0deg) scale(1)', offset: 0 },
            { transform: `translate(${endX - startX}px, ${endY - startY}px) rotate(360deg) scale(0.8)`, offset: 1 }
        ], {
            duration: 600,
            easing: 'ease-in-out',
            fill: 'forwards'
        });

        animation.onfinish = () => {
            const midispiaceSrc = `${this.getAssetPrefix()}img/midispiace.png`;
            targetBox.innerHTML = '';
            const img = document.createElement('img');
            img.src = midispiaceSrc;
            img.alt = 'mi dispiace';
            img.style.maxWidth = '100%';
            img.style.maxHeight = '100%';
            img.style.objectFit = 'contain';
            targetBox.appendChild(img);
            targetBox.style.background = 'transparent';

            // Associa l'audio al box SILENT
            const sorrySound = `${this.getAssetPrefix()}Audio/Tastiere/tunoncanti.wav`;
            targetBox.dataset.sound = sorrySound;

            flyingClone.remove();
        };
    }

    async animateSymbolCorrect(clickedEl, targetIndex, clickedSymbol) {
        const targetBox = this.component.ipaAnswerArea.children[targetIndex];
        clickedEl.style.visibility = 'hidden';

        const flyingClone = clickedEl.cloneNode(true);
        flyingClone.style.visibility = 'visible';
        flyingClone.classList.add('flying-symbol');

        const gameArea = this.component.shadowRoot.querySelector('#game-area');
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

        const originalStyle = this.component.phonemeStyles.get(clickedSymbol);
        if (originalStyle && originalStyle.color) {
            flyingClone.style.color = originalStyle.color;
        }
        if (originalStyle && originalStyle.textShadow) {
            flyingClone.style.textShadow = originalStyle.textShadow;
        }
        
        gameArea.appendChild(flyingClone);
        
        let duration = 0.6; // Durata di default
        const soundPath = this.component.phonemeSounds.get(clickedSymbol);
        const fullSoundPath = soundPath ? `${this.getAssetPrefix()}${soundPath}` : null;
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
            // Crea uno span interno per coerenza con le lettere e per una stilizzazione robusta
            const landedSymbol = document.createElement('span');
            landedSymbol.className = 'main-text';
            if (clickedSymbol === 'ju:') {
                this.component.renderJuSymbol(landedSymbol);
            } else {
                landedSymbol.textContent = clickedSymbol;
            }

            // Forza la visibilità e la presenza del simbolo
            landedSymbol.style.visibility = 'visible';
            landedSymbol.style.opacity = '1';
            landedSymbol.style.display = 'flex';
            landedSymbol.style.alignItems = 'center';
            landedSymbol.style.justifyContent = 'center';

            if (originalStyle && originalStyle.color) {
                landedSymbol.style.color = originalStyle.color;
            }
            if (originalStyle && originalStyle.textShadow) {
                landedSymbol.style.textShadow = originalStyle.textShadow;
            }
            targetBox.innerHTML = '';
            targetBox.appendChild(landedSymbol);
            targetBox.style.background = 'none';
            targetBox.style.visibility = 'visible';
            targetBox.style.opacity = '1';
            targetBox.style.display = 'flex';
            targetBox.style.alignItems = 'center';
            targetBox.style.justifyContent = 'center';

            if (fullSoundPath) {
                targetBox.dataset.sound = fullSoundPath;
            }
            // Aggiunge attributo per il guard globale
            targetBox.setAttribute('data-symbol', clickedSymbol);

            flyingClone.remove();
            clickedEl.classList.add('hidden');
            clickedEl.style.visibility = '';

            this.component.nextIpaIndex++;
            // Salta gli spazi successivi
            while (this.component.nextIpaIndex < this.component.gameController.correctIpaSequence.length && this.component.gameController.correctIpaSequence[this.component.nextIpaIndex] === ' ') {
                this.component.nextIpaIndex++;
            }
            this.component.gameController.checkForWin();
        };
    }

    flyLetterToBox(sourceKey, letterIndex, durationInSeconds, soundPath, char = null) {
        const targetBox = this.component.wordArea.children[letterIndex];
        let animationContainer = document.getElementById('animation-container');
        if (!animationContainer) {
            animationContainer = document.createElement('div');
            animationContainer.id = 'animation-container';
            animationContainer.style.position = 'fixed';
            animationContainer.style.left = '0';
            animationContainer.style.top = '0';
            animationContainer.style.width = '100%';
            animationContainer.style.height = '100%';
            animationContainer.style.pointerEvents = 'none';
            animationContainer.style.zIndex = '100000';
            document.body.appendChild(animationContainer);
        }
        if (!targetBox) return;
        
        if (sourceKey && sourceKey.classList && sourceKey.classList.contains('dummy-key-voice')) {
            if (!char) char = sourceKey.textContent;
            sourceKey = null;
        }

        if (!sourceKey && !char && this.component.gameController.currentWord && this.component.gameController.currentWord[letterIndex]) {
            char = this.component.gameController.currentWord[letterIndex];
        }

        if (!sourceKey && !char) return;

        const prom = new Promise(resolve => {
            let flyingEl;
            let sourceRect;
            let computedStyle;
            let textContent;

            if (sourceKey) {
                let sourceLetter = (sourceKey.shadowRoot && sourceKey.shadowRoot.querySelector('.main-text')) || sourceKey.querySelector('.main-text');
                if (!sourceLetter) sourceLetter = sourceKey;
                
                flyingEl = sourceLetter.cloneNode(true);
                // FIX: Assicura che l'elemento volante sia visibile (es. se clonato da dummy key invisibile)
                flyingEl.style.opacity = '1';
                flyingEl.style.visibility = 'visible';
                sourceRect = sourceLetter.getBoundingClientRect();
                
                if (sourceRect.width === 0 && sourceRect.height === 0) {
                    sourceRect = {
                        left: window.innerWidth / 2 - 30,
                        top: window.innerHeight / 2 - 30,
                        width: 60,
                        height: 60
                    };
                }
                computedStyle = window.getComputedStyle(sourceLetter);
                textContent = sourceLetter.textContent;
            } else {
                flyingEl = document.createElement('span');
                flyingEl.className = 'main-text';
                textContent = char;
                flyingEl.textContent = char;
                
                const style = this.component.letterStyles.get(char.toUpperCase()) || {};
                computedStyle = {
                    fontFamily: style.fontFamily || 'sans-serif',
                    fontWeight: 'bold',
                    fontSize: '2.5em',
                    color: style.color || '#000',
                    textShadow: style.textShadow || 'none'
                };
                
                sourceRect = {
                    left: window.innerWidth / 2 - 30,
                    top: window.innerHeight / 2 - 30,
                    width: 60,
                    height: 60
                };
                flyingEl.style.transform = 'scale(0)';
            }

            let finalSoundPath = soundPath;
            let needsPrefix = false;
            if (!finalSoundPath && textContent) {
                const info = this.component.letterInfo.get(textContent.toUpperCase());
                if (info && info.sound) {
                    finalSoundPath = info.sound;
                    needsPrefix = true;
                }
            }

            const fullSoundPath = finalSoundPath ? (needsPrefix ? this.getAssetPrefix() + finalSoundPath : finalSoundPath) : null;

            const targetRect = targetBox.getBoundingClientRect();
            const targetBoxStyle = window.getComputedStyle(targetBox);

            flyingEl.style.fontFamily = computedStyle.fontFamily;
            flyingEl.style.fontWeight = computedStyle.fontWeight;
            flyingEl.style.fontSize = computedStyle.fontSize;
            flyingEl.style.display = 'flex';
            flyingEl.style.alignItems = 'center';
            flyingEl.style.justifyContent = 'center';
            flyingEl.style.color = computedStyle.color;
            flyingEl.style.textShadow = computedStyle.textShadow;
            const isSpace = textContent === ' ';
            const animDuration = this.component.isAutoSpelling ? (isSpace ? 0.4 : 1.2) : (durationInSeconds || 1.2);
            
            if (this.component.isAutoSpelling || !soundPath) {
                setTimeout(() => {
                    if ((this.component.isAutoSpelling || !soundPath) && textContent) {
                        this.component.visorManager.updateVisorFromExternalText('letter', textContent, null);
                        if (fullSoundPath) window.soundDispatcher.playSound(fullSoundPath);
                    }
                }, (animDuration - 0.3) * 1000);
            }

            AnimationUtils.flyElement(flyingEl, sourceRect, targetRect, animDuration, animationContainer, { fontSize: targetBoxStyle.fontSize })
                .then(() => {
                targetBox.innerHTML = '';
                const landedLetter = document.createElement('span');
                landedLetter.className = 'main-text';
                landedLetter.textContent = textContent;
                landedLetter.style.fontFamily = computedStyle.fontFamily;
                landedLetter.style.fontWeight = computedStyle.fontWeight;
                landedLetter.style.color = computedStyle.color;
                landedLetter.style.textShadow = computedStyle.textShadow;
                targetBox.appendChild(landedLetter);
                targetBox.style.background = 'transparent';

                if (fullSoundPath) {
                    targetBox.dataset.sound = fullSoundPath;
                }
                if (this.component.gameController.correctIpaSequence[letterIndex] === 'SILENT') {
                    landedLetter.style.opacity = '0.5';
                    const sorrySound = `${this.getAssetPrefix()}Audio/Tastiere/tunoncanti.wav`;
                    targetBox.dataset.sound = sorrySound;
                }
                flyingEl.remove();
                resolve();
            }, { once: true });
        });

        this._currentFlyPromise = prom;
        return prom;
    }

    resetPhraseCycle(clearUI = false) {
        try {
            if (this.activePhraseAudio) {
                this.activePhraseAudio.pause();
                this.activePhraseAudio.currentTime = 0;
            }
        } catch {}
        this.activePhraseAudio = null;

        if (this.translationTimeoutId) {
            clearTimeout(this.translationTimeoutId);
            this.translationTimeoutId = null;
        }
        if (this.phraseFadeOutTimeoutId) {
            clearTimeout(this.phraseFadeOutTimeoutId);
            this.phraseFadeOutTimeoutId = null;
        }
        if (this.clearPhraseTimeoutId) {
            clearTimeout(this.clearPhraseTimeoutId);
            this.clearPhraseTimeoutId = null;
        }

        if (voiceService) voiceService.cancelSpeech();

        if (clearUI) {
            this.component.phraseDisplayArea.innerHTML = '';
            delete this.component.phraseDisplayArea.dataset.sound;
            this.component.translationDisplayArea.innerHTML = '';
        }
    }

    async animateFullPhrase(phraseText, phraseSoundUrl, translationText, highlightWord = null) {
        this.lastAnimatePhraseArgs = { phraseText, phraseSoundUrl, translationText, highlightWord };
        this.component.phraseDisplayArea.style.cursor = 'pointer';
        this.component.phraseDisplayArea.style.pointerEvents = 'auto';
        this.component.stopSuggestions();
        this.resetPhraseCycle(false);
        if (this.clearPhraseTimeoutId) {
            clearTimeout(this.clearPhraseTimeoutId);
            this.clearPhraseTimeoutId = null;
        }

        this.component.phraseDisplayArea.innerHTML = '';
        delete this.component.phraseDisplayArea.dataset.sound;
        this.component.translationDisplayArea.innerHTML = '';
        this.component.phraseDisplayArea.style.textShadow = '';

        if (phraseSoundUrl) this.component.phraseDisplayArea.dataset.sound = phraseSoundUrl;

        const parts = phraseText.split(/(\s+)/);
        parts.forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) {
                Array.from(part).forEach(char => {
                    const span = document.createElement('span');
                    span.textContent = '\u00A0';
                    span.className = 'char-anim';
                    span.style.opacity = '0';
                    this.component.phraseDisplayArea.appendChild(span);
                });
            } else {
                const wordSpan = document.createElement('span');
                wordSpan.className = 'word-interactive';
                wordSpan.dataset.word = part;
                wordSpan.style.cursor = 'pointer';
                wordSpan.style.display = 'inline-block';
                wordSpan.style.whiteSpace = 'nowrap';
                wordSpan.style.opacity = '1';
                wordSpan.style.transition = 'none';
                
                if (highlightWord) {
                    // Pulizia più aggressiva per garantire il match (rimuove tutto tranne lettere/numeri)
                    const cleanPart = part.replace(/[^a-zA-Z0-9à-úÀ-Ú]/g, '').toLowerCase();
                    const cleanHighlight = highlightWord.replace(/[^a-zA-Z0-9à-úÀ-Ú]/g, '').toLowerCase();
                    if (cleanPart && cleanPart === cleanHighlight) {
                        wordSpan.classList.add('future-seed-pulse');
                    }
                }

                wordSpan.addEventListener('mouseenter', () => this.component.showPhoneticTooltip(wordSpan, part));
                wordSpan.addEventListener('mouseleave', () => this.component.hidePhoneticTooltip());
                
                Array.from(part).forEach(char => {
                    const span = document.createElement('span');
                    span.textContent = char;
                    span.className = 'char-anim';
                    span.style.opacity = '0';
                    span.style.display = 'inline-block';
                    
                    const charStyle = this.component.letterStyles.get((char || '').toUpperCase());
                    if (charStyle) {
                        span.style.color = charStyle.color || 'black';
                        span.style.textShadow = charStyle.textShadow || 'none';
                        if (charStyle.fontFamily) span.style.fontFamily = charStyle.fontFamily;
                        if (charStyle.fontSize) span.style.fontSize = charStyle.fontSize;
                    }
                    wordSpan.appendChild(span);
                });
                this.component.phraseDisplayArea.appendChild(wordSpan);
            }
        });
        
        const characters = this.component.phraseDisplayArea.querySelectorAll('.char-anim');

        const animateCharsTimer = (delayPerChar) => {
            const spans = this.component.phraseDisplayArea.querySelectorAll('.char-anim');
            spans.forEach((span, index) => {
                setTimeout(() => {
                    span.style.opacity = '1';
                    span.style.transform = 'scale(1)';
                }, index * delayPerChar);
            });
        };

        const animateCharsSyncToAudio = (audioEl) => {
            const spans = this.component.phraseDisplayArea.querySelectorAll('.char-anim');
            AnimationUtils.syncAnimationToAudio(audioEl, spans, () => {
                this.triggerSeedPulse();
                if (this.translationTimeoutId) clearTimeout(this.translationTimeoutId);
                this.translationTimeoutId = setTimeout(() => {
                    this.translationTimeoutId = null;
                    this.animateTranslation(translationText);
                }, 3000);
            });
        };

        let audio;
        let delayPerCharMs = 50;
        let started = false;

        if (phraseSoundUrl) {
            audio = new Audio();
            audio.preload = 'auto';
            audio.src = phraseSoundUrl;
            if (this.activePhraseAudio && !this.activePhraseAudio.ended) {
                try { this.activePhraseAudio.pause(); } catch {}
            }
            this.activePhraseAudio = audio;

            audio.addEventListener('loadedmetadata', () => {
                if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
                    delayPerCharMs = Math.max(20, (audio.duration * 1000) / Math.max(characters.length, 1));
                }
            }, { once: true });

            audio.addEventListener('play', () => {
                if (!started) {
                    started = true;
                    animateCharsSyncToAudio(audio);
                }
            }, { once: true });

            audio.addEventListener('error', (e) => {
                console.warn('Errore audio frase, uso fallback per animazione e traduzione:', e);
                setTimeout(() => this.triggerSeedPulse(), characters.length * delayPerCharMs);
                animateCharsTimer(delayPerCharMs);
                if (this.translationTimeoutId) clearTimeout(this.translationTimeoutId);
                this.translationTimeoutId = setTimeout(() => {
                    this.translationTimeoutId = null;
                    this.animateTranslation(translationText);
                }, characters.length * delayPerCharMs + 3000);
            }, { once: true });

            audio.play().catch(err => {
                console.warn('Impossibile riprodurre audio, avvio fallback:', err);
                setTimeout(() => this.triggerSeedPulse(), characters.length * delayPerCharMs);
                animateCharsTimer(delayPerCharMs);
                if (this.translationTimeoutId) clearTimeout(this.translationTimeoutId);
                this.translationTimeoutId = setTimeout(() => {
                    this.translationTimeoutId = null;
                    this.animateTranslation(translationText);
                }, characters.length * delayPerCharMs + 3000);
            });
        } else if (this.component.voiceCommandManager.isVoiceEnabled) {
            // Usa i default del VoiceCommandManager (rate 0.65) per una velocità normale
            const utterance = this.component.voiceCommandManager.speak(phraseText);
            
            if (utterance) {
                animateCharsTimer(delayPerCharMs);

                utterance.addEventListener('end', () => {
                    this.triggerSeedPulse();
                    if (this.translationTimeoutId) clearTimeout(this.translationTimeoutId);
                    this.translationTimeoutId = setTimeout(() => {
                        this.translationTimeoutId = null;
                        this.animateTranslation(translationText);
                    }, 1000);
                }, { once: true });
            } else {
                // Fallback se speak restituisce null
                setTimeout(() => this.triggerSeedPulse(), characters.length * delayPerCharMs);
                animateCharsTimer(delayPerCharMs);
                setTimeout(() => this.animateTranslation(translationText), characters.length * delayPerCharMs + 3000);
            }
        } else {
            animateCharsTimer(delayPerCharMs);
            const animationDuration = characters.length * delayPerCharMs;
            setTimeout(() => this.triggerSeedPulse(), animationDuration);
            setTimeout(() => this.animateTranslation(translationText), animationDuration + 3000);
        }
    }

    triggerSeedPulse() {
        const seeds = this.component.phraseDisplayArea.querySelectorAll('.future-seed-pulse');
        seeds.forEach(el => {
            el.classList.remove('future-seed-pulse');
            el.classList.add('seed-pulse-active');
        });
    }

    stopSeedPulse() {
        const seeds = this.component.phraseDisplayArea.querySelectorAll('.seed-pulse-active');
        seeds.forEach(el => {
            el.classList.remove('seed-pulse-active');
        });
    }

    showCupid() {
        const existing = this.component.phraseDisplayArea.querySelector('.cupid-indicator');
        if (existing) existing.remove();

        const cupid = document.createElement('div');
        cupid.className = 'cupid-indicator';
        cupid.textContent = '👼🏹';
        
        cupid.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleCupidClick();
        });
        
        this.component.phraseDisplayArea.prepend(cupid);
    }

    handleCupidClick() {
        // Distingue tra modalità Pratica e modalità Normale (Photo/Sound)
        if (photoGameManager.currentImageData && photoGameManager.currentImageData.isPracticeWord) {
            this.handlePracticeCupidClick();
        } else {
            this.handleStandardCupidClick();
        }
    }

    handlePracticeCupidClick() {
        // Modalità Pratica: Genera una NUOVA frase random
        if (this.component.runPerplexedPhraseSequence) {
            this.component.runPerplexedPhraseSequence();
        }
    }

    handleStandardCupidClick() {
        // Modalità Normale: Ripeti la frase corrente (collegata all'immagine/suono)
        if (this.lastAnimatePhraseArgs) {
            const { phraseText, phraseSoundUrl, translationText, highlightWord } = this.lastAnimatePhraseArgs;
            this.animateFullPhrase(phraseText, phraseSoundUrl, translationText, highlightWord);
        }
    }

    createFirework(x, y) {
        const container = document.getElementById('animation-container') || document.body;
        AnimationUtils.createFirework(x, y, container);
    }

    getTranslationForWord(word) {
        const cleanInput = word.replace(/[.,!?;:]/g, '').toLowerCase();
        if (!cleanInput) return null;
        
        const search = (phrases) => {
            for (const key in phrases) {
                const p = phrases[key];
                if (p.words) {
                    const w = p.words.find(x => {
                        if (!x.text) return false;
                        const cleanDict = x.text.replace(/[.,!?;:]/g, '').toLowerCase();
                        return cleanDict === cleanInput;
                    });
                    if (w && w.translation) return w.translation;
                }
            }
            return null;
        };
        return search(symbolPhrases) || search(letterPhrases);
    }

    async animateFloatingPhrase(phraseText, phraseSoundUrl, translationText, phraseWordsData = null) {
        if (this.floatingInProgress) return;
        this.floatingInProgress = true;
        this.component.stopSuggestions();
        this.resetPhraseCycle(true);
        try { this.component.phraseDisplayArea.classList.add('floating-mode'); } catch {}
        try {
            if (this._floatingGuardStyle) {
                this._floatingGuardStyle.remove();
                this._floatingGuardStyle = null;
            }
            const guard = document.createElement('style');
            guard.textContent = `
                #phrase-display-area.floating-mode { opacity: 1 !important; visibility: visible !important; filter: none !important; }
                #phrase-display-area.floating-mode .word-final, 
                #phrase-display-area.floating-mode .word-final, 
                #phrase-display-area.floating-mode .word-final * { 
                    opacity: 1 !important; 
                    visibility: visible !important; 
                    filter: none !important; 
                    transition: none !important; 
                    animation: none !important; 
                    display: inline-flex !important;
                }
            `;
            this.component.shadowRoot.appendChild(guard);
            this._floatingGuardStyle = guard;
        } catch {}

        const words = phraseText.trim().split(/\s+/).filter(Boolean);
        const wordPlaceholders = [];

        words.forEach((word, idx) => {
            const wordSpan = document.createElement('span');
            wordSpan.className = 'word-placeholder';
            wordSpan.style.display = 'inline-flex';
            wordSpan.style.alignItems = 'center';
            wordSpan.style.justifyContent = 'center';
            
            if (idx > 0) {
                const space = document.createElement('span');
                space.textContent = '\u00A0';
                space.style.display = 'inline-block';
                this.component.phraseDisplayArea.appendChild(space);
            }

            Array.from(word).forEach((ch) => {
                const chSpan = document.createElement('span');
                chSpan.textContent = ch;
                const st = this.component.letterStyles.get((ch || '').toUpperCase());
                if (st) {
                    chSpan.style.color = st.color || 'black';
                    chSpan.style.textShadow = st.textShadow || 'none';
                    if (st.fontFamily) chSpan.style.fontFamily = st.fontFamily;
                    if (st.fontSize) chSpan.style.fontSize = st.fontSize;
                }
                chSpan.style.display = 'inline-block';
                chSpan.style.opacity = '0';
                wordSpan.appendChild(chSpan);
            });

            this.component.phraseDisplayArea.appendChild(wordSpan);
            wordPlaceholders.push(wordSpan);
        });

        let animationContainer = document.getElementById('animation-container');
        if (!animationContainer) {
            animationContainer = document.createElement('div');
            animationContainer.id = 'animation-container';
            animationContainer.style.position = 'fixed';
            animationContainer.style.left = '0';
            animationContainer.style.top = '0';
            animationContainer.style.width = '100%';
            animationContainer.style.height = '100%';
            animationContainer.style.pointerEvents = 'none';
            animationContainer.style.zIndex = '9999';
            document.body.appendChild(animationContainer);
        }

        await new Promise(resolve => requestAnimationFrame(resolve));
        const targets = wordPlaceholders.map(ph => ph.getBoundingClientRect());

        const typyBtn = this.component.shadowRoot.querySelector('#typy-maestro-btn');
        let stagingCenterY = window.innerHeight / 2;
        let stagingLeftX = window.innerWidth * 0.28;
        
        const lookyBtn = this.component.shadowRoot.querySelector('#looky-maestro-btn');
        let lookyStagingX = window.innerWidth * 0.72;
        let lookyStagingY = window.innerHeight / 2;
        
        if (typyBtn) {
            const btnRect = typyBtn.getBoundingClientRect();
            stagingLeftX = btnRect.right + 40;
            stagingCenterY = btnRect.top + (btnRect.height / 2);
        }
        if (lookyBtn) {
            const btnRect = lookyBtn.getBoundingClientRect();
            lookyStagingX = btnRect.left - 40;
            lookyStagingY = btnRect.top + (btnRect.height / 2);
        }

        const processWordSequence = async (word, targetRect, placeholderEl) => {
            let ttsPromise = Promise.resolve();

            const flying = document.createElement('div');
            flying.style.position = 'fixed';
            flying.style.zIndex = '10000';
            flying.style.pointerEvents = 'none';
            flying.style.display = 'inline-flex';
            flying.style.alignItems = 'center';
            flying.style.justifyContent = 'center';
            
            const phraseArea = this.component.phraseDisplayArea;
            let landingFontSize = '2.5em';
            if (phraseArea) {
                const computed = window.getComputedStyle(phraseArea);
                landingFontSize = computed.fontSize || landingFontSize;
                flying.style.fontWeight = computed.fontWeight || 'bold';
            }
            flying.style.fontSize = landingFontSize;

            Array.from(word).forEach((ch) => {
                const chSpan = document.createElement('span');
                chSpan.textContent = ch;
                const st = this.component.letterStyles.get((ch || '').toUpperCase());
                if (st) {
                    chSpan.style.color = st.color || 'black';
                    chSpan.style.textShadow = st.textShadow || 'none';
                    if (st.fontFamily) chSpan.style.fontFamily = st.fontFamily;
                }
                chSpan.style.display = 'inline-block';
                chSpan.style.fontSize = landingFontSize;
                chSpan.style.transform = 'none';
                flying.appendChild(chSpan);
            });

            animationContainer.appendChild(flying);
            
            flying.style.width = 'auto';
            flying.style.height = 'auto';
            void flying.offsetWidth;
            const flyW = Math.max(flying.offsetWidth, targetRect.width, 40);
            const flyH = Math.max(flying.offsetHeight, targetRect.height, 40);
            flying.style.width = `${flyW}px`;
            flying.style.height = `${flyH}px`;

            const phoneticText = this.component.voiceCommandManager.getPhoneticForWord(word);
            let flyingPhonetic = null;
            if (phoneticText) {
                flyingPhonetic = document.createElement('div');
                
                const startSlash = document.createElement('span');
                startSlash.textContent = '/';
                startSlash.style.color = '#fff';
                flyingPhonetic.appendChild(startSlash);

                const symbols = phoneticService.parsePhoneticString(phoneticText);
                symbols.forEach(sym => {
                    const span = document.createElement('span');
                    if (sym === 'ju:') {
                        this.component.renderJuSymbol(span);
                    } else {
                        span.textContent = sym;
                        const style = this.component.phonemeStyles.get(sym);
                        if (style) {
                            if (style.color) span.style.color = style.color;
                            if (style.textShadow) span.style.textShadow = style.textShadow;
                        }
                    }
                    flyingPhonetic.appendChild(span);
                });

                const endSlash = document.createElement('span');
                endSlash.textContent = '/';
                endSlash.style.color = '#fff';
                flyingPhonetic.appendChild(endSlash);

                flyingPhonetic.style.position = 'fixed';
                flyingPhonetic.style.zIndex = '9999';
                flyingPhonetic.style.pointerEvents = 'none';
                flyingPhonetic.style.fontSize = landingFontSize;
                flyingPhonetic.style.fontWeight = 'bold';
                flyingPhonetic.style.color = '#444';
                flyingPhonetic.style.fontFamily = "'Times New Roman', serif";
                flyingPhonetic.style.backgroundColor = 'transparent';
                flyingPhonetic.style.padding = '6px 14px';
                animationContainer.appendChild(flyingPhonetic);
            }

            let translationWord = null;
            if (phraseWordsData) {
                const clean = word.replace(/[.,!?;:]/g, '');
                const wObj = phraseWordsData.find(w => w.text === word || w.text === clean);
                if (wObj) translationWord = wObj.translation;
            }
            if (!translationWord) {
                translationWord = this.getTranslationForWord(word);
            }
            let flyingTranslation = null;
            if (translationWord) {
                flyingTranslation = document.createElement('div');
                flyingTranslation.textContent = translationWord;
                flyingTranslation.style.position = 'fixed';
                flyingTranslation.style.zIndex = '9999';
                flyingTranslation.style.pointerEvents = 'none';
                const val = parseFloat(landingFontSize) || 40;
                const unit = landingFontSize.includes('em') ? 'em' : 'px';
                flyingTranslation.style.fontSize = `${val * 0.6}${unit}`;
                flyingTranslation.style.color = '#FFD700';
                flyingTranslation.style.textShadow = '1px 1px 2px black';
                flyingTranslation.style.fontFamily = 'var(--font-main)';
                animationContainer.appendChild(flyingTranslation);
            }

            const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
            const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
            const edges = ['top','bottom','left','right'];
            const edge = edges[Math.floor(Math.random()*edges.length)];
            let startX, startY;
            switch(edge) {
                case 'top': startX = Math.random() * (vw - flyW); startY = -flyH - 50; break;
                case 'bottom': startX = Math.random() * (vw - flyW); startY = vh + 50; break;
                case 'left': startX = -flyW - 50; startY = Math.random() * (vh - flyH); break;
                default: startX = vw + 50; startY = Math.random() * (vh - flyH); break;
            }
            flying.style.left = `${startX}px`;
            flying.style.top = `${startY}px`;
            
            if (flyingPhonetic) {
                flyingPhonetic.style.left = `${startX}px`;
                flyingPhonetic.style.top = `${startY}px`;
            }

            if (flyingTranslation) {
                const trW = flyingTranslation.offsetWidth;
                flyingTranslation.style.left = `${startX + (flyW - trW) / 2}px`;
                flyingTranslation.style.top = `${startY + flyH + 10}px`;
            }
            
            void flying.offsetWidth;

            const stagingTop = stagingCenterY - (flyH / 2);
            flying.style.transition = 'left 1s cubic-bezier(0.2, 0.8, 0.2, 1), top 1s cubic-bezier(0.2, 0.8, 0.2, 1)';
            flying.style.left = `${stagingLeftX}px`;
            flying.style.top = `${stagingTop}px`;

            if (flyingPhonetic) {
                const phH = flyingPhonetic.offsetHeight;
                const phW = flyingPhonetic.offsetWidth;
                const destX = lookyStagingX - (phW / 2);
                const destY = stagingCenterY - (phH / 2);

                setTimeout(() => {
                    const keyframes = [
                        { left: `${startX}px`, top: `${startY}px`, transform: 'rotate(0deg) scale(0.5)', opacity: 0, offset: 0 },
                        { left: `${startX + (destX - startX) * 0.2}px`, top: `${startY + (destY - startY) * 0.2}px`, transform: 'rotate(0deg) scale(1)', opacity: 1, offset: 0.1 },
                        { left: `${destX}px`, top: `${destY}px`, transform: 'rotate(0deg) scale(1.2)', offset: 0.98 },
                        { left: `${destX}px`, top: `${destY}px`, transform: 'rotate(0deg) scale(1)', offset: 1 }
                    ];

                    const anim = flyingPhonetic.animate(keyframes, {
                        duration: 1200,
                        easing: 'ease-in-out',
                        fill: 'forwards'
                    });

                    anim.onfinish = () => {
                        anim.cancel();
                        flyingPhonetic.style.left = `${destX}px`;
                        flyingPhonetic.style.top = `${destY}px`;
                        flyingPhonetic.style.transform = 'none';
                        this.createFirework(destX + phW / 2, destY + phH / 2);
                        setTimeout(() => this.createFirework(destX + phW / 2, destY + phH / 2), 300);
                    };
                }, 1000);
            }

            if (flyingTranslation) {
                const trW = flyingTranslation.offsetWidth;
                flyingTranslation.style.transition = 'left 1s cubic-bezier(0.2, 0.8, 0.2, 1), top 1s cubic-bezier(0.2, 0.8, 0.2, 1)';
                flyingTranslation.style.left = `${stagingLeftX + (flyW - trW) / 2}px`;
                flyingTranslation.style.top = `${stagingTop + flyH + 10}px`;
            }

            await new Promise(r => setTimeout(r, 1000));

            flying.style.pointerEvents = 'auto';
            flying.style.cursor = 'pointer';
            
            if (flyingPhonetic) {
                flyingPhonetic.style.pointerEvents = 'auto';
                flyingPhonetic.style.cursor = 'pointer';
            }

            const pulseAnim = flying.animate([
                { transform: 'scale(1)' },
                { transform: 'scale(1.15)' },
                { transform: 'scale(1)' }
            ], {
                duration: 1200,
                iterations: Infinity,
                easing: 'ease-in-out'
            });

            let pulseAnimPhonetic = null;
            if (flyingPhonetic) {
                pulseAnimPhonetic = flyingPhonetic.animate([
                    { transform: 'scale(1)' },
                    { transform: 'scale(1.1)' },
                    { transform: 'scale(1)' }
                ], {
                    duration: 1200,
                    iterations: Infinity,
                    easing: 'ease-in-out',
                    delay: 2000
                });
            }

            let pulseAnimTranslation = null;
            if (flyingTranslation) {
                pulseAnimTranslation = flyingTranslation.animate([
                    { transform: 'scale(1)' },
                    { transform: 'scale(1.1)' },
                    { transform: 'scale(1)' }
                ], {
                    duration: 1200,
                    iterations: Infinity,
                    easing: 'ease-in-out'
                });
            }

            await new Promise(resolve => {
                const playSound = () => {
                    if (this.component.voiceCommandManager.isVoiceEnabled && 'speechSynthesis' in window) {
                        const utterance = this.component.voiceCommandManager.speak(word);
                        if (utterance) {
                            ttsPromise = new Promise(r => { utterance.onend = r; utterance.onerror = r; setTimeout(r, 4000); });
                        } else {
                            ttsPromise = Promise.resolve();
                        }
                    } else {
                        const cleanWord = word.replace(/[.,!?;:]/g, '').toLowerCase();
                        const soundPath = `${this.getAssetPrefix()}Audio/simboparolasingola/${cleanWord}.wav`;
                        if (window.soundDispatcher) {
                            window.soundDispatcher.playSound(soundPath);
                        }
                    }
                };

                const continueHandler = (e) => {
                    if (e) e.stopPropagation();
                    playSound();

                    pulseAnim.cancel();
                    if (pulseAnimPhonetic) pulseAnimPhonetic.cancel();
                    if (pulseAnimTranslation) pulseAnimTranslation.cancel();
                    
                    flying.removeEventListener('click', continueHandler);
                    if (flyingPhonetic) flyingPhonetic.removeEventListener('click', continueHandler);
                    
                    resolve();
                };

                flying.addEventListener('click', continueHandler, { once: true });
                if (flyingPhonetic) {
                    flyingPhonetic.addEventListener('click', continueHandler, { once: true });
                }
            });

            flying.style.pointerEvents = 'none';
            flying.style.cursor = 'default';
            if (flyingPhonetic) {
                flyingPhonetic.style.pointerEvents = 'none';
                flyingPhonetic.style.cursor = 'default';
            }

            flying.style.transition = 'left 0.8s cubic-bezier(0.4, 0, 0.2, 1), top 0.8s cubic-bezier(0.4, 0, 0.2, 1), width 0.8s ease, height 0.8s ease';
            flying.style.left = `${targetRect.left}px`;
            flying.style.top = `${targetRect.top}px`;
            flying.style.width = `${targetRect.width}px`;
            flying.style.height = `${targetRect.height}px`;

            if (flyingPhonetic) {
                flyingPhonetic.style.transition = 'opacity 1.5s ease';
                flyingPhonetic.style.opacity = '0';
            }

            if (flyingTranslation) {
                flyingTranslation.style.transition = 'opacity 0.5s ease';
                flyingTranslation.style.opacity = '0';
            }

            await Promise.all([
                new Promise(r => setTimeout(r, 800)),
                ttsPromise
            ]);

            if (placeholderEl) {
                placeholderEl.className = 'word-final';
                Array.from(placeholderEl.children).forEach((chSpan) => {
                    chSpan.style.transition = 'none';
                    chSpan.style.setProperty('opacity', '1', 'important');
                    chSpan.style.transform = 'none';
                    chSpan.style.visibility = 'visible';
                    chSpan.style.filter = 'none';
                });
            }
            try { flying.remove(); } catch {}
            if (flyingPhonetic) {
                setTimeout(() => { try { flyingPhonetic.remove(); } catch {} }, 1000);
            }
            if (flyingTranslation) {
                setTimeout(() => { try { flyingTranslation.remove(); } catch {} }, 1000);
            }
        };

        for (let i = 0; i < words.length; i++) {
            await processWordSequence(words[i], targets[i], wordPlaceholders[i]);
        }

        const phraseRect = this.component.phraseDisplayArea.getBoundingClientRect();
        const btnY = phraseRect.top + (phraseRect.height / 2);

        const againBtn = document.createElement('button');
        againBtn.id = 'floating-again-btn';
        againBtn.textContent = 'Again ↻';
        againBtn.style.position = 'fixed';
        againBtn.style.left = `${lookyStagingX}px`;
        againBtn.style.top = `${btnY}px`; 
        againBtn.style.transform = 'translate(-50%, -50%)';
        againBtn.style.zIndex = '10005';
        againBtn.style.padding = '8px 20px';
        againBtn.style.fontSize = '1em';
        againBtn.style.fontWeight = 'bold';
        againBtn.style.color = '#fff';
        againBtn.style.background = 'linear-gradient(135deg, #ff00cc, #333399)';
        againBtn.style.border = '2px solid rgba(255,255,255,0.6)';
        againBtn.style.borderRadius = '50px';
        againBtn.style.boxShadow = '0 0 15px rgba(255, 0, 204, 0.5), 0 5px 10px rgba(0,0,0,0.3)';
        againBtn.style.cursor = 'pointer';
        againBtn.style.fontFamily = 'sans-serif';
        againBtn.style.textTransform = 'uppercase';
        againBtn.style.letterSpacing = '1px';
        againBtn.style.opacity = '0';
        
        document.body.appendChild(againBtn);

        const entryAnim = againBtn.animate([
            { opacity: 0, transform: 'translate(-50%, -50%) scale(0.5)' },
            { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' }
        ], { duration: 400, easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)', fill: 'forwards' });

        entryAnim.onfinish = () => {
            if (!againBtn.isConnected) return;
            againBtn.animate([
                { transform: 'translate(-50%, -50%) scale(1)', boxShadow: '0 0 15px rgba(255, 0, 204, 0.5), 0 5px 10px rgba(0,0,0,0.3)' },
                { transform: 'translate(-50%, -50%) scale(1.15)', boxShadow: '0 0 30px rgba(255, 0, 204, 0.9), 0 8px 15px rgba(0,0,0,0.4)' },
                { transform: 'translate(-50%, -50%) scale(1)', boxShadow: '0 0 15px rgba(255, 0, 204, 0.5), 0 5px 10px rgba(0,0,0,0.3)' }
            ], {
                duration: 1500,
                iterations: Infinity,
                easing: 'ease-in-out'
            });

            if (this._againArrow) this._againArrow.remove();
            const arrow = document.createElement('div');
            arrow.id = 'floating-again-arrow';
            arrow.innerHTML = '<span style="display:block; transform: rotate(90deg);">➳</span>';
            arrow.style.position = 'fixed';
            arrow.style.left = `${lookyStagingX}px`;
            arrow.style.top = `${btnY - 105}px`;
            arrow.style.transform = 'translateX(-50%)';
            arrow.style.fontSize = '4em';
            arrow.style.color = '#ff00cc';
            arrow.style.zIndex = '10006';
            arrow.style.pointerEvents = 'none';
            arrow.style.textShadow = '0 0 5px #fff, 0 0 10px #ff00cc';
            
            document.body.appendChild(arrow);
            this._againArrow = arrow;

            arrow.animate([
                { transform: 'translateX(-50%) translateY(0)' },
                { transform: 'translateX(-50%) translateY(-15px)' }
            ], {
                duration: 800,
                iterations: Infinity,
                direction: 'alternate',
                easing: 'ease-in-out'
            });
        };

        againBtn.onclick = (e) => {
            e.stopPropagation();
            againBtn.remove();
            if (this._againArrow) {
                this._againArrow.remove();
                this._againArrow = null;
            }
            
            this.component.phraseDisplayArea.innerHTML = '';
            this.floatingInProgress = false;
            try { if (this._floatingGuardStyle) { this._floatingGuardStyle.remove(); this._floatingGuardStyle = null; } } catch {}
            try { this.component.phraseDisplayArea.classList.remove('floating-mode'); } catch {}
            
            this.animateFloatingPhrase(phraseText, phraseSoundUrl, translationText, phraseWordsData);
        };

        setTimeout(() => {
            if (!document.body.contains(againBtn)) return;
            
            this.component.phraseDisplayArea.innerHTML = '';
            this.floatingInProgress = false;
            try { if (this._floatingGuardStyle) { this._floatingGuardStyle.remove(); this._floatingGuardStyle = null; } } catch {}
            try { this.component.phraseDisplayArea.classList.remove('floating-mode'); } catch {}
            
            this.animateFullPhrase(phraseText, phraseSoundUrl, translationText);
        }, 800);
    }

    animateTranslation(translationText) {
        if (!translationText) return;

        if (voiceService) voiceService.cancelSpeech();

        const characters = Array.from(translationText);
        const words = translationText.trim().split(/\s+/).filter(Boolean).length || 1;
        const revealRate = 0.8;
        const estimatedRevealSeconds = (words / (180 * revealRate)) * 60;
        let delayPerChar = Math.max(50, Math.round((estimatedRevealSeconds * 1000) / Math.max(characters.length, 1)));
        const revealCompleteMs = characters.length * delayPerChar;

        const wordToPulse = photoGameManager.currentImageData.translationWord;
        const startIndex = wordToPulse ? translationText.toLowerCase().indexOf(wordToPulse.toLowerCase()) : -1;
        const endIndex = startIndex !== -1 ? startIndex + wordToPulse.length : -1;

        let ttsEndedPromise = Promise.resolve();
        if (window.speechSynthesis && voiceService) {
            const utterance = voiceService.speak(translationText, {
                lang: 'it-IT',
                rate: 0.8
            });
            if (utterance) {
                ttsEndedPromise = new Promise(resolve => {
                    utterance.addEventListener('end', () => resolve(), { once: true });
                });
            }
        } else {
            console.warn("La sintesi vocale non è supportata da questo browser.");
        }

        characters.forEach((char, index) => {
            const span = document.createElement('span');
            span.textContent = char === ' ' ? '\u00A0' : char;

            const charStyle = this.component.letterStyles.get(char.toUpperCase());
            if (charStyle) {
                span.style.color = charStyle.color || 'white';
                span.style.textShadow = charStyle.textShadow || 'none';
                if (charStyle.fontFamily) {
                    span.style.fontFamily = charStyle.fontFamily;
                }
            } else {
                span.style.color = 'white';
            }

            if (startIndex !== -1 && index >= startIndex && index < endIndex) {
                span.classList.add('pulse-word');
            }

            this.component.translationDisplayArea.appendChild(span);

            setTimeout(() => {
                span.style.opacity = '1';
                span.style.transform = 'scale(1)';
            }, index * delayPerChar);
        });

        Promise.all([
            new Promise(resolve => setTimeout(resolve, revealCompleteMs)),
            ttsEndedPromise
        ]).then(() => {
            if (this.phraseFadeOutTimeoutId) {
                clearTimeout(this.phraseFadeOutTimeoutId);
            }
            this.phraseFadeOutTimeoutId = setTimeout(() => {
                this.stopSeedPulse();
                const translationSpans = this.component.translationDisplayArea.querySelectorAll('span');
                translationSpans.forEach(span => {
                    span.style.opacity = '0';
                    span.style.transform = 'none';
                });
                setTimeout(() => {
                    this.component.translationDisplayArea.innerHTML = '';
                }, 300);
                this.phraseFadeOutTimeoutId = null;

                this.component.activateSuggestions();
                this.showCupid();
            }, 4000);
        });
    }
}
