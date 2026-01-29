// manager/game/VoiceCommandManager.js
import { voiceService } from '../../services/VoiceService.js';
import { photoGameManager } from './PhotoGameManager.js';
import { phoneticService } from '../../services/PhoneticService.js';
import { symbolPhrases } from '../../data/symbolPhraseData.js';
import { letterPhrases } from '../../data/letterPhraseData.js';

export class VoiceCommandManager {
    constructor(component) {
        this.component = component;
        
        // Stati gestiti dal manager
        this.isReadyForVoiceCommands = false;
        this.isVoiceEnabled = false;
        this.isListening = false;
        this.isAlwaysListeningEnabled = false;
        this.recognitionLang = 'en-GB';
        this.ttsEnabled = false;
        this.keepFeedbackMode = false;
        this.commandModeActive = false;
        this.commandModeTimeout = null;
        this.isPracticeButtonActive = false;
        
        // Cache e utility
        this.phoneticCache = new Map();
        this.phoneticFetchPending = new Set();
        this._soundTimeout = null;
        this._lastFeedbackText = '';
        this._feedbackTimeout = null;
        this.currentUtterance = null;

        this.letterPronunciationMap = {
            'a': 'a', 'ay': 'a', 'hey': 'a', 'eh': 'a', 'ah': 'a',
            'b': 'b', 'bee': 'b', 'be': 'b',
            'c': 'c', 'see': 'c', 'sea': 'c', 'si': 'c',
            'd': 'd', 'dee': 'd', 'di': 'd',
            'e': 'e', 'ee': 'e', 'he': 'e',
            'f': 'f', 'ef': 'f', 'eff': 'f',
            'g': 'g', 'gee': 'g', 'jee': 'g', 'ji': 'g',
            'h': 'h', 'aitch': 'h', 'haitch': 'h', 'hate': 'h', 'eight': 'h',
            'i': 'i', 'eye': 'i', 'aye': 'i', 'hi': 'i',
            'j': 'j', 'jay': 'j',
            'k': 'k', 'kay': 'k', 'okay': 'k', 'cake': 'k', 'key': 'k', 'quay': 'k',
            'l': 'l', 'el': 'l', 'ell': 'l', 'hell': 'l',
            'm': 'm', 'em': 'm', 'am': 'm',
            'n': 'n', 'en': 'n', 'hen': 'n', 'end': 'n', 'an': 'n', 'and': 'n', 'in': 'n', 'un': 'n',
            'o': 'o', 'oh': 'o', 'owe': 'o',
            'p': 'p', 'pee': 'p', 'pea': 'p', 'pay': 'p',
            'q': 'q', 'cue': 'q', 'queue': 'q',
            'r': 'r', 'ar': 'r', 'are': 'r', 'our': 'r',
            's': 's', 'ess': 's', 'es': 's', 'yes': 's',
            't': 't', 'tee': 't', 'tea': 't',
            'u': 'u', 'you': 'u', 'ewe': 'u',
            'v': 'v', 'vee': 'v', 'we': 'v',
            'w': 'w', 'double u': 'w',
            'x': 'x', 'ex': 'x', 'ax': 'x',
            'y': 'y', 'why': 'y',
            'z': 'z', 'zee': 'z', 'zed': 'z'
        };
    }

    setupVoiceCommands() {
        if (!voiceService) {
            console.warn("VoiceService non disponibile. I comandi vocali sono disabilitati.");
            return;
        }

        const commands = ['listen', 'next', 'clear', 'close', 'chiudi', 'cutie', 'cody', 'q d', 'kew dee', 'klear', 'klia', 'claire', 'klaus', 'claus', 'clos', 'judy', 'klose', 'again', 'photo', 'foto', 'sound', 'double', 'sintesi', 'synthesis', 'pratica', 'practice', 'on', 'off', 'mic', 'mike', 'maik', 'microphone', 'michael', 'maicol', 'start', 'game', 'picture', 'pictur', 'piktur', 'pikchure', 'pikchur'];
        const letters = Object.keys(this.letterPronunciationMap);
        const grammar = '#JSGF V1.0; grammar commands; public <command> = ' + commands.concat(letters).join(' | ') + ' ;';
        
        voiceService.setGrammar(grammar);
        voiceService.setLanguage(this.recognitionLang);

        voiceService.onStartCallback = () => {
            this.updateVoiceIndicatorBasedOnState();
            console.log('Voice recognition started (Always Listening).');
        };

        voiceService.onSoundStartCallback = () => {
            if (this.isVoiceEnabled) {
                this.updateVoiceIndicator('active');
                if (this._soundTimeout) clearTimeout(this._soundTimeout);
                this._soundTimeout = setTimeout(() => {
                    const indicator = this.component.shadowRoot.querySelector('#voice-indicator');
                    if (indicator && indicator.classList.contains('active')) {
                        this.updateVoiceIndicator('visible');
                    }
                }, 3000);
            }
        };

        voiceService.onSoundEndCallback = () => {
            if (this._soundTimeout) clearTimeout(this._soundTimeout);
            this.updateVoiceIndicatorBasedOnState();
        };

        voiceService.onErrorCallback = (e) => {
            console.warn('Voice recognition error:', e.error);
            if (e.error !== 'no-speech' && e.error !== 'aborted') {
                this.flashVoiceIndicator('error');
            }
        };

        voiceService.onResultCallback = (event) => {
            let isFinal = false;
            let bestTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    isFinal = true;
                }
                bestTranscript += event.results[i][0].transcript;
            }
            
            bestTranscript = bestTranscript.trim();
            
            // Impedisci registrazione se il menu Thesaurus è aperto (liste visibili)
            const thesaurusOpen = this.component.shadowRoot.querySelector('.thesaurus-list');
            if (thesaurusOpen) {
                return;
            }

            if (bestTranscript) {
                this.showVoiceFeedback(bestTranscript);
            }

            if (isFinal) {
                let handled = false;
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        const result = event.results[i];
                        for (let j = 0; j < result.length; j++) {
                            const command = result[j].transcript.trim().toLowerCase();
                            
                            if (!this.isReadyForVoiceCommands) {
                                const isWakeUp = command.includes('sintesi on') || command.includes('synthesis on') || command.includes('mic on') || command.includes('mike on') || command.includes('maik') || command.includes('microphone on') || command.includes('michael') || command.includes('maicol') || command.includes('start game') ||
                                                 command.includes('clear') || command.includes('chiudi') || command.includes('close');
                                if (isWakeUp) {
                                    this.isReadyForVoiceCommands = true;
                                    console.log('Comandi vocali sbloccati da comando vocale di attivazione.');
                                } else {
                                    continue;
                                }
                            }
                            
                            let systemCommandHandled = false;
                            if (command.includes('sintesi off') || command.includes('synthesis off') || command.includes('mic off') || command.includes('mike off') || command.includes('microphone off')) {
                                this.setVoiceEnabled(false);
                                systemCommandHandled = true;
                            } else if (command.includes('sintesi on') || command.includes('synthesis on') || command.includes('sintesi un') || command.includes('mic on') || command.includes('mike on') || command.includes('maik') || command.includes('microphone on') || command.includes('michael') || command.includes('maicol')) {
                                this.setVoiceEnabled(true);
                                systemCommandHandled = true;
                            } else if (command.includes('pratica on') || command.includes('practice on')) {
                                this.setPracticeMode(true);
                                systemCommandHandled = true;
                            } else if (command.includes('pratica off') || command.includes('practice off')) {
                                this.setPracticeMode(false);
                                systemCommandHandled = true;
                            } else if (command === 'pratica' || command === 'practice') {
                                this.setPracticeMode(!this.isPracticeButtonActive);
                                systemCommandHandled = true;
                            }

                            if (systemCommandHandled) {
                                if (this.commandModeActive) this.deactivateCommandMode();
                                handled = true;
                                break;
                            }

                            if (command.includes('start game')) {
                                if (this.component.randomImageElement && this.component.randomImageElement.classList.contains('is-inactive')) {
                                    this.component._blockAutoStart = false;
                                    this.component.isPhotoGameActive = true;
                                    this.component.randomImageElement.classList.remove('is-inactive');
                                    if (typeof photoGameManager !== 'undefined') {
                                        photoGameManager.showNextImage();
                                    }
                                }
                                handled = true;
                            }

                            if (command.includes('sound')) {
                                this.handleVoiceSound();
                                handled = true;
                                break;
                            }
                            if (/(photo|foto|fotto|photto|photto|picture|pictur|piktur|pikchure|pikchur)/i.test(command)) {
                                this.handleVoicePhoto();
                                handled = true;
                                break;
                            }
                            if (command.includes('chiudi') || command.includes('close') || command.includes('clear') || command.includes('cutie') || command.includes('cody') || command.includes('q d') || command.includes('kew dee') || command.includes('klear') || command.includes('klia') || command.includes('claire') || command.includes('klaus') || command.includes('claus') || command.includes('clos') || command.includes('judy') || command.includes('klose')) {
                                this.handleVoiceClear();
                                handled = true;
                                break;
                            }

                            if (command.includes('listen') || command.endsWith('listen')) {
                                this.activateCommandMode();
                                const parts = command.split('listen');
                                if (parts.length > 1 && parts[1].trim().length > 0) {
                                } else {
                                    handled = true;
                                    break;
                                }
                            }

                            if (this.commandModeActive) {
                                let cmdHandled = false;
                                if (command.includes('chiudi') || command.includes('close') || command.includes('clear') || command.includes('cutie') || command.includes('cody') || command.includes('q d') || command.includes('kew dee') || command.includes('klear') || command.includes('klia') || command.includes('claire') || command.includes('klaus') || command.includes('claus') || command.includes('clos') || command.includes('judy') || command.includes('klose')) {
                                    this.handleVoiceClear();
                                    cmdHandled = true;
                                } else if (command.includes('next')) {
                                    this.handleVoiceNext();
                                    cmdHandled = true;
                                } else if (command.includes('again')) {
                                    this.handleVoiceAgain();
                                    cmdHandled = true;
                                }

                                if (cmdHandled) {
                                    this.deactivateCommandMode();
                                    handled = true;
                                    break;
                                }
                            }

                            if (!this.isVoiceEnabled) {
                                break; 
                            }
                            
                            if (command.includes('again')) {
                                if (this.handleVoiceAgain()) {
                                    handled = true;
                                    break;
                                }
                            }

                            if (this.component.gameController.isIpaComplete && command.includes('next')) {
                                this.handleVoiceNext();
                                handled = true;
                                break;
                            } else if (!this.component.gameController.isWordComplete) {
                                if (this.handleVoiceLetter(command)) {
                                    handled = true;
                                    break;
                                }
                            }
                        }
                        if (handled) break;
                    }
                }
                
                if (handled || (isFinal && this.ttsEnabled && bestTranscript)) {
                    if (this.ttsEnabled && bestTranscript && !handled) {
                        this.speak(bestTranscript);
                    }
                }

                if (handled) {
                    this.flashVoiceIndicator('success');
                } else {
                    if (this.isPracticeButtonActive) {
                        this.flashVoiceIndicator('success');
                    } else {
                        this.flashVoiceIndicator('error');
                    }
                }
            }
        };

        voiceService.onEndCallback = () => {
            this.updateVoiceIndicatorBasedOnState();
        };
    }

    toggleAlwaysListening() {
        this.isAlwaysListeningEnabled = !this.isAlwaysListeningEnabled;
        const light = this.component.shadowRoot.querySelector('#command-light');
        
        if (this.isAlwaysListeningEnabled) {
            if (light) light.classList.add('active');
            this.startVoiceListening();
        } else {
            if (light) light.classList.remove('active');
            this.stopVoiceListening();
        }
    }

    activateCommandMode() {
        this.commandModeActive = true;
        if (this.commandModeTimeout) clearTimeout(this.commandModeTimeout);
        this.commandModeTimeout = setTimeout(() => {
            this.deactivateCommandMode();
        }, 5000);
    }

    deactivateCommandMode() {
        this.commandModeActive = false;
        if (this.commandModeTimeout) clearTimeout(this.commandModeTimeout);
    }

    setVoiceEnabled(enable) {
        this.isVoiceEnabled = enable;
        const indicator = this.component.shadowRoot.querySelector('#voice-indicator');
        if (indicator) {
            indicator.classList.remove('recognized', 'error', 'disabled', 'active');
        }
        this.updateVoiceIndicatorBasedOnState();
        if (this.isVoiceEnabled) {
            this.flashVoiceIndicator('success');
            this.startVoiceListening();
        } else if (this.isPracticeButtonActive && indicator) {
            indicator.classList.add('pulse');
        }
    }

    setPracticeMode(active) {
        this.isPracticeButtonActive = active;
        const practiceIndicator = this.component.shadowRoot.querySelector('#practice-indicator');
        const voiceIndicator = this.component.shadowRoot.querySelector('#voice-indicator');
        
        const menuBtn = this.component.shadowRoot.querySelector('#menu-button');
        if (menuBtn) {
            menuBtn.style.display = active ? 'block' : 'none';
            if (!active && typeof this.component.closeThesaurusMenu === 'function') {
                this.component.closeThesaurusMenu();
            }
        }

        if (practiceIndicator) {
            if (active) {
                practiceIndicator.classList.remove('disabled');
            } else {
                practiceIndicator.classList.add('disabled');
            }
        }
        if (voiceIndicator) {
            if (active) {
                if (!this.isVoiceEnabled) {
                    voiceIndicator.classList.add('pulse');
                }
            } else {
                voiceIndicator.classList.remove('pulse');
            }
        }
    }

    toggleVoiceListening() {
        this.setVoiceEnabled(!this.isVoiceEnabled);
    }

    toggleRecognitionLanguage() {
        const langSelector = this.component.shadowRoot.querySelector('#lang-selector');
        const langSpan = langSelector ? langSelector.querySelector('span') : null;

        if (this.recognitionLang === 'en-GB') {
            this.recognitionLang = 'it-IT';
            if (langSpan) langSpan.textContent = 'IT';
            if (langSelector) {
                langSelector.classList.add('it-active');
            }
        } else {
            this.recognitionLang = 'en-GB';
            if (langSpan) langSpan.textContent = 'EN';
            if (langSelector) {
                langSelector.classList.remove('it-active');
            }
        }
        voiceService.setLanguage(this.recognitionLang);
    }

    toggleFeedbackMode() {
        this.keepFeedbackMode = !this.keepFeedbackMode;
        const selector = this.component.shadowRoot.querySelector('#feedback-mode-selector');
        const span = selector ? selector.querySelector('span') : null;
        
        if (this.keepFeedbackMode) {
            if (selector) selector.classList.add('keep-active');
            if (span) span.textContent = 'K';
        } else {
            if (selector) selector.classList.remove('keep-active');
            if (span) span.textContent = 'C';
        }
        
        const feedback = this.component.shadowRoot.querySelector('#voice-feedback');
        const currentText = (feedback && feedback.dataset.originalText) || this._lastFeedbackText || '';
        if (currentText) {
            this.showVoiceFeedback(currentText);
        }
    }

    toggleTtsMode() {
        this.ttsEnabled = !this.ttsEnabled;
        const selector = this.component.shadowRoot.querySelector('#tts-mode-selector');
        
        if (this.ttsEnabled) {
            if (selector) selector.classList.add('active');
            const feedback = this.component.shadowRoot.querySelector('#voice-feedback');
            if (feedback) {
                const text = (feedback.dataset.originalText || this._lastFeedbackText || '').trim();
                if (text) this.speak(text);
            }
        } else {
            if (selector) selector.classList.remove('active');
        }
    }

    startVoiceListening() {
        if (!this.isAlwaysListeningEnabled) return;
        if (!this.isListening && voiceService) {
            this.isListening = true;
            this.updateVoiceIndicatorBasedOnState();
            voiceService.start();
        }
    }

    stopVoiceListening() {
        this.isListening = false;
        if (voiceService) voiceService.stop();
        this.updateVoiceIndicatorBasedOnState();
    }

    updateVoiceIndicatorBasedOnState() {
        if (!this.isVoiceEnabled) {
            this.updateVoiceIndicator('disabled');
        } else {
            this.updateVoiceIndicator('visible');
        }
    }

    updateVoiceIndicator(state) {
        const indicator = this.component.shadowRoot.querySelector('#voice-indicator');
        if (!indicator) return;

        if (state !== 'disabled' && (indicator.classList.contains('recognized') || indicator.classList.contains('error'))) return;
        
        indicator.classList.remove('visible', 'active', 'recognized', 'processing', 'error', 'disabled');
        if (state === 'visible' || state === 'active') {
            indicator.classList.remove('pulse');
        }
        
        if (state !== 'hidden') indicator.classList.add('visible');
        
        if (state === 'active') indicator.classList.add('visible', 'active');
        if (state === 'disabled') indicator.classList.add('disabled');
    }

    flashVoiceIndicator(type = 'success') {
        const indicator = this.component.shadowRoot.querySelector('#voice-indicator');
        if (!indicator) return;
        indicator.classList.remove('active');
        
        const className = type === 'success' ? 'recognized' : 'error';
        indicator.classList.add(className);
        setTimeout(() => indicator.classList.remove(className), 800);
    }

    showVoiceFeedback(text) {
        const feedback = this.component.shadowRoot.querySelector('#voice-feedback');
        const translation = this.component.shadowRoot.querySelector('#voice-translation');
        if (!feedback) return;
        
        feedback.dataset.originalText = text;
        const cleanText = text.trim();
        if (this._lastFeedbackText !== cleanText) {
            this._lastFeedbackText = cleanText;
        }
        feedback.innerHTML = '';
        
        feedback.style.fontSize = '1.22em';
        feedback.style.fontWeight = 'bold';
        feedback.style.display = 'flex';
        feedback.style.gap = '2px';
        feedback.style.justifyContent = 'flex-start';
        feedback.style.zIndex = '100000';
        feedback.style.flexWrap = 'wrap';
        feedback.style.visibility = 'visible';
        feedback.style.left = '130px';
        feedback.style.transform = 'none';

        const words = text.trim().split(/\s+/);
        words.forEach(word => {
                const container = document.createElement('div');
                container.style.display = 'flex';
                container.style.flexDirection = 'column';
                container.style.alignItems = 'center';
                container.style.marginRight = '10px';
                container.style.marginBottom = '5px';

                const wordEl = document.createElement('div');
                Array.from(word).forEach(char => {
                    const span = document.createElement('span');
                    span.textContent = char;
                    span.style.textTransform = 'uppercase';
                    const style = this.component.letterStyles.get(char.toUpperCase());
                    if (style && /[a-zA-Z]/.test(char)) {
                        if (style.color) span.style.color = style.color;
                        if (style.textShadow) span.style.textShadow = style.textShadow;
                        if (style.fontFamily) span.style.fontFamily = style.fontFamily;
                    } else {
                        span.style.color = '#fff';
                        span.style.textShadow = '0 0 4px #000';
                    }
                    wordEl.appendChild(span);
                });
                container.appendChild(wordEl);

                if (this.keepFeedbackMode) {
                    container.style.cursor = 'pointer';
                    container.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.speak(word);
                        container.classList.add('feedback-word-pulse');
                    });
                    container.addEventListener('mouseleave', () => {
                        container.classList.remove('feedback-word-pulse');
                    });
                }

                if (this.recognitionLang === 'en-GB' && !this.isPracticeButtonActive) {
                    let phonetic = this.getLocalPhonetic(word);
                    const cleanKey = word.toLowerCase().replace(/[^a-z']/g, '');
                    if (!phonetic && this.phoneticCache.has(cleanKey)) {
                        phonetic = this.phoneticCache.get(cleanKey);
                    }

                    const phonEl = document.createElement('div');
                    phonEl.style.fontSize = '1.5em';
                    phonEl.style.fontFamily = "'Times New Roman', serif";
                    phonEl.style.marginTop = '2px';
                    phonEl.style.minHeight = '1em';

                    if (phonetic) {
                        this.renderPhoneticToElement(phonetic, phonEl);
                    } else {
                        this.fetchAndCachePhonetic(word, phonEl);
                    }
                    container.appendChild(phonEl);
                }

                feedback.appendChild(container);
            });

        if (this.isPracticeButtonActive || this.isVoiceEnabled || this.keepFeedbackMode) {
            feedback.style.pointerEvents = 'auto';
            if (this.isPracticeButtonActive && this.isVoiceEnabled) {
                feedback.style.cursor = 'pointer';
                feedback.title = "Clicca per avviare pratica";
            } else {
                feedback.style.cursor = 'default';
                feedback.removeAttribute('title');
            }
        } else {
            feedback.style.pointerEvents = 'none';
            feedback.style.cursor = 'default';
            feedback.removeAttribute('title');
        }

        feedback.classList.add('show');
        if (this.isPracticeButtonActive || this.keepFeedbackMode) {
            if (this._feedbackTimeout) clearTimeout(this._feedbackTimeout);
        } else {
            if (this._feedbackTimeout) clearTimeout(this._feedbackTimeout);
            this._feedbackTimeout = setTimeout(() => feedback.classList.remove('show'), 3000);
        }

        if (translation) {
            translation.classList.remove('show');
            translation.textContent = '';
        }
    }

    async handleVoiceNext() {
        console.log('Executing voice command: NEXT');
        const nextBtn = this.component.shadowRoot.querySelector('#next-button');
        if (nextBtn) {
            nextBtn.style.transform = 'scale(1.1)';
            setTimeout(() => nextBtn.style.transform = 'scale(1)', 200);
        }

        const floatingAgainBtn = document.getElementById('floating-again-btn');
        if (floatingAgainBtn) floatingAgainBtn.remove();
        const floatingAgainArrow = document.getElementById('floating-again-arrow');
        if (floatingAgainArrow) floatingAgainArrow.remove();
        if (this.component._againArrow) {
            this.component._againArrow.remove();
            this.component._againArrow = null;
        }

        this.stopVoiceListening();
        this.component.setMaestrosVisible(false);
        photoGameManager.showNextImage();
    }

    async handleVoiceClear() {
        console.log('Executing voice command: CHIUDI');
        const clearBtn = this.component.shadowRoot.querySelector('#clear-button');
        if (clearBtn) {
            clearBtn.style.transform = 'scale(1.1)';
            setTimeout(() => clearBtn.style.transform = 'scale(1)', 200);
            clearBtn.click();
        }
    }

    async handleVoiceAgain() {
        const againBtn = document.getElementById('floating-again-btn');
        if (againBtn) {
            console.log('Executing voice command: AGAIN');
            againBtn.click();
            return true;
        }
        return false;
    }

    async handleVoicePhoto() {
        const photoBtn = document.getElementById('gamePhotoButton');
        if (photoBtn) {
            console.log('Executing voice command: PHOTO');
            photoBtn.style.transform = 'scale(1.1)';
            setTimeout(() => photoBtn.style.transform = 'scale(1)', 200);
            photoBtn.click();
            return true;
        }
        return false;
    }

    async handleVoiceSound() {
        const soundBtn = document.getElementById('gameSoundButton');
        if (soundBtn) {
            console.log('Executing voice command: SOUND');
            soundBtn.style.transform = 'scale(1.1)';
            setTimeout(() => soundBtn.style.transform = 'scale(1)', 200);
            soundBtn.click();
            return true;
        }
        return false;
    }

    async handlePracticeWord(word) {
        if (!word || !this.component.allWordsData.length) return false;

        console.log(`[Practice Mode] Received word: "${word}"`);
        const wordData = this.component.allWordsData.find(d => d.text.toLowerCase() === word.toLowerCase());

        if (wordData) {
            console.log('[Practice Mode] Found word data:', wordData);
            this.component._blockAutoStart = false;
            this.flashVoiceIndicator('success');
            
            const imageData = {
                img: `${this.component.getAssetPrefix()}img/wordy.png`,
                wordSound: wordData.wordSound ? `${this.component.getAssetPrefix()}${wordData.wordSound}` : null,
                text: wordData.text,
                fullPhonetic: wordData.fullPhonetic,
                wordCharPhonetics: Array.isArray(wordData.wordCharPhonetics) ? wordData.wordCharPhonetics : null,
                silentIndexes: Array.isArray(wordData.silentIndexes) ? wordData.silentIndexes : null,
                isPracticeWord: true
            };

            if (photoGameManager && typeof photoGameManager.showImageData === 'function') {
                photoGameManager.showImageData(imageData);
            } else {
                this.component.startGame(imageData);
            }
            return true;
        } else {
            console.warn(`[Practice Mode] Word "${word}" not found in game data.`);
            this.showVoiceFeedback(`"${word}" not found`);
            this.flashVoiceIndicator('error');
            return false;
        }
    }

    async handleVoiceLetter(command) {
        let cleanCommand = command.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        cleanCommand = cleanCommand.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
        cleanCommand = cleanCommand.replace(/\b(lettera|letter|character|the letter|la|il|lo)\b/gi, "").replace(/l'/gi, "").trim();
        
        console.log(`Voice processing: "${command}" -> "${cleanCommand}"`);

        const words = cleanCommand.split(/\s+/);
        let foundAny = false;

        if (this.letterPronunciationMap[cleanCommand]) {
            return this.processFoundChar(this.letterPronunciationMap[cleanCommand]);
        } else {
            for (let i = 0; i < words.length; i++) {
                let char = null;
                if (i < words.length - 1) {
                    const twoWords = words[i] + ' ' + words[i+1];
                    if (this.letterPronunciationMap[twoWords]) {
                        char = this.letterPronunciationMap[twoWords];
                        i++;
                    }
                }
                if (!char) {
                    const w = words[i];
                    if (this.letterPronunciationMap[w]) {
                        char = this.letterPronunciationMap[w];
                    } else if (w.length === 1 && /[a-z]/i.test(w)) {
                        char = w.toLowerCase();
                    }
                }

                if (char) {
                    if (this.processFoundChar(char)) {
                        foundAny = true;
                        if (this.component._currentFlyPromise) await this.component._currentFlyPromise;
                        await new Promise(r => setTimeout(r, 100));
                    }
                }
            }
        }

        if (!foundAny) {
             const chars = cleanCommand.replace(/\s+/g, '').split('');
             for (const ch of chars) {
                 if (/[a-zA-Z]/.test(ch)) {
                     if (this.processFoundChar(ch)) {
                         foundAny = true;
                         if (this.component._currentFlyPromise) await this.component._currentFlyPromise;
                         await new Promise(r => setTimeout(r, 100));
                     }
                 }
             }
        }

        return foundAny;
    }

    processFoundChar(char) {
        const upperChar = char.toUpperCase();
        console.log(`Voice command interpreted as letter: ${upperChar}`);

        const letterInfo = this.component.letterInfo.get(upperChar);
        if ((!letterInfo || !letterInfo.sound) && upperChar !== ' ' && !this.component.isAutoSpelling) {
            console.error(`No sound info found for letter ${upperChar}`);
            return false;
        }

        let sourceKey = null;
        try {
            const keyboards = document.querySelectorAll('alphabet-keyboard, qwerty-keyboard, typewriter-keyboard');
            for (const kb of keyboards) {
                if (kb.shadowRoot) {
                    const key = kb.shadowRoot.querySelector(`letter-key[data-main-text="${upperChar}"]`);
                    if (key) {
                        sourceKey = key;
                        break;
                    }
                }
            }
        } catch (e) {}

        if (!sourceKey) {
            sourceKey = document.createElement('div');
            sourceKey.className = 'dummy-key-voice';
            sourceKey.textContent = upperChar;
            sourceKey.setAttribute('data-main-text', upperChar);
            sourceKey.setAttribute('data-letter', upperChar);
            
            sourceKey.style.opacity = '0';
            sourceKey.style.position = 'absolute';
            sourceKey.style.pointerEvents = 'none';
            this.component.shadowRoot.appendChild(sourceKey);
            
            setTimeout(() => { if (sourceKey.parentNode) sourceKey.remove(); }, 2000);
        }

        const detail = {
            char: upperChar,
            sound: null
        };
        const mockEvent = { detail, target: sourceKey };
        
        try {
            photoGameManager.handleLetterClick(mockEvent);
        } catch (e) {
            console.error("Error simulating click for voice letter:", e);
            return false;
        }
        return true;
    }

    speak(text, langOrOptions = 'en-GB', rate = 0.65, pitch = 1.4, volume = 1.0) {
        if (!voiceService) return null;

        let options = {};
        if (typeof langOrOptions === 'object') {
            options = langOrOptions;
        } else {
            options = {
                lang: langOrOptions,
                rate: rate,
                pitch: pitch,
                volume: volume
            };
        }

        const utterance = voiceService.speak(text, options);
        
        if (!utterance) return null;
        this.currentUtterance = utterance;

        const feedback = this.component.shadowRoot.querySelector('#voice-feedback');
        
        if (feedback && feedback.children.length > 0) {
            const wordContainers = Array.from(feedback.children);
            const spokenWordsCount = text.trim().split(/\s+/).length;
            
            if (spokenWordsCount === 1 && wordContainers.length > 1) {
                const wordIndex = wordContainers.findIndex(el => {
                    const spans = el.querySelectorAll('span');
                    const wordStr = Array.from(spans).map(s => s.textContent).join('');
                    return wordStr.toLowerCase() === text.trim().toLowerCase();
                });

                if (wordIndex !== -1) {
                    const el = wordContainers[wordIndex];
                    el.classList.add('feedback-word-pulse');
                    el.style.transform = 'scale(1.4)';
                    el.style.filter = 'drop-shadow(0 0 8px #ff9800)';
                    el.style.zIndex = '10';
                    
                    utterance.addEventListener('end', () => {
                        el.classList.remove('feedback-word-pulse');
                        el.style.transform = 'scale(1)';
                        el.style.filter = 'none';
                        el.style.zIndex = 'auto';
                    });
                }
            } 
            else {
                const boundaryHandler = (event) => {
                    if (event.name === 'word' || event.name === 'sentence') {
                        const charIndex = event.charIndex;
                        const textBefore = text.substring(0, charIndex);
                        const wordIndex = textBefore.trim().length === 0 ? 0 : textBefore.trim().split(/\s+/).length;
                        
                        wordContainers.forEach((el, idx) => {
                            if (idx === wordIndex) {
                                el.classList.add('feedback-word-pulse');
                                el.style.transform = 'scale(1.4)';
                                el.style.transition = 'transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
                                el.style.filter = 'drop-shadow(0 0 8px #ff9800)';
                                el.style.zIndex = '10';
                            } else {
                                el.classList.remove('feedback-word-pulse');
                                el.style.transform = 'scale(1)';
                                el.style.transition = 'transform 0.3s ease-out';
                                el.style.filter = 'none';
                                el.style.zIndex = 'auto';
                            }
                        });
                    }
                };

                utterance.addEventListener('boundary', boundaryHandler);

                const cleanupHighlight = () => {
                    wordContainers.forEach(el => {
                        el.classList.remove('feedback-word-pulse');
                        el.style.transform = 'scale(1)';
                        el.style.filter = 'none';
                        el.style.zIndex = 'auto';
                    });
                    utterance.removeEventListener('boundary', boundaryHandler);
                };
                utterance.addEventListener('end', cleanupHighlight);
                utterance.addEventListener('error', cleanupHighlight);
            }
        }
        return utterance;
    }

    getLocalPhonetic(word) {
        const clean = word.toLowerCase().replace(/[^a-z']/g, '');
        if (!clean) return '';
        
        if (this.component.allWordsData) {
            const wData = this.component.allWordsData.find(w => w.text.toLowerCase() === clean);
            if (wData && wData.fullPhonetic) return wData.fullPhonetic;
        }
        
        const ph = this.getPhoneticForWord(clean);
        if (ph) return ph;
        
        return '';
    }

    renderPhoneticToElement(phoneticString, container) {
        container.innerHTML = '';
        
        const slash1 = document.createElement('span');
        slash1.textContent = '/';
        slash1.style.color = '#ccc';
        container.appendChild(slash1);

        const symbols = phoneticService.parsePhoneticString(phoneticString);
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
                } else {
                    span.style.color = '#fff';
                }
            }
            container.appendChild(span);
        });

        const slash2 = document.createElement('span');
        slash2.textContent = '/';
        slash2.style.color = '#ccc';
        container.appendChild(slash2);
    }

    async fetchAndCachePhonetic(word, element) {
        const clean = word.toLowerCase().replace(/[^a-z']/g, '');
        if (!clean) return;
        
        if (this.phoneticFetchPending.has(clean)) return;
        this.phoneticFetchPending.add(clean);

        try {
            const phonetic = await phoneticService.getPhoneticsFromApi(clean);
            if (phonetic) {
                this.phoneticCache.set(clean, phonetic);
                if (element && element.isConnected) {
                    this.renderPhoneticToElement(phonetic, element);
                }
            } else {
                // Fallback: prova a usare api.dictionaryapi.dev direttamente per una trascrizione più accurata
                try {
                    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${clean}`);
                    if (response.ok) {
                        const data = await response.json();
                        // Cerca la prima fonetica disponibile
                        const ipa = data[0]?.phonetic || data[0]?.phonetics?.find(p => p.text)?.text;
                        if (ipa) {
                            // Rimuovi le barre se presenti, poiché renderPhoneticToElement le aggiunge
                            const cleanIpa = ipa.replace(/^\//, '').replace(/\/$/, '');
                            this.phoneticCache.set(clean, cleanIpa);
                            if (element && element.isConnected) {
                                this.renderPhoneticToElement(cleanIpa, element);
                            }
                        }
                    }
                } catch (err) { /* ignore fallback error */ }
            }
        } catch (e) { 
        } finally {
            this.phoneticFetchPending.delete(clean);
        }
    }

    getPhoneticForWord(word) {
        const clean = word.replace(/[.,!?;:]/g, '').toLowerCase();
        
        if (this.phoneticCache.has(clean)) return this.phoneticCache.get(clean);

        const search = (phrases) => {
            for (const key in phrases) {
                const p = phrases[key];
                if (p.words) {
                    const w = p.words.find(x => x.text.toLowerCase() === clean);
                    if (w && w.fullPhonetic) return w.fullPhonetic;
                }
            }
            return null;
        };
        return search(symbolPhrases) || search(letterPhrases);
    }

    async getPhonetic(word) {
        let ph = this.getPhoneticForWord(word);
        if (ph) return ph;

        const clean = word.replace(/[.,!?;:]/g, '').toLowerCase();
        try {
            ph = await phoneticService.getPhoneticsFromApi(clean);
            if (ph) {
                this.phoneticCache.set(clean, ph);
                return ph;
            }
        } catch (e) { }
        return null;
    }
}