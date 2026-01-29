// components/photo-game/photo-game-component.js

import { photoGameManager } from '../../manager/game/PhotoGameManager.js';
import { symbolPhrases } from '../../data/symbolPhraseData.js';
import { letterPhrases } from '../../data/letterPhraseData.js';
import { voiceService } from '../../services/VoiceService.js';
import { phoneticService } from '../../services/PhoneticService.js';
import { AnimationUtils } from '../../services/AnimationUtils.js';
import { GameTimer } from '../../services/GameTimer.js';
import { GameLogicService } from '../../services/GameLogicService.js';
import { gameDataService } from '../../services/GameDataService.js';
import { GameController } from '../../services/GameController.js';
import { VoiceCommandManager } from '../../manager/game/VoiceCommandManager.js';
import { VisorManager } from '../../manager/game/VisorManager.js';
import { AnimationManager } from '../../manager/game/AnimationManager.js';
import { UIManager } from '../../manager/game/UIManager.js';
import { PracticeManager } from '../../manager/game/PracticeManager.js';
import { ThesaurusManager } from '../../manager/game/ThesaurusManager.js';
import { phraseGeneratorService } from '../../services/PhraseGeneratorService.js';

class PhotoGameComponent extends HTMLElement {
            // Ricostruzione sincronizzata della frase + sintesi traduzione (modalità omino perplesso)
            async runPerplexedPhraseSequence() {
                this.stopSuggestions(); // Ferma frecce e pulsazioni

                // --- NUOVO: Gestione Frasi Random per Modalità Pratica ---
                if (photoGameManager.currentImageData && photoGameManager.currentImageData.isPracticeWord) {
                    const initialWord = this.gameController.currentWord;
                    
                    // Inizializzazione stato sessione pratica
                    if (!this._practiceState || this._practiceState.initialWord !== initialWord) {
                        this._practiceState = {
                            initialWord: initialWord,
                            totalGenerated: 0,
                            currentSeed: initialWord,
                            currentSeedCount: 0,
                            lastPhraseWords: []
                        };
                    }

                    let seedWord = this._practiceState.initialWord;

                    // Logica selezione seme: 5 frasi con parola iniziale, poi 3 con nuova parola
                    if (this._practiceState.totalGenerated < 5) {
                        seedWord = this._practiceState.initialWord;
                    } else {
                        // Se stiamo usando un nuovo seme e non abbiamo raggiunto quota 3, continua con quello
                        if (this._practiceState.currentSeed && 
                            this._practiceState.currentSeed !== this._practiceState.initialWord && 
                            this._practiceState.currentSeedCount < 3) {
                            seedWord = this._practiceState.currentSeed;
                        } else {
                            // Scegli un nuovo seme dalle parole della frase precedente
                            const candidates = this._practiceState.lastPhraseWords || [];
                            const validCandidates = candidates.filter(w => 
                                w.length > 2 && 
                                w.toLowerCase() !== (this._practiceState.currentSeed || '').toLowerCase()
                            );
                            
                            if (validCandidates.length > 0) {
                                seedWord = validCandidates[Math.floor(Math.random() * validCandidates.length)];
                            } else {
                                seedWord = this._practiceState.initialWord;
                            }

                            if (seedWord !== this._practiceState.currentSeed) {
                                this._practiceState.currentSeed = seedWord;
                                this._practiceState.currentSeedCount = 0;
                            }
                        }
                    }
                    
                    // Pulizia della parola seme (rimuove punteggiatura residua)
                    seedWord = seedWord.replace(/[^a-zA-Z0-9à-úÀ-Ú]/g, '').trim();

                    if (seedWord) {
                        // Imposta cursore di attesa mentre pesca dalla rete
                        document.body.style.cursor = 'wait';
                        const randomPhrase = await phraseGeneratorService.generateRandomPracticePhrase(seedWord, this._difficultyLevel, this.commonWordsSet);
                        document.body.style.cursor = 'default';
                        
                        // Memorizza le parole della nuova frase per il prossimo turno
                        if (randomPhrase && randomPhrase.text) {
                            this._practiceState.lastPhraseWords = randomPhrase.text.split(/\s+/).map(w => w.replace(/[^a-zA-Z0-9à-úÀ-Ú]/g, '').trim()).filter(w => w.length > 0);
                            this._practiceState.totalGenerated++;
                            if (seedWord === this._practiceState.currentSeed && seedWord !== this._practiceState.initialWord) {
                                this._practiceState.currentSeedCount++;
                            }
                        }

                        // FIX: Trova la parola esatta nel testo per l'animazione (gestione flessioni/case)
                        // Questo assicura che l'animazione funzioni anche se la parola generata è una variazione del seme
                        let wordToAnimate = seedWord;
                        if (randomPhrase && randomPhrase.text) {
                            const words = randomPhrase.text.split(/[^a-zA-Z0-9à-úÀ-Ú]+/);
                            const match = words.find(w => 
                                w.toLowerCase() === seedWord.toLowerCase() || 
                                w.toLowerCase().includes(seedWord.toLowerCase()) || 
                                (seedWord.toLowerCase().includes(w.toLowerCase()) && w.length > 2)
                            );
                            if (match) wordToAnimate = match;
                        }
                        
                        // Usa null per l'audio per forzare la sintesi vocale, passa la traduzione generata
                        this.animationManager.animateFullPhrase(randomPhrase.text, null, randomPhrase.translation, wordToAnimate, 'en-GB');
                        return;
                    }
                }
                // ---------------------------------------------------------
                
                let phraseText = null;
                let phraseSoundUrl = null;
                let translationText = null;

                // Tenta di recuperare i dati della frase dall'immagine corrente
                if (photoGameManager.currentImageData) {
                    phraseText = photoGameManager.currentImageData.fullPhraseText;
                    phraseSoundUrl = photoGameManager.currentImageData.fullPhraseSound;
                    translationText = photoGameManager.currentImageData.translation;
                }

                // Fallback: se mancano i dati della frase, cerca nei dataset (symbolPhrases/letterPhrases)
                if (!phraseText && this.gameController.currentWord) {
                    const cleanWord = this.gameController.currentWord.replace(/[.,!?;:]/g, '').toLowerCase();
                    const findPhrase = (phrases) => {
                        for (const key in phrases) {
                            const p = phrases[key];
                            if (p.words) {
                                const w = p.words.find(x => x.text.toLowerCase() === cleanWord);
                                if (w) return { 
                                    text: p.words.map(wx => wx.text).join(' '), 
                                    sound: p.fullPhraseSound ? `${this.getAssetPrefix()}${p.fullPhraseSound}` : null,
                                    translation: p.translation
                                };
                            }
                        }
                        return null;
                    };
                    const found = findPhrase(symbolPhrases) || findPhrase(letterPhrases);
                    if (found) {
                        phraseText = found.text;
                        phraseSoundUrl = found.sound;
                        translationText = found.translation;
                    }
                }

                // Verifica se il file audio esiste davvero
                if (phraseSoundUrl) {
                    try {
                        const response = await fetch(phraseSoundUrl, { method: 'HEAD' });
                        if (!response.ok) {
                            phraseSoundUrl = null; // Se non esiste, usa la sintesi
                        }
                    } catch (e) {
                        phraseSoundUrl = null; // Errore, usa la sintesi
                    }
                }

                if (phraseText) {
                    this.animationManager.animateFullPhrase(phraseText, phraseSoundUrl, translationText);
                } else if (this.gameController.currentWord) {
                    // Fallback estremo: se proprio non c'è frase, usa la parola stessa come "frase"
                    this.animationManager.animateFullPhrase(this.gameController.currentWord, null, translationText || '');
                }
            }

    playWhooshSound() {
        const soundPath = `${this.getAssetPrefix()}Audio/whoosh.mp3`;
        if (window.soundDispatcher) {
            window.soundDispatcher.playSound(soundPath);
        } else {
            new Audio(soundPath).play().catch(() => {});
        }
    }

    async updatePhoneticFeedback(word, container) {
        if (!container) return;
        container.innerHTML = '';
        container.classList.remove('show');
        container.style.transform = '';

        if (!word) return;

        let phonetic = null;
        const localData = this.allWordsData.find(w => w.text.toLowerCase() === word.toLowerCase());
        if (localData && localData.fullPhonetic) {
            phonetic = localData.fullPhonetic;
        } else {
            phonetic = await this.voiceCommandManager.getPhonetic(word);
        }

        if (phonetic) {
            const slash1 = document.createElement('span');
            slash1.textContent = '/';
            slash1.style.color = '#ccc';
            container.appendChild(slash1);

            const symbols = phoneticService.parsePhoneticString(phonetic);
            symbols.forEach(sym => {
                const span = document.createElement('span');
                if (sym === 'ju:') {
                    this.renderJuSymbol(span);
                } else {
                    span.textContent = sym;
                    const style = this.phonemeStyles.get(sym);
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

            container.classList.add('show');

            // Centra la trascrizione rispetto al testo del feedback
            const feedback = this.shadowRoot.querySelector('#voice-feedback');
            if (feedback) {
                setTimeout(() => {
                    const feedbackRect = feedback.getBoundingClientRect();
                    const containerRect = container.getBoundingClientRect();
                    if (feedbackRect.width > 0 && containerRect.width > 0) {
                        const shift = (feedbackRect.width - containerRect.width) / 2;
                        container.style.transform = `translateX(${shift}px)`;
                    }
                }, 0);
            }
        }
    }

    async startPracticeFromMenu(word) {
        this._blockAutoStart = false;
        
        console.log(`[startPracticeFromMenu] Searching for word: "${word}"`);
        // Pulisce la parola da punteggiatura e spazi per una ricerca più affidabile.
        const cleanWord = (word || '').replace(/[.,!?;:]/g, '').trim();
        console.log(`[startPracticeFromMenu] Cleaned word for lookup: "${cleanWord}"`);

        const wordData = this.allWordsData ? this.allWordsData.find(d => d.text.toLowerCase() === cleanWord.toLowerCase()) : null;
        
        let imageData;
        if (wordData) {
            console.log('[startPracticeFromMenu] Word found in local DB:', wordData);
             imageData = {
                img: `${this.getAssetPrefix()}img/wordy.png`, 
                wordSound: wordData.wordSound ? `${this.getAssetPrefix()}${wordData.wordSound}` : null,
                text: wordData.text,
                fullPhonetic: wordData.fullPhonetic,
                wordCharPhonetics: Array.isArray(wordData.wordCharPhonetics) ? wordData.wordCharPhonetics : null,
                silentIndexes: Array.isArray(wordData.silentIndexes) ? wordData.silentIndexes : null,
                isPracticeWord: true
            };
        } else {
            console.warn(`[startPracticeFromMenu] Word "${cleanWord}" not found in local DB. Using API fallback.`);
            // Parola nuova (non nel DB locale)
            let fetchedPhonetic = null;
            try {
                fetchedPhonetic = await phoneticService.getPhoneticsFromApi(cleanWord);
            } catch(e) { console.warn("Phonetic fetch failed", e); }

            imageData = {
                img: `${this.getAssetPrefix()}img/wordy.png`,
                wordSound: null,
                text: cleanWord,
                fullPhonetic: fetchedPhonetic,
                wordCharPhonetics: null,
                silentIndexes: [],
                isPracticeWord: true
            };
        }
        // Forza lingua UK per la pratica
        if (this.voiceCommandManager) this.voiceCommandManager.recognitionLang = 'en-GB';

        if (photoGameManager && typeof photoGameManager.showImageData === 'function') {
            photoGameManager.showImageData(imageData);
        } else {
            if (photoGameManager) photoGameManager.currentImageData = imageData;
            this.startGame(imageData);
        }

        // Mantiene il bottone visibile e verde durante la pratica
        const btn = this.shadowRoot.querySelector('#menu-button');
        if (btn) {
            btn.style.display = 'block';
            btn.classList.add('active');
            const diffSelector = this.shadowRoot.querySelector('#difficulty-selector');
            if (diffSelector) diffSelector.style.display = 'flex';
        }
    }

            // Utility: sintesi vocale async
            speakAsync(text, lang = 'en-GB') {
                return new Promise(resolve => {
                    if (voiceService) {
                        voiceService.speak(text, {
                            lang: lang,
                            onEnd: resolve,
                            onError: resolve
                        });
                    } else {
                        resolve();
                    }
                });
            }
    constructor() {
        super();
        // Flag per abilitare i comandi vocali solo dopo la prima interazione
        this._perplexedModeActive = false; // Flag per la modalità omino perplesso
        this.letterStyles = new Map(); // Conterrà gli stili per ogni lettera
        this.allPhonemes = []; // Conterrà tutti i fonemi caricati da JSON
        this.phonemeStyles = new Map(); // Conterrà gli stili (es. colori) per ogni fonema
        this.phonemeSounds = new Map(); // Conterrà i suoni per ogni fonema
        this.phonemeInfo = new Map(); // Info per simboli: img, parola, suoni
        this.letterInfo = new Map(); // Info per lettere: img, parola, suoni
        this.clearPhraseTimeoutId = null; // ID per il timeout che pulisce la frase
        this.commonWordsSet = new Set(); // Sostituisce l'import di commonWords.js
        this.allWordsData = []; // Contiene tutti i dati delle parole per la modalità pratica
        this._difficultyLevel = 'elementary'; // Livello di default
        this._practiceState = null; // Stato sessione pratica (seme corrente, contatori)
        this.isDictationActive = false; // Stato modalità dettatura
        this.dictationContent = ''; // Contenuto accumulato della dettatura
        this._lastObservedDictationText = null; // Usato per gestire le pause nella dettatura
        this._lastDictationEventTime = 0; // Timestamp per rilevare pause lunghe nella dettatura
        this._capitalizeNextDictationWord = true; // Flag per capitalizzare la parola successiva nella dettatura
        this._dictationHistory = []; // Storia per undo
        this._lastFinalDictationTime = 0; // Per prevenzione duplicati
        this._lastFinalDictationText = ''; // Per prevenzione duplicati
        this.gameTimer = new GameTimer({
            onTick: () => this.updateTimerDisplay(),
            onEnd: () => this.handleTimeUp()
        });
        // Variabili legacy rimosse o mappate al timer: timerId, timeLeft, selectedDuration
        
        // Inizializza il GameController
        this.gameController = new GameController(this);

        this.attachShadow({ mode: 'open' });
        // Stato per gestione robusta del ciclo frasi a fine gioco
        this.practiceEnabled = false; // Modalità pratica abilitata solo a fine turno
        this.practiceEnabledAt = 0; // Timestamp di attivazione pratica
        // Modalità Sound-Game
        this.soundGameMode = false;
        this.isPhotoGameActive = false; // Inizializza a false per evitare avvii automatici
        // Stato attivo per bottone SOUND (ON/OFF)
        this.isSoundGameActive = false;
        // Modalità selezione dopo CLEAR: abilita avvio rapido cliccando su lettere/simboli
        this.selectionEnabled = false;
        this._blockAutoStart = true; // Blocca avvii automatici non richiesti (es. al reload)
        this.selectionGlobalClickHandler = null;
        this._lastRightClickTime = 0; // Timestamp per throttle tasto destro
        
        // Inizializza il VoiceCommandManager
        this.voiceCommandManager = new VoiceCommandManager(this);
        // Abilita il riconoscimento di input brevi (es. fonemi singoli o doppi) come per lo spelling
        this.voiceCommandManager.allowShortInputs = true;
        this.visorManager = new VisorManager(this);
        this.animationManager = new AnimationManager(this);
        this.uiManager = new UIManager(this);
        this.practiceManager = new PracticeManager(this);
        this.thesaurusManager = new ThesaurusManager(this);

        // Avvia l'ascolto (Always Listening) ma con Mike spento (Hard Reset)
        // this.setVoiceEnabled(true); // Rimosso per garantire hard reset
        this.voiceCommandManager.startVoiceListening();
        this.shadowRoot.innerHTML = `
            <style>
                /* Stile di fallback per garantire visibilità */
                #reconstruction-areas, #error-counters {
                    display: flex !important;
                }
            </style>
            <style>
                :host {
                    display: block;
                    font-family: sans-serif;
                    height: 100%;
                    width: 100%;
                }
                #photo-game-block {
                    position: relative;
                    border-radius: 10px;                    
                    max-width: 100%;
                    height: 100%; /* Occupa tutto lo spazio del suo contenitore */
                    margin: 0 auto;
                    background-color: transparent;
                    background-image: linear-gradient(rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.1)), url('${this.getAssetPrefix()}img/valle.jpg');
                    background-size: 100% 100%;
                    background-repeat: no-repeat;
                    background-position: top center;
                }
                #game-area {
                    position: relative; /* Necessario per posizionare i cloni animati */
                    display: flex;
                    flex-direction: column;
                    gap: 1%;
                    height: 100%;
                    padding-bottom: 4.6%; /* Aggiunge spazio in basso per i contatori */
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
                    font-size: 2.5em;
                    background-color: #fff;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                }
                h2 {
                    text-align: center;
                    color: #333;
                }
                /* Stile per l'indicatore vocale (Microfono) */
                /* Stile per l'indicatore vocale (Microfono 2 - MIKE) */
                #voice-indicator {
                    /* Assicura che l'etichetta esterna non venga tagliata */
                    overflow: visible;
                    position: absolute;
                    top: 15px;
                    left: 15px;
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    background-color: rgba(0, 0, 0, 0.4);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    opacity: 1;
                    transition: opacity 0.3s, background-color 0.2s, transform 0.2s, box-shadow 0.2s;
                    pointer-events: auto;
                    cursor: pointer;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                }
                #voice-indicator::after {
                    content: 'MIKE\\AOFF';
                    position: absolute;
                    bottom: -30px;
                    left: 50%;
                    transform: translateX(-50%);
                    font-size: 10px;
                    line-height: 1.2;
                    text-align: center;
                    color: white;
                    font-weight: bold;
                    text-shadow: 1px 1px 2px black;
                    pointer-events: none;
                    white-space: pre;
                    transition: all 0.3s;
                }
                /* Stile etichetta quando attivo (non disabled) - Sfondo Verde */
                #voice-indicator:not(.disabled)::after {
                    content: 'MIKE\\AON';
                    background-color: #00c853;
                    color: white;
                    padding: 2px 6px;
                    border-radius: 8px;
                    text-shadow: none;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
                /* Stato ON di base: sfondo verde per il pulsante */
                #voice-indicator:not(.disabled) {
                    background-color: #00c853; /* Verde quando ON */
                }

                #voice-indicator.visible {
                    opacity: 1;
                }
                #voice-indicator.active {
                    background-color: rgba(255, 0, 204, 0.8);
                    border-color: #fff;
                    box-shadow: 0 0 15px #ff00cc;
                    transform: scale(1.15);
                }
                #voice-indicator.processing {
                    background-color: #ffcc00;
                    box-shadow: 0 0 15px #ffcc00;
                    transform: scale(1.1);
                }
                #voice-indicator.recognized {
                    background-color: #00ff00;
                    box-shadow: 0 0 20px #00ff00;
                    transform: scale(1.2);
                }
                #voice-indicator.error {
                    background-color: #ff0000;
                    box-shadow: 0 0 20px #ff0000;
                    transform: scale(1.2);
                }
                #voice-indicator.disabled {
                    background-color: #ff0000; /* Rosso solido quando OFF */
                    border-color: rgba(255, 255, 255, 0.5);
                }
                #voice-indicator.pulse {
                    animation: pulse-red-glow 1.2s infinite alternate;
                    box-shadow: 0 0 0 0 #ff0033, 0 0 20px 8px #ff0033;
                }

                @keyframes pulse-red-glow {
                    0% {
                        box-shadow: 0 0 0 0 #ff0033, 0 0 20px 8px #ff0033;
                        background-color: #ff0033;
                    }
                    50% {
                        box-shadow: 0 0 30px 15px #ff0033, 0 0 40px 16px #ff0033;
                        background-color: #ff3366;
                    }
                    100% {
                        box-shadow: 0 0 0 0 #ff0033, 0 0 20px 8px #ff0033;
                        background-color: #ff0033;
                    }
                }
                #voice-indicator svg {
                    width: 24px;
                    height: 24px;
                    fill: rgba(255, 255, 255, 0.8);
                    transition: fill 0.3s;
                }
                #voice-indicator.active svg {
                    fill: #fff;
                }
                /* Pulsazione MIKE in modalità PRATICA */
                #voice-indicator.pulse {
                    animation: pulse-opacity 1.5s infinite ease-in-out;
                }
                /* Luce di stato per i comandi vocali (sopra il microfono) */
                /* Luce di stato (Green Light) - Sempre accesa e sopra Mic 2 */
                #command-light {
                    position: absolute;
                    top: 30px; /* Centrato verticalmente rispetto ai bottoni */
                    left: 95px; /* Centrato orizzontalmente al posto del mic always on */
                    width: 14px; /* Ingrandito leggermente */
                    height: 14px;
                    border-radius: 50%;
                    background-color: #ff0000; /* Default RED (OFF) */
                    z-index: 10001;
                    box-shadow: 0 0 8px #ff0000, 0 0 15px #ff0000; /* Red glow */
                    transition: background-color 0.3s, box-shadow 0.3s;
                    pointer-events: auto; /* Clickable */
                    cursor: pointer;
                }
                #command-light.active {
                    background-color: #00ff00; /* Green (ON) */
                    box-shadow: 0 0 8px #00ff00, 0 0 15px #00ff00;
                }
                
                /* Nuovo Microfono 1 (Always Listening) */
                #mic-always-on {
                    overflow: visible;
                    position: absolute;
                    top: 15px;
                    left: 80px; /* Posizionato a destra di Mic 2 */
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    background-color: rgba(0, 0, 0, 0.4);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    pointer-events: none; /* Solo visuale/indicatore */
                    display: none; /* Nascosto come richiesto */
                }
                #mic-always-on svg {
                    width: 24px;
                    height: 24px;
                    fill: rgba(255, 255, 255, 0.9);
                }
                #mic-always-on::after {
                    content: 'ALWAYS\\ALISTEN';
                    position: absolute;
                    bottom: -30px;
                    left: 50%;
                    transform: translateX(-50%);
                    font-size: 10px;
                    line-height: 1.2;
                    text-align: center;
                    color: white;
                    font-weight: bold;
                    text-shadow: 1px 1px 2px black;
                    pointer-events: none;
                    white-space: pre;
                }

                /* Stile per il bottone Pratica (P) */
                #practice-indicator {
                    overflow: visible;
                    position: absolute;
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    background-color: rgba(0, 0, 0, 0.4);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    opacity: 1;
                    transition: opacity 0.3s, background-color 0.2s, transform 0.2s, box-shadow 0.2s;
                    pointer-events: auto;
                    cursor: pointer;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    color: white;
                    font-weight: bold;
                    font-size: 1.5em;
                    font-family: sans-serif;
                }
                #practice-indicator:not(.disabled) {
                    background-color: #00c853; /* Verde quando ON */
                }
                #practice-indicator::after {
                    content: 'PRATICA\\AOFF';
                    position: absolute;
                    bottom: -30px;
                    left: 50%;
                    transform: translateX(-50%);
                    font-size: 10px;
                    line-height: 1.2;
                    text-align: center;
                    color: white;
                    font-weight: bold;
                    text-shadow: 1px 1px 2px black;
                    pointer-events: none;
                    white-space: pre;
                    transition: all 0.3s;
                }
                #practice-indicator.disabled {
                    background-color: #ff0000; /* Rosso solido quando OFF */
                    border-color: rgba(255, 255, 255, 0.5);
                }
                #practice-indicator:not(.disabled)::after {
                    content: 'PRATICA\\AON';
                    background-color: #00c853;
                    color: white;
                    padding: 2px 6px;
                    border-radius: 8px;
                    text-shadow: none;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }

                /* Stile per il contenitore della dettatura */
                #dictation-box {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 80%;
                    max-width: 800px;
                    height: 70%;
                    background-color: rgba(0, 0, 0, 0.4);
                    backdrop-filter: blur(4px);
                    color: white;
                    text-shadow: 0 2px 4px rgba(0,0,0,0.5);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    border-radius: 12px;
                    padding: 0;
                    z-index: 9000; /* Sotto i bottoni, sopra il resto */
                    display: none; /* Nascosto di default */
                    box-shadow: 0 8px 25px rgba(0,0,0,0.2);
                    font-family: 'Segoe UI', 'Roboto', sans-serif;
                    flex-direction: column;
                }
                #dictation-text {
                    flex: 1;
                    padding: 25px;
                    padding-bottom: 60px;
                    overflow-y: auto;
                    white-space: pre-wrap;
                    overflow-wrap: break-word;
                    font-size: 1.4em;
                    line-height: 1.6;
                }
                #dictation-controls {
                    position: absolute;
                    bottom: 15px;
                    right: 25px;
                    display: flex;
                    gap: 10px;
                    z-index: 9002;
                }
                .dictation-btn {
                    background-color: rgba(0, 0, 0, 0.5);
                    border: 1px solid rgba(255, 255, 255, 0.4);
                    color: white;
                    padding: 8px 16px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 0.9rem;
                    transition: all 0.2s;
                    backdrop-filter: blur(2px);
                }
                .dictation-btn:hover {
                    background-color: rgba(255, 255, 255, 0.2);
                    transform: scale(1.05);
                }
                .dictation-btn:active {
                    transform: scale(0.95);
                }

                /* Stile per il bottone Dettatura (D) */
                #dictation-indicator {
                    overflow: visible;
                    position: absolute;
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    background-color: rgba(0, 0, 0, 0.4);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    opacity: 1;
                    transition: opacity 0.3s, background-color 0.2s, transform 0.2s, box-shadow 0.2s;
                    pointer-events: auto;
                    cursor: pointer;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    color: white;
                    font-weight: bold;
                    font-size: 1.5em;
                    font-family: sans-serif;
                }
                #dictation-indicator:not(.disabled) {
                    background-color: #00c853; /* Verde quando ON */
                }
                #dictation-indicator::after {
                    content: 'DETTATURA\\AOFF';
                    position: absolute;
                    bottom: -30px;
                    left: 50%;
                    transform: translateX(-50%);
                    font-size: 10px;
                    line-height: 1.2;
                    text-align: center;
                    color: white;
                    font-weight: bold;
                    text-shadow: 1px 1px 2px black;
                    pointer-events: none;
                    white-space: pre;
                    transition: all 0.3s;
                }
                #dictation-indicator.disabled {
                    background-color: #ff0000; /* Rosso solido quando OFF */
                    border-color: rgba(255, 255, 255, 0.5);
                }
                #dictation-indicator:not(.disabled)::after {
                    content: 'DETTATURA\\AON';
                    background-color: #00c853;
                    color: white;
                    padding: 2px 6px;
                    border-radius: 8px;
                    text-shadow: none;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }

                /* Stile per il selettore lingua */
                #lang-selector {
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    background-color: #1a237e; /* Blu scuro per EN */
                    border: 1px solid rgba(255, 255, 255, 0.4);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    color: white;
                    font-size: 10px;
                    font-weight: bold;
                    transition: transform 0.2s, background-color 0.2s;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                }
                #lang-selector:hover {
                    transform: scale(1.1);
                }
                #lang-selector.it-active {
                    background-color: #008f39; /* Verde per IT */
                }
                
                /* Stile per il selettore Keep/Clear */
                #feedback-mode-selector {
                    position: absolute;
                    top: 55px; /* Sotto la luce verde */
                    left: 87px; /* Allineato con il selettore lingua */
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    background-color: #444; /* Default scuro per Clear */
                    border: 1px solid rgba(255, 255, 255, 0.4);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    color: white;
                    font-size: 12px;
                    font-weight: bold;
                    z-index: 10000;
                    transition: transform 0.2s, background-color 0.2s;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                }
                #feedback-mode-selector:hover {
                    transform: scale(1.1);
                }
                #feedback-mode-selector.keep-active {
                    background-color: #ff9800; /* Arancione per Keep */
                }
                .feedback-word-pulse {
                    animation: pulse-opacity 1s infinite;
                    color: #ff9800 !important;
                    text-shadow: 0 0 8px #ff9800 !important;
                }
                /* Forza lo stile su tutti i discendenti per vincere gli stili inline durante il TTS */
                .feedback-word-pulse * {
                    color: #ff9800 !important;
                    text-shadow: 0 0 8px #ff9800 !important;
                    transition: color 0.2s, text-shadow 0.2s;
                }
                
                /* Stile per il selettore TTS */
                #tts-mode-selector {
                    position: absolute;
                    top: 95px; /* Sotto il selettore Keep/Clear (55px + 30px + 10px gap) */
                    left: 87px; /* Allineato con gli altri selettori */
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    background-color: #444; /* Default scuro per OFF */
                    border: 1px solid rgba(255, 255, 255, 0.4);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    color: white;
                    font-size: 10px;
                    font-weight: bold;
                    z-index: 10000;
                    transition: transform 0.2s, background-color 0.2s;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                }
                #tts-mode-selector:hover {
                    transform: scale(1.1);
                }
                #tts-mode-selector.active {
                    background-color: #00c853; /* Verde per ON */
                }
                
                /* Stile per il selettore Difficoltà */
                #difficulty-selector {
                    position: absolute;
                    top: 135px; /* Sotto il selettore TTS */
                    left: 87px;
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    background-color: #8BC34A; /* Default Elementary */
                    border: 1px solid rgba(255, 255, 255, 0.4);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    color: white;
                    font-size: 8px;
                    font-weight: bold;
                    z-index: 10000;
                    transition: transform 0.2s, background-color 0.2s;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                    display: none; /* Nascosto di default */
                }
                #difficulty-selector:hover {
                    transform: scale(1.1);
                }

                #voice-feedback {
                    position: absolute;
                    top: 95px;
                    left: 135px;
                    background: transparent;
                    color: #fff;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 1.5em;
                    pointer-events: none;
                    opacity: 0;
                    transition: opacity 0.3s;
                    z-index: 10000;
                    white-space: nowrap;
                }
                #voice-feedback.show {
                    opacity: 1;
                    pointer-events: auto;
                }
                #voice-translation {
                    position: absolute;
                    top: 130px;
                    left: 135px;
                    background: transparent;
                    color: #ffd700;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 1.5em;
                    pointer-events: none;
                    opacity: 0;
                    transition: opacity 0.3s;
                    z-index: 10000;
                    white-space: nowrap;
                    font-style: italic;
                    font-weight: bold;
                }
                #voice-translation.show {
                    opacity: 1;
                }
                #voice-lang-translation {
                    position: absolute;
                    top: 165px;
                    left: 135px;
                    background: transparent;
                    color: #00ffff;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 1.6em;
                    pointer-events: none;
                    opacity: 0;
                    transition: opacity 0.3s;
                    z-index: 10000;
                    white-space: nowrap;
                    font-weight: bold;
                    display: flex;
                    gap: 0.3em;
                }
                #voice-lang-translation.show {
                    opacity: 1;
                }
                #main-interactive-area {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    height: 30%;
                }
                /* Visori eleganti per anteprima di lettere e simboli */
                .visor {
                    position: relative;
                    width: 64px; /* fallback: verrà dimensionato dinamicamente */
                    height: 64px; /* fallback: verrà dimensionato dinamicamente */
                    border-radius: 14px;
                    background: transparent; /* sfondo trasparente */
                    border: 1px solid rgba(255,255,255,0.15);
                    box-shadow: 0 8px 18px rgba(0,0,0,0.12);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    line-height: 1;
                    user-select: none;
                    opacity: 0; /* nascosto di default */
                    visibility: hidden; /* non visibile di default */
                    pointer-events: none; /* non interferisce con il puntatore */
                    z-index: 3; /* sopra hover-grid e pulsanti */
                    transition: opacity 0.2s ease;
                }
                .visor.show {
                    opacity: 1;
                    visibility: visible;
                }
                .letter-visor .visor-content {
                    /* stile di default per lettere */
                    font-weight: bold;
                }
                .symbol-visor .visor-content {
                    /* stile di default per simboli */
                    font-weight: bold;
                }
                /* Immagine collegata, attaccata al visore e centrata sotto */
                .visor-image {
                    position: absolute;
                    top: 92%;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 140px;
                    height: 140px;
                    object-fit: contain;
                    opacity: 0;
                    pointer-events: none;
                    transition: opacity 0.2s ease;
                    filter: drop-shadow(0 4px 8px rgba(0,0,0,0.25));
                }
                .visor-image.show { opacity: 1; }
                /* Visori ancorati all'immagine, centrati verticalmente */
                .letter-visor {
                    position: absolute;
                    top: 50%;
                    left: 6px; /* spazio a sinistra dell'immagine */
                    transform: translate(-100%, -50%);
                }
                .symbol-visor {
                    position: absolute;
                    top: 50%;
                    right: 20px; /* spazio a destra dell'immagine */
                    /* Sposta il visore più a destra per lasciare spazio al bottone Next */
                    transform: translate(140%, -50%);
                }
                #image-container {
                    flex-shrink: 0;
                    width: 30%; /* Relativo al contenitore */
                    height: 100%;
                    aspect-ratio: 1 / 1; /* Mantiene il contenitore quadrato */
                    box-sizing: border-box;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    border: 0px solid #ddd;
                    position: relative; /* ancora i visori all'immagine */
                }
                #random-image {
                    max-width: 100%;
                    max-height: 100%;
                    cursor: pointer;
                    transition: opacity 0.3s ease;
                }
                #random-image.is-inactive {
                    animation: pulse-opacity 1.5s infinite ease-in-out;
                }
                @keyframes pulse-opacity {
                    0%, 100% { opacity: 0.6; }
                    50% { opacity: 1; }
                }
                .side-container {
                    flex: 1; /* Occupa lo spazio disponibile in modo uguale */
                    display: flex;
                    flex-direction: column; /* consente di impilare visore e pulsante */
                    justify-content: center; /* Centra il contenuto */
                    align-items: center;
                    gap: 4px; /* avvicina gli elementi tra loro */
                    position: relative; /* per overlay delle hover grid */
                }
                /* Avvicina il visore sinistro all'immagine con uno spazio sicuro */
                #prev-button-placeholder { align-items: flex-end; }
                #next-button-container { align-items: flex-start; }
                #prev-button-placeholder .visor { margin-right: 8px; }
                #prev-button-placeholder {
                    justify-content: flex-end; /* Allinea a destra per simmetria */
                }
                #next-button-container {
                    justify-content: flex-start; /* Allinea a sinistra per avvicinarsi all'immagine */
                }
                #next-button {
                    background: linear-gradient(to right, #f32170, #ff6b08, #cf23cf, #eedd44);
                    color: white;
                    border: none;
                    padding: 0.8em 1em;
                    font-size: 1.1em;
                    font-weight: bold;
                    border-radius: 8px;
                    text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
                    cursor: pointer;
                    transition: transform 0.2s;
                    position: relative;
                    z-index: 2; /* sopra le hover grid */
                    /* Sposta ulteriormente il bottone verso sinistra (quadruplo totale) */
                    margin-left: -112px;
                }
                                /* Overlay di aree hover (26 lettere / 46 simboli) */
                                .hover-grid {
                                    position: absolute;
                                    inset: 0;
                                    display: grid;
                                    grid-template-columns: repeat(auto-fill, minmax(var(--hover-size, 56px), 1fr));
                                    gap: 8px;
                                    align-content: center;
                                    justify-content: center;
                                    z-index: 1;
                                    opacity: 0; /* invisibile ma attiva */
                                }
                                .hover-cell {
                                    width: var(--hover-size, 56px);
                                    aspect-ratio: 1 / 1;
                                    pointer-events: auto;
                                }
                #next-button:hover {
                    transform: scale(1.05);
                }
                .reconstruction-area {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 5px;
                    justify-content: center;
                    padding: 1%;
                    border: none;
                    flex: 1; /* Ogni area occupa una frazione uguale dello spazio */
                    min-height: 0; /* Previene problemi di overflow con flexbox */
                }
                /* Consenti posizionamento assoluto del pulsante CLEAR senza influire sul layout */
                #ipa-options-area { position: relative; }
                #clear-button {
                    position: absolute;
                    right: 0;
                    top: 0;
                    background: linear-gradient(to right, #f32170, #ff6b08, #cf23cf, #eedd44);
                    color: white;
                    border: none;
                    padding: 0.8em 1em;
                    font-size: 1.1em;
                    font-weight: bold;
                    border-radius: 8px;
                    text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
                    cursor: pointer;
                    transition: transform 0.2s;
                    z-index: 2;
                    pointer-events: auto;
                }
                #clear-button:hover { transform: scale(1.05); }
                #reconstruction-areas {
                    position: relative;
                    container-type: size;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-around; /* Distribuisce meglio lo spazio tra le aree */
                    gap: 1%;
                    flex-grow: 1;
                    min-height: 0;
                }
                .letter-box, .ipa-box {
                    width: 3%; /* Dimezzata la larghezza per renderli più compatti */
                    aspect-ratio: 1 / 1; /* Mantiene i box quadrati */
                    /* Rimosso completamente il bordo e il box-shadow esterno */
                    border: none;
                    position: relative; /* Per posizionare tooltip interni */
                    border-radius: 6px; /* Bordi arrotondati per un alone più morbido */
                    /* Alone di default disattivato; verrà gestito per stato specifico */
                    background: none;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    font-size: 2.5cqw; /* Adattato alla nuova larghezza ridotta */
                    font-weight: normal;
                    cursor: pointer; /* Indica che i box sono cliccabili */
                    transition: background 0.3s ease-out; /* Transizione per la scomparsa dell'alone */
                }
                /* Rendi visibili i letter-box con un bordo leggero */
                .letter-box {
                    border: none;
                    background: transparent; /* Fallback se il gradiente non viene applicato */
                }
                /* Ripristina alone solo per box non SILENT se necessario (attualmente disattivato) */
                .letter-box:not(.silent-letter) {
                    /* background: radial-gradient(circle, rgba(200, 200, 200, 0.3) 10%, transparent 60%); */
                }
                    
                .letter-box .main-text, .ipa-box .main-text {
                    /* Impedisce al contenuto di alterare l'altezza del box genitore */
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    pointer-events: none;
    }
                .ipa-box, .ipa-option-symbol, .flying-symbol {
                    font-family: 'Times New Roman', serif;
    }
                .ipa-option-symbol {
                    width: 3%; /* Stessa larghezza dei box di risposta per coerenza */
                    aspect-ratio: 1 / 1; /* Mantiene il box quadrato */
                    border: 2px solid #ccc; /* Bordo visibile e coerente */
                    border-radius: 8px; /* Raggio del bordo uniforme */
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    font-size: 2.1cqw; /* Leggermente più grande per leggibilità */
                    cursor: pointer;
                    background-color: transparent;
                    transition: transform 0.2s, opacity 0.3s;
                    white-space: nowrap; /* Evita che simboli come i: vadano su due righe */
                }
                /* Stile speciale per simboli lunghi (es. trittonghi) */
                .ipa-option-symbol.long-symbol {
                    width: 5%; /* Più largo per contenere il testo */
                    aspect-ratio: 1.5 / 1; /* Leggermente rettangolare */
                }
                .ipa-option-symbol:hover {
                    transform: scale(1.1);
                }
                .ipa-option-symbol.hidden {
                    opacity: 0;
                    pointer-events: none;
                    transform: scale(0.5);
                }
                /* Evidenziazione dell'opzione midispiace */
                .ipa-option-symbol.midispiace-option.midispiace-highlight {
                    border-color: #ffd54f !important;
                    box-shadow: 0 0 0 2px rgba(255, 213, 79, 0.6), 0 0 14px rgba(255, 213, 79, 0.8);
                    transition: box-shadow 0.2s ease, border-color 0.2s ease;
                }
                #error-counters {
                    position: absolute; /* Sgancia i contatori dal flusso flex */
                    bottom: 0; /* Li ancora in fondo */
                    left: 0;
                    right: 0;
                    display: flex;
                    justify-content: space-around;
                    padding: 10px 0; /* Più leggero */
                    font-size: 1.5em; /* Meno dominante */
                    font-weight: normal;
                }
                .counter-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 10px;
                    border-radius: 8px;
                    background-color: transparent; /* Nessuno sfondo */
                    border: none; /* Nessun bordo */
                    box-shadow: none; /* Nessuna ombra */
                }
                .counter-value {
                    display: inline-block;
                    min-width: 2em;
                    padding: 3px 6px;
                    border-radius: 6px;
                    background-color: transparent; /* Nessuno sfondo */
                    border: none; /* Nessun bordo */
                    text-align: center;
                    color: #F0F0DC;
                    text-shadow: none; /* Nessuna ombra sul testo */
                    font-size: 1em;
                    font-weight: 600; /* Valore leggermente più marcato */
                }
                #timer-controls {
                    display: flex;
                    align-items: center;
                    margin-left: 10px;
                    background-color: transparent; /* Nessuno sfondo */
                    border-radius: 0;
                    padding: 2px;
                    border: none;
                }
                .time-control-btn {
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-size: 1.3em;
                    color: white;
                    padding: 2px 8px;
                    opacity: 0.7;
                    transition: opacity 0.2s, transform 0.2s;
                    font-weight: bold;
                }
                .time-control-btn:hover {
                    opacity: 1;
                    transform: scale(1.1);
                }
                #reset-time-btn.pulse-animation {
                    animation: pulse-yellow 1.5s infinite;
                }
                @keyframes pulse-yellow {
                    0%, 100% {
                        transform: scale(1);
                    }
                    50% {
                        transform: scale(1.15);
                    }
                }
                /* Etichette più sobrie e chiare */
                .counter-label {
                    color: #F0F0DC;
                    font-weight: 500;
                }
                .shake {
                    animation: shake 0.5s;
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    75% { transform: translateX(5px); }
                }
                /* Animazione per lo scorrimento del gradiente */
                @keyframes rainbow-flow {
                    to {
                        background-position: -200% center;
                    }
                }
                /* Animazione per il bordo rosso pulsante */
                .error-pulse {
                    animation: pulse-red 0.8s ease-out;
                }
                #timer-display.times-up {
                    color: red;
                    animation: pulse-red 0.8s infinite;
                }
                @keyframes pulse-red {
                    0% { border-color: red; box-shadow: 0 0 0 0 rgba(255, 0, 0, 0.7); }
                    70% { box-shadow: 0 0 0 10px rgba(255, 0, 0, 0); }
                    100% { border-color: lightgreen; box-shadow: 0 0 0 0 rgba(255, 0, 0, 0); }
                }

                /* Area per la traduzione italiana */
                #translation-display-area {
                    position: absolute;
                    top: 65%; /* Posizionato sopra l'area della frase inglese */
                    left: 0;
                    right: 0;
                    text-align: center;
                    font-size: 1.8em; /* Leggermente più piccolo della frase principale */
                    font-weight: bold;
                    z-index: 11;
                }
                #translation-display-area span {
                    opacity: 0;
                    display: inline-block;
                    transform: scale(0.5);
                    transition: opacity 0.3s ease-out, transform 0.3s ease-out;
                }
                /* Aggiunge l'animazione pulsante anche alla parola nella traduzione */
                #translation-display-area span.pulse-word {
                    animation: pulse-effect 1.2s infinite ease-in-out;
                }

                /* Area per la visualizzazione della frase animata */
                #phrase-display-area {                    
                    position: absolute;
                    top: 75%; /* Spostato un po' più in alto */
                    left: 0;
                    right: 0;
                    bottom: 15%; /* Definisce un'altezza, lasciando spazio per i contatori */
                    box-sizing: border-box;
                    text-align: center;
                    font-weight: bold;
                    pointer-events: none;
                    z-index: 10; /* Assicura che la frase sia sopra gli altri elementi */
                    font-size: 2.5em; /* Uniform font-size for flying and landed words */
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                #phrase-display-area span {
                    opacity: 0;
                    display: inline-block; /* Necessario per animazione */
                    transition: opacity 0.3s ease-out;
                                    /* Forza nessuna trasformazione di scala */
                                    transform: none !important;
                }
                .word-placeholder, .word-final {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 40px;
                    min-height: 40px;
                    box-sizing: border-box;
                }
                /* (Rimosse) animazioni di pulsazione per parola e immagine */

                .flashing-letter {
                    animation: flash 0.5s infinite;
                }

                @keyframes flash {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.2; }
                }

                /* Pulsazione morbida per il simbolo midispiace */
                .midispiace-pulse {
                    animation: pulse-opacity 1.5s infinite ease-in-out;
                }

                /* Tooltip per lettere mute */
                .silent-tooltip {
                    position: absolute;
                    bottom: 100%;
                    left: 50%;
                    transform: translateX(-50%);
                    background: transparent;
                    padding: 0;
                    font-size: 1.5em;
                    white-space: nowrap;
                    text-shadow: 0 2px 4px rgba(0,0,0,0.4);
                    opacity: 0;
                    pointer-events: none;
                    transition: opacity 0.2s ease, transform 0.2s ease;
                    z-index: 20;
                }
                .silent-tooltip.show {
                    opacity: 1;
                    transform: translateX(-50%) translateY(-2px);
                }

                /* Icona piccolissima midispiace sotto le lettere SILENT */
                .silent-icon {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 40%; /* dimensione raddoppiata */
                    height: auto;
                    pointer-events: none;
                    z-index: 1; /* sotto il contenuto, come l'alone */
                    display: block;
                    mix-blend-mode: normal; /* conserva il suo colore */
                }
                #typy-maestro-btn {
                    position: absolute;
                    left: 17%;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 180px; /* Dimensione raddoppiata rispetto allo standard */
                    height: 180px;
                    background-size: contain;
                    background-repeat: no-repeat;
                    background-position: center;
                    z-index: 90;
                    cursor: pointer;
                    transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    filter: drop-shadow(0 5px 15px rgba(0,0,0,0.3));
                }
                #typy-maestro-btn:hover {
                    transform: translateY(-50%) scale(1.1) rotate(5deg);
                }
                #looky-maestro-btn {
                    position: absolute;
                    right: 17%;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 180px;
                    height: 180px;
                    background-size: contain;
                    background-repeat: no-repeat;
                    background-position: center;
                    z-index: 90;
                    cursor: pointer;
                    transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    filter: drop-shadow(0 5px 15px rgba(0,0,0,0.3));
                }
                #looky-maestro-btn:hover {
                    transform: translateY(-50%) scale(1.1) rotate(-5deg);
                }
                /* Animazione per suggerire interattività a fine gioco */
                @keyframes suggestion-pulse-anim {
                    0% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(255, 215, 0, 0)); }
                    50% { transform: scale(1.1); filter: drop-shadow(0 0 15px rgba(255, 215, 0, 1)); }
                    100% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(255, 215, 0, 0)); }
                }
                .suggestion-pulse {
                    animation: suggestion-pulse-anim 1.5s infinite ease-in-out;
                    cursor: pointer !important;
                    z-index: 100;
                }
                /* Stile per le frecce indicatrici */
                .suggestion-arrow {
                    position: absolute;
                    font-size: 4em; /* Un po' più piccole */
                    color: #ff00cc;
                    font-weight: 100; /* Finissime */
                    font-family: "Times New Roman", serif; /* Font serif per la freccia lavorata */
                    z-index: 10000;
                    pointer-events: none;
                    text-shadow: 0 0 2px #fff, 0 0 5px #ff00cc; /* Glow molto stretto per non ingrossare */
                    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
                }
                @keyframes arrow-bounce-v {
                    0% { transform: translateY(0); } 100% { transform: translateY(-15px); }
                }
                @keyframes arrow-bounce-h {
                    0% { transform: translateX(0); } 100% { transform: translateX(-15px); }
                }
                /* Stile per il Cupido */
                .cupid-indicator {
                    font-size: 1.4em;
                    margin-right: 10px;
                    cursor: pointer;
                    z-index: 10001;
                    filter: drop-shadow(0 0 10px gold);
                    animation: cupid-bounce 2s infinite ease-in-out;
                }
                @keyframes cupid-bounce {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    50% { transform: translateY(-10px) rotate(5deg); }
                }
                /* Stile per l'omino perplesso */
                .perplexed-indicator {
                    position: absolute;
                    /* Posizione calcolata da JS */
                    font-size: 6em;
                    z-index: 10002;
                    cursor: pointer;
                    filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.8));
                    animation: perplexed-pulse 0.8s infinite alternate ease-in-out;
                }
                @keyframes perplexed-pulse {
                    from { transform: translateX(-50%) scale(1); }
                    to { transform: translateX(-50%) scale(1.15); }
                }
                /* Animazione pulsante per la parola seme */
                @keyframes seed-pulse-anim {
                    0% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(255, 215, 0, 0)); }
                    50% { transform: scale(1.4); filter: drop-shadow(0 0 15px rgba(255, 215, 0, 1)); }
                    100% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(255, 215, 0, 0)); }
                }
                @keyframes seed-text-anim {
                    0%, 100% { color: inherit; text-shadow: inherit; }
                    50% { color: #FFD700; text-shadow: 0 0 25px #FFD700, 0 0 40px #FF4500; }
                }
                
                /* Stile per il bottone MENU e Thesaurus */
                #menu-button {
                    position: absolute;
                    top: 140px;
                    left: 130px;
                    padding: 8px 16px;
                    background-color: #333;
                    color: white;
                    border: 2px solid rgba(255,255,255,0.5);
                    border-radius: 12px;
                    font-weight: bold;
                    font-family: sans-serif;
                    cursor: pointer;
                    z-index: 10000;
                    transition: background-color 0.2s, transform 0.2s;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                    display: none; /* Nascosto di default, gestito da VoiceCommandManager */
                }
                #menu-button:hover {
                    background-color: #555;
                    transform: scale(1.05);
                }
                #menu-button.active {
                    background-color: #00c853;
                    border-color: #fff;
                    box-shadow: 0 0 10px #00c853;
                }
                #menu-phonetic-feedback {
                    position: absolute;
                    top: 140px;
                    left: 230px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    gap: 2px;
                    pointer-events: none;
                    z-index: 10000;
                    font-family: "Times New Roman", serif;
                    font-size: 1.5em;
                    font-weight: bold;
                    background-color: rgba(0,0,0,0.8);
                    padding: 0 12px;
                    border-radius: 8px;
                    border: 1px solid rgba(255,255,255,0.3);
                    opacity: 0;
                    transition: opacity 0.2s;
                    white-space: nowrap;
                }
                #menu-phonetic-feedback.show {
                    opacity: 1;
                }
                .thesaurus-list {
                    position: absolute;
                    width: 340px; /* Larghezza raddoppiata per 2 colonne */
                    background-color: rgba(0,0,0,0.95);
                    border: 1px solid #fff;
                    border-radius: 8px;
                    display: grid; /* Grid per il layout a 2 colonne */
                    grid-template-columns: 1fr 1fr;
                    z-index: 10001;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.5);
                    overflow: hidden;
                }
                .thesaurus-item {
                    padding: 10px 15px;
                    color: #fff;
                    cursor: pointer;
                    border-bottom: 1px solid #444;
                    font-size: 1.1em;
                    transition: background 0.2s;
                    display: flex;
                    gap: 1px;
                }
                .thesaurus-item:last-child {
                    border-bottom: none;
                }
                .thesaurus-item:hover {
                    background-color: #444;
                    color: #FFD700;
                }
                .thesaurus-item.main-word {
                    font-weight: bold;
                    color: #00c853;
                    background-color: #222;
                    border-bottom: 2px solid #666;
                    text-transform: uppercase;
                }

                .seed-pulse-active {
                    animation: seed-pulse-anim 1.5s infinite ease-in-out;
                    display: inline-block !important;
                    z-index: 15;
                    position: relative;
                }
                .seed-pulse-active span {
                    /* Sovrascrive gli stili inline durante l'animazione */
                    animation: seed-text-anim 1.5s infinite ease-in-out;
                }
                /* Overlay per bloccare le interazioni quando l'omino è visibile */
                #perplexed-overlay {
                    position: absolute;
                    inset: 0;
                    background-color: rgba(0,0,0,0.4);
                    z-index: 10001;
                }
                
                /* Stili per le parole interattive nella traduzione */
                .interactive-word {
                    position: relative;
                    cursor: pointer;
                    display: inline-block;
                    transition: transform 0.2s;
                    margin: 0 1px;
                }
                .interactive-word:hover {
                    transform: scale(1.2);
                    z-index: 100;
                    text-shadow: 0 0 10px rgba(255,255,255,0.8);
                }
                .word-tooltip {
                    position: absolute;
                    bottom: 110%; /* Posizionato sopra la parola */
                    left: 50%;
                    transform: translateX(-50%);
                    background-color: rgba(0, 0, 0, 0.95);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    padding: 6px 10px;
                    border-radius: 8px;
                    font-size: 0.45em; /* Relativo al font della traduzione */
                    line-height: 1.3;
                    text-align: center;
                    opacity: 0;
                    pointer-events: none;
                    transition: opacity 0.2s, transform 0.2s;
                    white-space: nowrap;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.5);
                    z-index: 101;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .interactive-word:hover .word-tooltip {
                    opacity: 1;
                    transform: translateX(-50%) translateY(-5px);
                }
            </style>

            <div id="photo-game-block">              
                <div id="typy-maestro-btn"></div>
                <div id="looky-maestro-btn"></div>
                
                <!-- Nuovo contenitore per la dettatura -->
                <div id="dictation-box">
                    <div id="dictation-text"></div>
                    <div id="dictation-controls">
                        <button id="btn-copy-dictation" class="dictation-btn" title="Copia testo">Copia</button>
                        <button id="btn-undo-dictation" class="dictation-btn" title="Cancella ultimo">Indietro</button>
                    </div>
                </div>
                
                <!-- Mic 2 (MIKE) Container -->
                <div style="position: absolute; top: 15px; left: 15px; width: 44px; height: 44px; z-index: 10000;">
                    <div id="voice-indicator" title="MIKE ON/OFF" style="top: 0; left: 0;">
                        <svg viewBox="0 0 24 24">
                            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                        </svg>
                    </div>
                </div>

                <div id="command-light"></div> <!-- Luce verde spostata al centro -->

                <!-- Mic 1 (Always Listen) -->
                <div id="mic-always-on" title="Always Listening">
                    <svg viewBox="0 0 24 24">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                    </svg>
                </div>
                <div style="position: absolute; top: 15px; left: 145px; width: 44px; height: 44px; z-index: 10000;">
                    <div id="practice-indicator" class="disabled" title="Pratica ON/OFF" style="top: 0; left: 0;">
                        <span>P</span>
                    </div>
                </div>
                <div style="position: absolute; top: 15px; left: 210px; width: 44px; height: 44px; z-index: 10000;">
                    <div id="dictation-indicator" class="disabled" title="Dettatura ON/OFF" style="top: 0; left: 0;">
                        <span>D</span>
                    </div>
                </div>
                <div style="position: absolute; top: -5px; left: 87px; width: 30px; height: 30px; z-index: 10000;">
                    <div id="lang-selector" title="Lingua: EN/IT">
                        <span>EN</span>
                    </div>
                </div>
                <div id="feedback-mode-selector" title="Feedback: Keep (K) / Clear (C)">
                    <span>C</span>
                </div>
                <div id="tts-mode-selector" title="TTS Auto: ON/OFF">
                    <span>TTS</span>
                </div>
                <div id="difficulty-selector" title="Livello: Beginner/Elementary/Intermediate/Advanced">
                    <span>ELEM</span>
                </div>
                
                <div id="menu-button" title="Menu Parole Correlate">MENU</div>
                <div id="menu-phonetic-feedback"></div>

                <div id="voice-feedback"></div>
                <div id="voice-translation"></div>
                <div id="voice-lang-translation"></div>
                <div id="game-area">
                    <div id="main-interactive-area">
                        <div id="prev-button-placeholder" class="side-container"></div>
                        <div id="image-container">
                            <img id="random-image" src="" alt="Random Image">
                        </div>
                        <div id="next-button-container" class="side-container"></div>
                    </div>
                    <div id="reconstruction-areas">
                        <div id="word-reconstruction-area" class="reconstruction-area"></div>
                        <div id="ipa-answer-area" class="reconstruction-area"></div>
                        <div id="ipa-options-area" class="reconstruction-area"></div>
                    </div>
                    <!-- Spostati qui perché hanno stili speciali e non devono interferire con il layout flex -->
                    <div id="phrase-display-area"></div>
                    <div id="translation-display-area"></div>
                    <div id="error-counters">
                        <div class="counter-item">
                            <span class="counter-label">Letter errors:</span>
                            <span id="letter-errors-value" class="counter-value">${this.gameController.letterErrors}</span>
                        </div>
                        <div class="counter-item">
                            <span class="counter-label">Symbol errors:</span>
                            <span id="symbol-errors-value" class="counter-value">${this.gameController.symbolErrors}</span>
                        </div>
                        <div class="counter-item">
                            <span class="counter-label">Timeouts:</span>
                            <span id="timeout-errors-value" class="counter-value">${this.gameController.timeoutErrors}</span>
                        </div>
                        <div class="counter-item">
                            <span class="counter-label">Time:</span>
                            <span id="timer-display" class="counter-value">
                                ${String(Math.floor(this.gameTimer.getTimeLeft() / 60)).padStart(2, '0')}:${String(this.gameTimer.getTimeLeft() % 60).padStart(2, '0')}
                            </span>
                            <div id="timer-controls">
                                <button id="decrease-time-btn" class="time-control-btn" title="Diminuisci di 5s">-</button>
                                <button id="reset-time-btn" class="time-control-btn" title="Imposta a 1 minuto">⚙️</button>
                                <button id="increase-time-btn" class="time-control-btn" title="Aumenta di 5s">+</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    startSoundGame() {
        // Avvia sempre la modalità SOUND: mostra lo speaker e gli aloni per la parola
        this.soundGameMode = true;
        this.isSoundGameActive = true;
        this.isPhotoGameActive = false;
        this._blockAutoStart = false;

        // Gestione visiva: SOUND attivo (no opacità), PHOTO inattivo (opaco)
        const soundBtn = document.getElementById('gameSoundButton');
        if (soundBtn) soundBtn.classList.remove('disabled-effect');
        const photoBtn = document.getElementById('gamePhotoButton');
        if (photoBtn) photoBtn.classList.add('disabled-effect');

        try { if (photoGameManager.stopAllSounds) photoGameManager.stopAllSounds(); } catch {}
        // Avvia la logica sound-game: mostra lo speaker e la parola
        if (typeof photoGameManager !== 'undefined') {
            photoGameManager.showNextImage();
        }
    }

    startPhotoGame() {
        // Avvia sempre la modalità PHOTO: mostra immagine random e aloni per la parola
        this.soundGameMode = false;
        this.isSoundGameActive = false;
        this.isPhotoGameActive = true;
        this._blockAutoStart = false;

        // Gestione visiva: PHOTO attivo (no opacità), SOUND inattivo (opaco)
        const photoBtn = document.getElementById('gamePhotoButton');
        if (photoBtn) photoBtn.classList.remove('disabled-effect');
        const soundBtn = document.getElementById('gameSoundButton');
        if (soundBtn) soundBtn.classList.add('disabled-effect');

        try { if (photoGameManager.stopAllSounds) photoGameManager.stopAllSounds(); } catch {}
        if (typeof photoGameManager !== 'undefined') {
            photoGameManager.showNextImage();
        }
    }

    async connectedCallback() {
            // Blocca i comandi vocali finché non c'è una vera interazione
            this.voiceCommandManager.isReadyForVoiceCommands = false;
                // Sblocca i comandi vocali anche al primo click su qualsiasi parte della pagina
                window.addEventListener('click', () => {
                    if (!this.voiceCommandManager.isReadyForVoiceCommands) {
                        this.voiceCommandManager.isReadyForVoiceCommands = true;
                        console.log('Comandi vocali sbloccati da click utente.');
                    }
                }, { once: true });
        console.log('photo-game-component: connectedCallback called.');
        
        // BLOCCO DI SICUREZZA IMMEDIATO: Ferma tutto prima di caricare dati o logica
        this._blockAutoStart = true;
        this.isPhotoGameActive = false;
        this.soundGameMode = false;
        this.isSoundGameActive = false;

        // HARD RESET: Mike spento all'avvio
        this.voiceCommandManager.isVoiceEnabled = false;
        this.voiceCommandManager.updateVoiceIndicator('disabled');

        if (voiceService) voiceService.cancelSpeech();
        if (photoGameManager) {
            photoGameManager.currentImageData = null;
            try { if (photoGameManager.stopAllSounds) photoGameManager.stopAllSounds(); } catch {}
        }

        // Forza il microfono always-on ad ascoltare SEMPRE i comandi
        this.voiceCommandManager.setupVoiceCommands();

        // Observer per rilevare cambiamenti nel feedback vocale (MIC MAIN)
        this._lastTranslatedText = null;
        this._translationSpeakTimer = null;
        this.feedbackObserver = new MutationObserver(async (mutations) => {
            const now = Date.now();
            const timeSinceLast = now - (this._lastDictationEventTime || now);
            this._lastDictationEventTime = now;

            const feedback = this.shadowRoot.querySelector('#voice-feedback');
            const rawText = feedback ? (feedback.dataset.originalText || feedback.textContent) : '';
            const text = rawText.trim();
            const isFinal = feedback && feedback.dataset.isFinal === 'true';

            // --- NUOVA GESTIONE DETTATURA ---
            if (this.isDictationActive) {
                // Quando la dettatura è attiva, il feedback di MIKE 1 non deve essere visibile.
                if (feedback) {
                    feedback.classList.remove('show');
                }

                if (text) {
                    // Comando speciale per pulire il box dettatura senza disattivarlo.
                    const cleanCommand = text.replace(/[.,!?;:]/g, '').trim().toUpperCase();
                    const commandWords = cleanCommand.split(/\s+/);

                    if (['CANCELLA', 'CLEAR', 'RESET'].some(cmd => commandWords.includes(cmd))) {
                        console.log(`[Dictation] Comando CANCELLA rilevato.`);
                        this.dictationContent = '';
                        this._lastObservedDictationText = null;
                        this._capitalizeNextDictationWord = true;
                        this._dictationHistory = [];
                        this._lastFinalDictationTime = 0;
                        this._lastFinalDictationText = '';
                        const dictationBox = this.shadowRoot.querySelector('#dictation-text');
                        if (dictationBox) {
                            dictationBox.textContent = '';
                        }
                        return; // Comando eseguito, non scriverlo nel box.
                    }

                    // Se c'è stata una pausa significativa (>0.8s) e abbiamo un'emissione precedente,
                    // la consideriamo finale e la "consolidiamo".
                    if (timeSinceLast > 800 && this._lastObservedDictationText) {
                        this.updateDictationBox(this._lastObservedDictationText, true);
                    }

                    this.updateDictationBox(text, isFinal);
                    // Salviamo il testo provvisorio solo se non è già stato consolidato come finale.
                    if (!isFinal) {
                        this._lastObservedDictationText = text;
                    }

                } else if (this._lastObservedDictationText) {
                    // Un evento con testo vuoto è una pausa esplicita. Consolidiamo.
                    this.updateDictationBox(this._lastObservedDictationText, true);
                }
                return; // Interrompe l'ulteriore elaborazione (comandi, traduzione, etc.)
            }

            // --- NUOVA GESTIONE COMANDO "CLEAR" ---
            // Normalizzazione aggressiva: rimuove punteggiatura e spazi extra, tutto maiuscolo
            const cleanCommand = text.replace(/[.,!?;:]/g, '').trim().toUpperCase();
            const commandWords = cleanCommand.split(/\s+/);
            
            if (['CLEAR', 'CHIUDI', 'CLOSE', 'RESET', 'CANCELLA', 'BASTA'].some(cmd => commandWords.includes(cmd))) {
                console.log(`Comando prioritario rilevato: ${cleanCommand}`);
                // Esegui l'hard reset immediato
                this.performHardReset();
                // Interrompi l'ulteriore elaborazione (es. traduzione)
                return;
            }

            // --- NUOVI COMANDI: SIM, SIMBOLI, SYMBOLY (EN), TRASCRIVI ---
            const phoneticCommands = ['SIM', 'SIMBOLI', 'SIMBOLO', 'SYMBOLS', 'SYMBOL', 'SYMBOLY', 'TRASCRIVI', 'TRASCRIZIONE', 'RISOLVI', 'SOLVE'];
            if (phoneticCommands.some(cmd => commandWords.includes(cmd))) {
                this.autoSolvePhonetics();
                return;
            }
            
            if (text && text !== this._lastTranslatedText) {
                this._lastTranslatedText = text;
                // Debounce leggero per evitare traduzioni su parziali rapidi
                if (this._translationDebounce) clearTimeout(this._translationDebounce);
                this._translationDebounce = setTimeout(() => this.handleVoiceTranslation(text), 1000);
            } else if (!text) {
                this._lastTranslatedText = null;
            }
        });
        const feedbackNode = this.shadowRoot.querySelector('#voice-feedback');
        if (feedbackNode) {
            this.feedbackObserver.observe(feedbackNode, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-original-text'] });
        }

        this.wordArea = this.shadowRoot.querySelector('#word-reconstruction-area');
        this.ipaAnswerArea = this.shadowRoot.querySelector('#ipa-answer-area');
        this.ipaOptionsArea = this.shadowRoot.querySelector('#ipa-options-area');
        this.letterErrorsValueSpan = this.shadowRoot.querySelector('#letter-errors-value');
        this.symbolErrorsValueSpan = this.shadowRoot.querySelector('#symbol-errors-value');
        this.randomImageElement = this.shadowRoot.querySelector('#random-image');
        this.nextButtonContainer = this.shadowRoot.querySelector('#next-button-container');
        this.phraseDisplayArea = this.shadowRoot.querySelector('#phrase-display-area');
        this.translationDisplayArea = this.shadowRoot.querySelector('#translation-display-area');
        this.timeoutErrorsValueSpan = this.shadowRoot.querySelector('#timeout-errors-value');
        this.timerDisplay = this.shadowRoot.querySelector('#timer-display');
        this.decreaseTimeBtn = this.shadowRoot.querySelector('#decrease-time-btn');
        this.resetTimeBtn = this.shadowRoot.querySelector('#reset-time-btn');
        this.increaseTimeBtn = this.shadowRoot.querySelector('#increase-time-btn');
        // Il pulsante SOUND vive sulla pagina madre (index.html) accanto a wordy/simbo/photo.
        // Qui non creiamo pulsanti aggiuntivi nel componente per non alterare il layout interno.

        const typyBtn = this.shadowRoot.querySelector('#typy-maestro-btn');
        if (typyBtn) {
            typyBtn.style.backgroundImage = `url(${this.getAssetPrefix()}img/typy-maestro.png)`;
        }
        const lookyBtn = this.shadowRoot.querySelector('#looky-maestro-btn');
        if (lookyBtn) {
            lookyBtn.style.backgroundImage = `url(${this.getAssetPrefix()}img/looky-maestro.png)`;
        }

        await this.loadGameData();
        // NON avviare nessuna immagine random né chiamare setImage('') qui: la scena deve restare vuota finché l'utente non interagisce
        if (this.randomImageElement) {
            this.randomImageElement.classList.add('is-inactive');
        }

        // Se arriviamo dalla home con la modalità sound-game, avvia subito il turno
        let started = false;
        try {
            if (localStorage.getItem('soundGameMode') === 'on') {
                localStorage.removeItem('soundGameMode');
                // Modifica: Non attivare nulla, lascia che il blocco !started esegua il reset completo (scena pulita)
                // come richiesto, ignorando l'avvio automatico della modalità sound.
            }
        } catch {}

        // Se non è stata avviata una modalità specifica (es. sound), avvia il photo-game di default
        if (!started) {
            this._blockAutoStart = true; // Blocca qualsiasi tentativo di avvio automatico
            // NON chiamare clearBoard() né setImage('') qui: la scena deve restare vuota finché l'utente non interagisce
            try { if (photoGameManager && photoGameManager.stopAllSounds) photoGameManager.stopAllSounds(); } catch {}
            if (voiceService) voiceService.cancelSpeech();
            // Pulisce i dati del manager PRIMA di collegarlo per evitare avvii automatici
            if (photoGameManager) photoGameManager.currentImageData = null;
            this.randomImageElement.classList.add('is-inactive');
            // AVVIA SEMPRE L'ASCOLTO VOCALE DOPO IL RESET
        }

        // Crea i bottoni di gioco (SOUND e PHOTO) indipendenti dalla pagina madre
        try {
            if (!document.getElementById('gameSoundButton')) {
                const cloneBtn = document.createElement('div');
                cloneBtn.id = 'gameSoundButton';
                cloneBtn.className = 'control-image-button clickMe';
                cloneBtn.style.position = 'fixed';
                cloneBtn.style.zIndex = '1000';
                cloneBtn.style.backgroundImage = `url(${this.getAssetPrefix()}img/sound.png)`;
                // Allinea lo stile al bottone della pagina madre per evitare tagli
                cloneBtn.style.backgroundSize = '100% 100%';
                cloneBtn.style.backgroundPosition = 'center';
                // Rimuovi bordi e ombre per evitare evidenziazione
                cloneBtn.style.border = 'none';
                cloneBtn.style.boxShadow = 'none';
                // Definisce i keyframes di pulsing se non presenti e applica l'animazione
                // Disattiva qualsiasi animazione residua
                try {
                    cloneBtn.style.animation = 'none';
                } catch {}
                
                // Posizionamento fisso: Sotto Photo (che è sotto Simbo)
                cloneBtn.style.left = '-9.5%'; // Spostato molto più a sinistra (modifica qui per regolare orizzontalmente)
                cloneBtn.style.top = '32%'; // Posizione verticale proporzionale (sotto Photo)
                cloneBtn.style.width = '4.5vw'; // Ridotto di un quarto
                cloneBtn.style.height = '4.5vw';

                // Aggiunge area clic
                const actionArea = document.createElement('div');
                actionArea.className = 'action-area';
                cloneBtn.appendChild(actionArea);
                document.body.appendChild(cloneBtn);
                cloneBtn.addEventListener('click', () => {
                    this.startSoundGame();
                });
            }
        } catch {}

        // Crea il bottone Auto-Solve (bacchetta magica) nel contenitore di destra
        try {
            if (this.nextButtonContainer && !this.nextButtonContainer.querySelector('#auto-solve-btn')) {
                const autoSolveBtn = document.createElement('div');
                autoSolveBtn.id = 'auto-solve-btn';
                autoSolveBtn.title = "Auto-compilazione fonetica";
                autoSolveBtn.style.width = '80px';
                autoSolveBtn.style.height = '80px';
                autoSolveBtn.style.borderRadius = '50%';
                autoSolveBtn.style.border = 'transparent';
                autoSolveBtn.style.cursor = 'pointer';
                autoSolveBtn.style.marginBottom = '10px';
                autoSolveBtn.style.marginLeft = '-140px';
                // Stile per l'immagine di sfondo come richiesto
                autoSolveBtn.style.backgroundImage = `url(${this.getAssetPrefix()}Img/simboli.png)`;
                autoSolveBtn.style.backgroundSize = '90%';
                autoSolveBtn.style.backgroundRepeat = 'no-repeat';
                autoSolveBtn.style.backgroundPosition = 'center';
                autoSolveBtn.style.display = 'none'; // Nascondi inizialmente
                
                autoSolveBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.autoSolvePhonetics();
                });
                
                // Inserisci all'inizio del container di destra
                this.nextButtonContainer.insertBefore(autoSolveBtn, this.nextButtonContainer.firstChild);
            }
        } catch {}

        // Aggiunge listener per il toggle del microfono
        const voiceIndicator = this.shadowRoot.querySelector('#voice-indicator');
        if (voiceIndicator && !voiceIndicator.hasAttribute('data-click-listener')) {
            voiceIndicator.addEventListener('click', (e) => {
                e.stopPropagation();
                // Sblocca i comandi vocali se l'utente interagisce col bottone
                this.voiceCommandManager.isReadyForVoiceCommands = true;
                this.voiceCommandManager.toggleVoiceListening();
            });
            voiceIndicator.setAttribute('data-click-listener', 'true');
        }
        
        // Listener per il toggle del microfono Always On (luce verde/rossa)
        const commandLight = this.shadowRoot.querySelector('#command-light');
        if (commandLight) {
            commandLight.addEventListener('click', (e) => {
                e.stopPropagation();
                this.voiceCommandManager.toggleAlwaysListening();
            });
        }

        // Listener per bottone Pratica
        const practiceIndicator = this.shadowRoot.querySelector('#practice-indicator');
        if (practiceIndicator && !practiceIndicator.hasAttribute('data-click-listener')) {
            practiceIndicator.addEventListener('click', (e) => {
                e.stopPropagation();
                this.voiceCommandManager.setPracticeMode(!this.voiceCommandManager.isPracticeButtonActive);
            });
            practiceIndicator.setAttribute('data-click-listener', 'true');
        }

        // Listener per bottone Dettatura
        const dictationIndicator = this.shadowRoot.querySelector('#dictation-indicator');
        if (dictationIndicator && !dictationIndicator.hasAttribute('data-click-listener')) {
            dictationIndicator.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDictationMode();
            });
            dictationIndicator.setAttribute('data-click-listener', 'true');
        }
        
        // Listener per i bottoni del box dettatura
        const btnCopy = this.shadowRoot.querySelector('#btn-copy-dictation');
        if (btnCopy) {
            btnCopy.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.dictationContent) {
                    navigator.clipboard.writeText(this.dictationContent)
                        .then(() => console.log('Testo copiato'))
                        .catch(err => console.error('Errore copia', err));
                }
            });
        }
        const btnUndo = this.shadowRoot.querySelector('#btn-undo-dictation');
        if (btnUndo) {
            btnUndo.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this._dictationHistory.length > 0) {
                    this.dictationContent = this._dictationHistory.pop();
                    const dictationText = this.shadowRoot.querySelector('#dictation-text');
                    if (dictationText) dictationText.textContent = this.dictationContent;
                    // Se torniamo indietro, potremmo voler resettare il flag di capitalizzazione in base al nuovo finale
                    if (this.dictationContent.trim().endsWith('.')) {
                        this._capitalizeNextDictationWord = true;
                    } else if (this.dictationContent.length === 0) {
                        this._capitalizeNextDictationWord = true;
                    } else {
                        this._capitalizeNextDictationWord = false;
                    }
                } else if (this.dictationContent.length > 0) {
                    // Se non c'è storia ma c'è contenuto (es. primo inserimento), cancella tutto
                    this.dictationContent = '';
                    const dictationText = this.shadowRoot.querySelector('#dictation-text');
                    if (dictationText) dictationText.textContent = '';
                    this._capitalizeNextDictationWord = true;
                }
            });
        }

        // Listener per selettore lingua
        const langSelector = this.shadowRoot.querySelector('#lang-selector');
        if (langSelector) {
            langSelector.addEventListener('click', (e) => {
                e.stopPropagation();
                this.voiceCommandManager.toggleRecognitionLanguage();
            });
        }

        // Listener per selettore Keep/Clear
        const feedbackSelector = this.shadowRoot.querySelector('#feedback-mode-selector');
        if (feedbackSelector) {
            feedbackSelector.addEventListener('click', (e) => {
                e.stopPropagation();
                this.voiceCommandManager.toggleFeedbackMode();

                // Gestione visibilità immediata al cambio modalità
                const isKeep = this.voiceCommandManager.keepFeedbackMode;
                const feedbackEl = this.shadowRoot.querySelector('#voice-feedback');
                const transEl = this.shadowRoot.querySelector('#voice-lang-translation');
                const voiceTransEl = this.shadowRoot.querySelector('#voice-translation');

                if (isKeep) {
                    // In modalità Keep, ripristina la visibilità se c'è contenuto
                    if (feedbackEl && (feedbackEl.textContent.trim() || feedbackEl.dataset.originalText)) feedbackEl.classList.add('show');
                    if (transEl && transEl.textContent.trim()) transEl.classList.add('show');
                    if (voiceTransEl && voiceTransEl.textContent.trim()) voiceTransEl.classList.add('show');
                    
                    // Riavvia la ricostruzione se c'è testo (saltando il ritardo)
                    const text = feedbackEl ? (feedbackEl.dataset.originalText || feedbackEl.textContent) : '';
                    if (text) {
                        this._translationRequestId = (this._translationRequestId || 0) + 1;
                        
                        const isItalian = this.voiceCommandManager && this.voiceCommandManager.recognitionLang === 'it-IT';
                        if (isItalian) {
                            this.handleItalianToEnglishFlow(text, this._translationRequestId, true);
                        } else {
                            // EN Mode: Fetch translation, then animate English, then speak Italian
                            this.getItalianTranslation(text).then(italianTranslation => {
                                this.handleItalianToEnglishFlow(text, this._translationRequestId, true, true, () => {
                                    if (voiceService && italianTranslation) {
                                        voiceService.speak(italianTranslation, { lang: 'it-IT' });
                                    }
                                }, italianTranslation);
                            });
                        }
                    }
                } else {
                    // In modalità Clear, nascondi tutto immediatamente
                    if (feedbackEl) feedbackEl.classList.remove('show');
                    if (transEl) transEl.classList.remove('show');
                    if (voiceTransEl) voiceTransEl.classList.remove('show');
                }
            });
        }

        // Listener per selettore TTS
        const ttsSelector = this.shadowRoot.querySelector('#tts-mode-selector');
        if (ttsSelector) {
            ttsSelector.addEventListener('click', (e) => {
                e.stopPropagation();
                this.voiceCommandManager.toggleTtsMode();
                const lastText = this.voiceCommandManager ? this.voiceCommandManager._lastFeedbackText : null;

                if (this.voiceCommandManager && this.voiceCommandManager.ttsEnabled && lastText) {
                    if (voiceService) voiceService.speak(lastText, { lang: this.voiceCommandManager.recognitionLang || 'en-GB', rate: 0.65, pitch: 1.4 });
                } else {
                    if (voiceService) voiceService.cancelSpeech();
                }
            });
        }
        
        // Listener per selettore Difficoltà
        const diffSelector = this.shadowRoot.querySelector('#difficulty-selector');
        if (diffSelector) {
            diffSelector.addEventListener('click', (e) => {
                e.stopPropagation();
                const levels = ['beginner', 'elementary', 'intermediate', 'advanced'];
                const labels = { 'beginner': 'BEG', 'elementary': 'ELEM', 'intermediate': 'INT', 'advanced': 'ADV' };
                const colors = { 'beginner': '#4CAF50', 'elementary': '#8BC34A', 'intermediate': '#FFC107', 'advanced': '#F44336' };
                
                let idx = levels.indexOf(this._difficultyLevel);
                idx = (idx + 1) % levels.length;
                this._difficultyLevel = levels[idx];
                
                const span = diffSelector.querySelector('span');
                if (span) span.textContent = labels[this._difficultyLevel];
                diffSelector.style.backgroundColor = colors[this._difficultyLevel];
                
                // Se il menu è aperto, aggiornalo
                const list1 = this.shadowRoot.querySelector('#thesaurus-list-1');
                if (list1) {
                    const feedback = this.shadowRoot.querySelector('#voice-feedback');
                    const rawText = feedback ? (feedback.dataset.originalText || feedback.textContent) : '';
                    const word = rawText.replace(/\u00A0/g, ' ').trim();
                    if (word) this.thesaurusManager.spawnThesaurusList(word, 1);
                }
            });
        }
        
        // Listener per il bottone MENU
        const menuBtn = this.shadowRoot.querySelector('#menu-button');
        if (menuBtn) {
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.thesaurusManager.toggleThesaurusMenu();
            });

            // Observer per sincronizzare la visibilità del selettore difficoltà con il bottone MENU
            this.menuBtnObserver = new MutationObserver(() => {
                const diffSelector = this.shadowRoot.querySelector('#difficulty-selector');
                if (diffSelector) {
                    if (menuBtn.style.display && menuBtn.style.display !== 'none') {
                        diffSelector.style.display = 'flex';
                    } else {
                        diffSelector.style.display = 'none';
                    }
                }
            });
            this.menuBtnObserver.observe(menuBtn, { attributes: true, attributeFilter: ['style'] });
        }

        // Listener per il click sul feedback vocale (modalità pratica)
        const feedback = this.shadowRoot.querySelector('#voice-feedback');
        if (feedback) {
            feedback.addEventListener('click', async (e) => {
                e.stopPropagation();
                // Il click funziona in modalità pratica SOLO se anche MIKE è attivo (richiesta utente)
                if (this.voiceCommandManager.isPracticeButtonActive && this.voiceCommandManager.isVoiceEnabled) {
                    // Usa il testo originale pulito se disponibile, altrimenti il contenuto testuale
                    const rawText = feedback.dataset.originalText || feedback.textContent;
                    // Pulisce la parola da punteggiatura e spazi per una ricerca più affidabile.
                    const text = (rawText || '').replace(/[.,!?;:]/g, '').replace(/\u00A0/g, ' ').trim();
                    if (!text) return;

                    console.log(`[Feedback Click] Searching for word: "${text}"`);
                    // Cerca la parola nei dati caricati
                    const wordData = this.allWordsData ? this.allWordsData.find(d => d.text.toLowerCase() === text.toLowerCase()) : null;
                    if (wordData) {
                        console.log('[Feedback Click] Word found in local DB:', wordData);
                        this._blockAutoStart = false; // Sblocca l'avvio del gioco per la pratica
                        feedback.classList.remove('show');
                        const imageData = {
                            img: `${this.getAssetPrefix()}img/wordy.png`, 
                            wordSound: wordData.wordSound ? `${this.getAssetPrefix()}${wordData.wordSound}` : null,
                            text: wordData.text,
                            fullPhonetic: wordData.fullPhonetic,
                            wordCharPhonetics: Array.isArray(wordData.wordCharPhonetics) ? wordData.wordCharPhonetics : null,
                            silentIndexes: Array.isArray(wordData.silentIndexes) ? wordData.silentIndexes : null,
                            isPracticeWord: true
                        };
                        if (photoGameManager && typeof photoGameManager.showImageData === 'function') {
                            photoGameManager.showImageData(imageData);
                        } else {
                            if (photoGameManager) photoGameManager.currentImageData = imageData;
                            this.startGame(imageData);
                        }
                    } else {
                        console.warn(`[Feedback Click] Word "${text}" not found in local DB. Using API fallback.`);
                        // Supporto per testo arbitrario (parole non nel DB)
                        this._blockAutoStart = false; // Sblocca l'avvio del gioco per la pratica
                        feedback.classList.remove('show');
                        
                        // Recupera la fonetica dall'API esterna
                        const fetchedPhonetic = await phoneticService.getPhoneticsFromApi(text);

                        const imageData = {
                            img: `${this.getAssetPrefix()}img/wordy.png`,
                            wordSound: null,
                            text: text,
                            fullPhonetic: fetchedPhonetic, // Usa la fonetica recuperata
                            wordCharPhonetics: null,
                            silentIndexes: [],
                            isPracticeWord: true
                        };
                        if (photoGameManager && typeof photoGameManager.showImageData === 'function') {
                            photoGameManager.showImageData(imageData);
                        } else {
                            if (photoGameManager) photoGameManager.currentImageData = imageData;
                            this.startGame(imageData);
                        }
                    }
                }
            });
        }

        // Crea il bottone PHOTO
        try {
            if (!document.getElementById('gamePhotoButton')) {
                const photoBtn = document.createElement('div');
                photoBtn.id = 'gamePhotoButton';
                photoBtn.className = 'control-image-button clickMe';
                photoBtn.style.position = 'fixed';
                photoBtn.style.zIndex = '1000';
                photoBtn.style.backgroundImage = `url(${this.getAssetPrefix()}img/photo.png)`;
                photoBtn.style.backgroundSize = '100% 100%';
                photoBtn.style.backgroundPosition = 'center';
                photoBtn.style.border = 'none';
                photoBtn.style.boxShadow = 'none';
                
                // Posizionamento fisso: Sotto Simbo
                photoBtn.style.left = '-9.5%'; // Allineato verticalmente con Sound
                photoBtn.style.top = '18%'; // Posizione verticale proporzionale (sotto Simbo)
                photoBtn.style.width = '5vw'; // Rimpicciolito lievemente
                photoBtn.style.height = '5vw';

                const photoAction = document.createElement('div');
                photoAction.className = 'action-area';
                photoBtn.appendChild(photoAction);
                document.body.appendChild(photoBtn);

                // ON/OFF per PHOTO: cliccando spegne SOUND e avvia/ferma PHOTO
                photoBtn.addEventListener('click', () => {
                    this.startPhotoGame();
                });
            }
        } catch {}
        // Ensure reconstructionAreas are visible on connect, in case they were hidden by deactivate
        const reconstructionAreas = this.shadowRoot.querySelector('#reconstruction-areas');
        if (reconstructionAreas) {
            reconstructionAreas.style.display = ''; 
        }

        this.randomImageElement.addEventListener('click', () => {
            this.randomImageElement.classList.remove('suggestion-pulse');
            // Se la modalità omino perplesso è attiva, avvia la sequenza speciale
            if (this._perplexedModeActive) {
                this.runPerplexedPhraseSequence();
                return;
            }
            // --- Ricostruzione sincronizzata lettera per lettera SEMPRE, poi audio ---
            if (this.gameController.currentWord && this.gameController.isWordComplete && this.gameController.isIpaComplete) {
                // Usa la sequenza della frase anche per i click successivi a fine gioco
                this.runPerplexedPhraseSequence();
                return;
            }
            // Se il gioco non è attivo, avvia la modalità corretta
            if (this.soundGameMode || this.isSoundGameActive) {
                if (this.voiceCommandManager.isVoiceEnabled) {
                    this.autoSpellCurrentWord();
                } else {
                    photoGameManager.playCurrentImageSound();
                }
                return;
            }
            if (this.randomImageElement.classList.contains('is-inactive')) {
                this.randomImageElement.classList.remove('is-inactive');
                if (typeof photoGameManager !== 'undefined') {
                    photoGameManager.showNextImage();
                }
                return;
            }
            if (this.gameController.isWordComplete) {
                if (photoGameManager.currentImageData && photoGameManager.currentImageData.wordSound) {
                    photoGameManager.playCurrentImageSound();
                } else if (this.voiceCommandManager.isVoiceEnabled) {
                    this.voiceCommandManager.speak(this.gameController.currentWord);
                }
                return;
            }
            if (this.isAutoSpelling) {
                if (this.voiceCommandManager.isVoiceEnabled) {
                    this.voiceCommandManager.speak(this.gameController.currentWord);
                } else {
                    photoGameManager.playCurrentImageSound();
                }
                return;
            }
            
            // Logica condizionale per Wordy (Pratica) vs Normale
            const isPracticeWord = photoGameManager && photoGameManager.currentImageData && photoGameManager.currentImageData.isPracticeWord;
            
            let shouldAutoSpell = this.voiceCommandManager.isVoiceEnabled || this.voiceCommandManager.isPracticeButtonActive;

            // Per le parole di pratica, auto-spell solo se SIA Mike CHE Pratica sono attivi.
            // Altrimenti (es. Mike OFF), shouldAutoSpell = false per far partire l'audio (playCurrentImageSound).
            if (isPracticeWord && (!this.voiceCommandManager.isVoiceEnabled || !this.voiceCommandManager.isPracticeButtonActive)) {
                shouldAutoSpell = false;
            }
            
            if (shouldAutoSpell) {
                this.autoSpellCurrentWord();
            } else {
                photoGameManager.playCurrentImageSound();
            }
        });

        // Gestione click destro sull'immagine: solo audio, niente auto-ricostruzione
        this.randomImageElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            // Ignora se l'immagine è inattiva (gioco non avviato) o se il gioco è finito
            if (this.randomImageElement.classList.contains('is-inactive') || (this.gameController.isWordComplete && this.gameController.isIpaComplete)) {
                return;
            }

            if (this.gameController.currentWord) {
                const now = Date.now();
                // Throttle di 400ms per evitare sovrapposizioni audio fastidiose
                if (now - this._lastRightClickTime < 400) return;
                this._lastRightClickTime = now;

                if (this.voiceCommandManager.isVoiceEnabled) {
                    this.voiceCommandManager.speak(this.gameController.currentWord);
                } else {
                    photoGameManager.playCurrentImageSound();
                }
            }
        });

        // Crea dinamicamente il pulsante CLEAR senza modificare la struttura del layout
        try {
            const optsArea = this.shadowRoot.querySelector('#ipa-options-area');
            if (optsArea && !this.shadowRoot.querySelector('#clear-button')) {
                const clearBtn = document.createElement('button');
                clearBtn.id = 'clear-button';
                clearBtn.textContent = 'CLEAR';
                optsArea.appendChild(clearBtn);
                clearBtn.addEventListener('click', () => this.performHardReset());
            }
        } catch {}

        // Listener per elementi dinamici (Cupido, Omino Perplesso) per generare nuove frasi
        this.shadowRoot.addEventListener('click', (event) => {
            if (event.target.classList.contains('cupid-indicator') || 
                event.target.classList.contains('perplexed-indicator')) {
                event.stopPropagation();
                this.runPerplexedPhraseSequence();
            }
        });

        // Quando si esce con il mouse dall'immagine a gioco completato,
        // rimuovi l'impallidimento così al prossimo click tornerà a impallidire e mostrare le frasi.
        this.randomImageElement.addEventListener('mouseleave', () => {
            if (this.gameController.isWordComplete && this.gameController.isIpaComplete) {
                this.randomImageElement.style.opacity = '1';
                this.randomImageElement.style.cursor = 'pointer';
            }
        });

        // Aggiunge un listener per riprodurre i suoni quando si clicca sulla frase
        this.phraseDisplayArea.addEventListener('click', (event) => {
            // Controlla se è stato cliccato una parola interattiva
            const wordTarget = event.target.closest('.word-interactive');
            if (wordTarget && wordTarget.dataset.word) {
                event.stopPropagation();
                const word = wordTarget.dataset.word;
                // Usa sempre la sintesi vocale per le parole singole della frase
                // Questo evita errori 404 per file audio mancanti in 'simboparolasingola'
                // e garantisce un feedback immediato.
                const utterance = this.voiceCommandManager.speak(word);
                if (!utterance) {
                    // Fallback estremo se TTS non va (es. browser vecchi)
                    console.warn('TTS non disponibile per:', word);
                }
                return;
            }

            // Se abbiamo dati per la frase completa (siamo in fase post-game), riavvia l'animazione completa
            if (this.animationManager && this.animationManager.lastAnimatePhraseArgs && this.phraseDisplayArea.dataset.sound) {
                const { phraseText, phraseSoundUrl, translationText } = this.animationManager.lastAnimatePhraseArgs;
                this.animationManager.animateFullPhrase(phraseText, phraseSoundUrl, translationText);
                return;
            }

            // Se l'area della frase ha un suono associato (quello della frase intera)
            if (this.phraseDisplayArea.dataset.sound) {
                if (this.voiceCommandManager.isVoiceEnabled) {
                    const text = this.phraseDisplayArea.textContent;
                    this.voiceCommandManager.speak(text);
                } else {
                    window.soundDispatcher.playSound(this.phraseDisplayArea.dataset.sound);
                }
            } else if (event.target.classList.contains('pulse-word')) { // Altrimenti, se si clicca sulla parola, riproduci il suono della parola
                if (this.voiceCommandManager.isVoiceEnabled) {
                    this.voiceCommandManager.speak(this.gameController.currentWord);
                } else {
                    photoGameManager.playCurrentImageSound();
                }
            }
        });

        // Usiamo la delegazione di eventi per gestire i click sui simboli IPA
        this.ipaOptionsArea.addEventListener('click', (event) => {
            // Supporta click su elementi annidati (es. img dentro l'opzione)
            const clickedEl = event.target.closest('.ipa-option-symbol');
            if (!clickedEl) return;

            // In modalità pratica post-partita: il click su un'opzione deve far sentire la pronuncia
            if (this.gameController.isWordComplete && this.gameController.isIpaComplete) {
                event.stopPropagation();
                this.stopSuggestions(); // Ferma frecce e pulsazioni quando si fa una scelta
                const symbol = clickedEl.dataset.symbol;
                // Gestione speciale per SILENT
                if (symbol === 'SILENT') {
                    const sorrySound = `${this.getAssetPrefix()}Audio/Tastiere/tunoncanti.wav`;
                    window.soundDispatcher.playSound(sorrySound);
                    const optImg = clickedEl.querySelector('img');
                    if (optImg) {
                        optImg.classList.add('midispiace-pulse');
                        setTimeout(() => optImg.classList.remove('midispiace-pulse'), 700);
                    }
                    return;
                }

                const soundPath = this.phonemeSounds.get(symbol);
                const fullSoundPath = soundPath ? `${this.getAssetPrefix()}${soundPath}` : null;
                if (fullSoundPath) {
                    window.soundDispatcher.playSound(fullSoundPath);
                    // Dopo aver ascoltato la pronuncia, anima la frase associata al simbolo
                    const phraseEntry = symbolPhrases[symbol];
                    if (phraseEntry && phraseEntry.words && phraseEntry.fullPhraseSound) {
                        const phraseText = phraseEntry.words.map(w => w.text).join(' ').trim();
                        const phraseSoundUrl = `${this.getAssetPrefix()}${phraseEntry.fullPhraseSound}`;
                        const translationText = phraseEntry.translation || null;
                        // Avvia l'animazione dopo la durata della pronuncia
                        this.animationManager && this.animationManager.getAudioDuration(fullSoundPath)
                            .then((dur) => {
                                const ms = (isFinite(dur) && dur > 0) ? dur * 1000 : 600;
                                setTimeout(() => {
                                    if (this.animationManager && !this.animationManager.floatingInProgress) this.animationManager.animateFloatingPhrase(phraseText, phraseSoundUrl, translationText, phraseEntry.words);
                                }, ms);
                            })
                            .catch(() => {
                                // Fallback: avvia subito l'animazione
                                if (this.animationManager && !this.animationManager.floatingInProgress) this.animationManager.animateFloatingPhrase(phraseText, phraseSoundUrl, translationText, phraseEntry.words);
                            });
                    }
                }
                return;
            }

            // Durante il gioco normale: gestisci la logica di inserimento simboli
            if (clickedEl.classList.contains('midispiace-option')) {
                const optImg = clickedEl.querySelector('img');
                if (optImg) {
                    optImg.classList.add('midispiace-pulse');
                    setTimeout(() => optImg.classList.remove('midispiace-pulse'), 700);
                }
            }
            this.handleSymbolClick(clickedEl);
        });

        // Listener per il click destro (preview audio) sulle opzioni IPA
        this.ipaOptionsArea.addEventListener('contextmenu', (event) => {
            const clickedEl = event.target.closest('.ipa-option-symbol');
            if (!clickedEl) return;

            event.preventDefault(); // Previene il menu contestuale del browser
            event.stopPropagation();

            const symbol = clickedEl.dataset.symbol;
            
            // Gestione speciale per SILENT
            if (symbol === 'SILENT') {
                const sorrySound = `${this.getAssetPrefix()}Audio/Tastiere/tunoncanti.wav`;
                window.soundDispatcher.playSound(sorrySound);
                const optImg = clickedEl.querySelector('img');
                if (optImg) {
                    optImg.classList.add('midispiace-pulse');
                    setTimeout(() => optImg.classList.remove('midispiace-pulse'), 700);
                }
                return;
            }

            const soundPath = this.phonemeSounds.get(symbol);
            const fullSoundPath = soundPath ? `${this.getAssetPrefix()}${soundPath}` : null;
            if (fullSoundPath) {
                window.soundDispatcher.playSound(fullSoundPath);
                // Feedback visivo "premuto"
                clickedEl.style.transition = 'transform 0.1s';
                clickedEl.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    clickedEl.style.transform = '';
                    clickedEl.style.transition = ''; 
                }, 150);
            }
        });

        // Listener sicuro per riprodurre i suoni al click sui box pieni
        this.shadowRoot.addEventListener('click', (event) => {
            // Cerca il box cliccato, che sia il box stesso o un suo figlio (es. lo span con la lettera)
            const clickedBox = event.target.closest('.letter-box, .ipa-box');
            
            // Procede solo se il box esiste, ha un suono e non è un click su un'opzione IPA
            if (clickedBox && clickedBox.dataset.sound && !event.target.closest('.ipa-option-symbol')) {
                window.soundDispatcher.playSound(clickedBox.dataset.sound);
                // Aggiunge un feedback visivo al click
                clickedBox.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                setTimeout(() => {
                    clickedBox.style.backgroundColor = 'transparent';
                }, 200);

                // Se si clicca una lettera SILENT, fai pulsare l'icona midispiace nell'opzione e nel box IPA corrispondente
                if (clickedBox.classList.contains('letter-box')) {
                    const index = Array.prototype.indexOf.call(this.wordArea.children, clickedBox);
                    if (index > -1 && this.correctIpaSequence && this.correctIpaSequence[index] === 'SILENT') {
                        const sorryOptionImg = this.ipaOptionsArea.querySelector('.midispiace-option img');
                        if (sorryOptionImg) {
                            sorryOptionImg.classList.add('midispiace-pulse');
                            setTimeout(() => sorryOptionImg.classList.remove('midispiace-pulse'), 700);
                        }
                        const ipaBox = this.ipaAnswerArea.children[index];
                        if (ipaBox) {
                            const ipaImg = ipaBox.querySelector('img');
                            if (ipaImg) {
                                ipaImg.classList.add('midispiace-pulse');
                                setTimeout(() => ipaImg.classList.remove('midispiace-pulse'), 700);
                            }
                        }
                    }
                }

                // Se si clicca direttamente un box IPA che contiene midispiace, pulsalo
                if (clickedBox.classList.contains('ipa-box')) {
                    const img = clickedBox.querySelector('img');
                    if (img) {
                        img.classList.add('midispiace-pulse');
                        setTimeout(() => img.classList.remove('midispiace-pulse'), 700);
                    }
                }

                // Se la sessione è conclusa, dopo la pronuncia avvia l'animazione della frase
                if (this.gameController.isWordComplete && this.gameController.isIpaComplete) {
                    let phraseText = null;
                    let phraseSoundUrl = null;
                    let translationText = null;
                    let phraseWords = null;

                    if (clickedBox.classList.contains('ipa-box')) {
                        const img = clickedBox.querySelector('img');
                        const span = clickedBox.querySelector('.main-text');
                        let symbol = img ? 'SILENT' : (span ? span.textContent : null);
                        if (symbol && symbol !== 'SILENT') {
                            // Se è una lettera maiuscola, cerca in letterPhrases, altrimenti in symbolPhrases
                            if (/^[A-Z]$/.test(symbol)) {
                                const entry = letterPhrases[symbol];
                                if (entry && entry.words && entry.fullPhraseSound) {
                                    phraseText = entry.words.map(w => w.text).join(' ').trim();
                                    phraseSoundUrl = `${this.getAssetPrefix()}${entry.fullPhraseSound}`;
                                    translationText = entry.translation || null;
                                    phraseWords = entry.words;
                                }
                            } else {
                                const entry = symbolPhrases[symbol];
                                if (entry && entry.words && entry.fullPhraseSound) {
                                    phraseText = entry.words.map(w => w.text).join(' ').trim();
                                    phraseSoundUrl = `${this.getAssetPrefix()}${entry.fullPhraseSound}`;
                                    translationText = entry.translation || null;
                                    phraseWords = entry.words;
                                }
                            }
                        }
                    } else if (clickedBox.classList.contains('letter-box')) {
                        const span = clickedBox.querySelector('.main-text');
                        const letter = span ? (span.textContent || '').toUpperCase() : null;
                        if (letter && /^[A-Z]$/.test(letter)) {
                            const entry = letterPhrases[letter];
                            if (entry && entry.words && entry.fullPhraseSound) {
                                phraseText = entry.words.map(w => w.text).join(' ').trim();
                                phraseSoundUrl = `${this.getAssetPrefix()}${entry.fullPhraseSound}`;
                                translationText = entry.translation || null;
                                phraseWords = entry.words;
                            }
                        }
                    }

                    if (phraseText && phraseSoundUrl) {
                        this.animationManager && this.animationManager.getAudioDuration(clickedBox.dataset.sound)
                            .then((dur) => {
                                const ms = (isFinite(dur) && dur > 0) ? dur * 1000 : 600;
                                setTimeout(() => {
                                    if (this.animationManager && !this.animationManager.floatingInProgress) this.animationManager.animateFloatingPhrase(phraseText, phraseSoundUrl, translationText, phraseWords);
                                }, ms);
                            })
                            .catch(() => {
                                if (this.animationManager && !this.animationManager.floatingInProgress) this.animationManager.animateFloatingPhrase(phraseText, phraseSoundUrl, translationText, phraseWords);
                            });
                    }
                }
            }
        });

        this.increaseTimeBtn.addEventListener('click', () => {
            this.adjustTime(5);
        });
        this.decreaseTimeBtn.addEventListener('click', () => {
            this.adjustTime(-5);
        });
        this.resetTimeBtn.addEventListener('click', () => {
            // Toggle timer: start if stopped, stop+reset if running
            if (this.gameTimer.isRunning()) {
                this.stopTimer();
                this.updateTimerDisplay();
                this.timerDisplay.classList.remove('times-up');
                this.resetTimeBtn.classList.add('pulse-animation');
            } else {
                this.startTimer();
                this.resetTimeBtn.classList.remove('pulse-animation');
            }
        });

        // Crea i visori a fianco dell'immagine
        this.visorManager.createVisors();
        // Imposta i binding hover delegati per aggiornare i visori
        this.visorManager.setupVisorHoverBindings();
        // Abilita hover globale (anche tastiere esterne) per focalizzazione
        this.visorManager.setupGlobalVisorHover();
        // Hook diretto sui tasti per eventi enter/leave affidabili
        this.visorManager.setupAlphabetKeyboardHover();
        this.visorManager.setupPhonemeKeyboardHover();
        // Mostra i simboli delle option keys nel visore di destra con gli stessi stili
        this.visorManager.setupOptionSymbolsHover();
        // Disabilita il global hover per evitare conflitti: vogliamo solo per-key
        this.visorManager.disableGlobalVisorHover();
        // Disabilita le hover grids laterali: l'utente desidera solo hover sui tasti
        this.visorManager.removeHoverGrids();
        // Attiva guard globale per nascondere i visori quando il puntatore esce dai tasti
        this.visorManager.setupGlobalVisorExitGuard();
        this.voiceCommandManager.setupVoiceCommands();
        // Assicura che il bottone SINTESI sia visibile fin dall'inizio
        this.voiceCommandManager.updateVoiceIndicatorBasedOnState();

        // CRUCIALE: Aggiorna il riferimento del componente nel manager ALLA FINE.
        // Questo evita che il manager avvii giochi automatici (es. startGame) prima che l'inizializzazione sia completa e pulita.
        if (photoGameManager) {
            if (!started) {
                photoGameManager.currentImageData = null; // Pulisce dati residui per evitare avvii automatici
            }
            photoGameManager.photoGameComponent = this;
        }

        // Sicurezza finale: se non siamo in gioco, simula un click su CLEAR per pulire tutto
        if (!started) {
            // Esegui la logica di CLEAR ma senza toccare il microfono (che è stato appena avviato)
            this.clearBoard();
            this.setImage('');
            
            this.voiceCommandManager.isPracticeButtonActive = false;
            const practiceIndicator = this.shadowRoot.querySelector('#practice-indicator');
            if (practiceIndicator) practiceIndicator.classList.add('disabled');

            this.soundGameMode = false;
            this.isSoundGameActive = false;
            this.isPhotoGameActive = false;
            
            // Gestione cloni bottoni (reset stato visivo)
            try {
                const photoClone = document.getElementById('gamePhotoButton');
                if (photoClone) {
                    photoClone.classList.add('disabled-effect');
                }
                const soundClone = document.getElementById('gameSoundButton');
                if (soundClone) {
                    soundClone.classList.add('disabled-effect');
                }
            } catch {}

            this.practiceManager.enableSoundOnlyMode();
            
            try { if (photoGameManager && photoGameManager.stopAllSounds) photoGameManager.stopAllSounds(); } catch {}
        }
    }

    disconnectedCallback() {
        console.log('photo-game-component: disconnectedCallback called.');
        // Interrompe qualsiasi sintesi vocale in corso quando il componente viene rimosso
        if (voiceService) voiceService.cancelSpeech();
        this.stopTimer();
        this.voiceCommandManager.stopVoiceListening();
        if (this.feedbackObserver) this.feedbackObserver.disconnect();
        if (this.menuBtnObserver) this.menuBtnObserver.disconnect();
        this.uiManager.hidePhoneticTooltip();
        this.deactivate();
    }

    /**
     * Esegue un "Hard Reset" dell'interfaccia e dello stato del gioco,
     * simulando il click sul pulsante CLEAR o il comando vocale "CLEAR".
     */
    performHardReset() {
        try { if (photoGameManager.stopAllSounds) photoGameManager.stopAllSounds(); } catch {}
        this.clearBoard();
        this.setImage('');

        this.voiceCommandManager.isVoiceEnabled = false;
        this.voiceCommandManager.isListening = false;
        this.voiceCommandManager.stopVoiceListening();
        
        // --- HARD RESET: Master Mic OFF (Red Light) ---
        this.voiceCommandManager.isAlwaysListeningEnabled = false;
        const commandLight = this.shadowRoot.querySelector('#command-light');
        if (commandLight) commandLight.classList.remove('active');

        // --- HARD RESET: TTS OFF ---
        this.voiceCommandManager.ttsEnabled = false;
        const ttsSelector = this.shadowRoot.querySelector('#tts-mode-selector');
        if (ttsSelector) ttsSelector.classList.remove('active');

        // --- HARD RESET: Feedback Mode Clear (C) ---
        this.voiceCommandManager.keepFeedbackMode = false;
        const feedbackSelector = this.shadowRoot.querySelector('#feedback-mode-selector');
        if (feedbackSelector) {
            feedbackSelector.classList.remove('keep-active');
            const span = feedbackSelector.querySelector('span');
            if (span) span.textContent = 'C';
        }

        this.voiceCommandManager.updateVoiceIndicator('disabled');

        this.voiceCommandManager.isPracticeButtonActive = false;
        const practiceIndicator = this.shadowRoot.querySelector('#practice-indicator');
        if (practiceIndicator) practiceIndicator.classList.add('disabled');

        const dictationIndicator = this.shadowRoot.querySelector('#dictation-indicator');
        if (dictationIndicator) dictationIndicator.classList.add('disabled');
        this.resetDictationBox(true); // Forza il reset anche se la dettatura era attiva

        // Disaccoppia tutte le modalità
        this.soundGameMode = false;
        this.isSoundGameActive = false;
        this.isPhotoGameActive = false;
        try {
            const photoClone = document.getElementById('gamePhotoButton');
            if (photoClone) photoClone.classList.add('disabled-effect');
            const soundClone = document.getElementById('gameSoundButton');
            if (soundClone) soundClone.classList.add('disabled-effect');
        } catch {}
        // Abilita la selezione globale: clic su lettera/simbolo avvia un nuovo gioco
        this.practiceManager.enableSoundOnlyMode();
    }

    toggleDictationMode() {
        const btn = this.shadowRoot.querySelector('#dictation-indicator');
        if (btn) {
            if (btn.classList.contains('disabled')) {
                btn.classList.remove('disabled');
                this.isDictationActive = true;
                this._capitalizeNextDictationWord = true;
            } else {
                btn.classList.add('disabled');
                this.isDictationActive = false;
                this.resetDictationBox();
            }
        }
    }

    /**
     * Aggiorna il contenitore della dettatura con il testo riconosciuto.
     * @param {string} text - Il testo corrente (interim o final).
     * @param {boolean} isFinal - True se il risultato del riconoscimento è definitivo.
     */
    updateDictationBox(text, isFinal) {
        const dictationBox = this.shadowRoot.querySelector('#dictation-box');
        const dictationText = this.shadowRoot.querySelector('#dictation-text');
        if (!dictationBox || !dictationText) return;

        dictationBox.style.display = 'flex';

        // 1. Processa i comandi vocali per la punteggiatura
        // Fase 1: Sostituisci le parole chiave con la punteggiatura, senza toccare i caratteri circostanti.
        // Questo rende la sostituzione più affidabile.
        let processedText = text
            .replace(/\bVIRGOLA\b/gi, ',')
            .replace(/\bPUNTO\b/gi, '.')
            .replace(/\bFULL STOP\b/gi, '.')
            .replace(/\bCOMMA\b/gi, ','); // Corretto errore di battitura

        // Fase 2: Pulizia semplice e mirata di caratteri spuri noti (es. graffe)
        processedText = processedText.replace(/[{}]/g, '');

        if (isFinal) {
            // Consolida il testo finale
            let textToAdd = processedText.trim();
            if (!textToAdd) {
                this._lastObservedDictationText = null;
                return;
            }

            // --- NUOVA PREVENZIONE DUPLICAZIONE ---
            // Se un risultato finale identico è arrivato meno di 1.5 secondi fa, è un duplicato.
            // Questo risolve il problema del doppio evento "final" inviato da alcuni motori di riconoscimento.
            const now = Date.now();
            if (now - this._lastFinalDictationTime < 1500 && textToAdd.toLowerCase() === this._lastFinalDictationText.toLowerCase()) {
                console.warn(`[Dictation] Ignored duplicate final event (time-based): "${textToAdd}"`);
                this._lastObservedDictationText = null;
                return;
            }

            this._lastFinalDictationTime = now;
            this._lastFinalDictationText = textToAdd;

            // Salva lo stato corrente nella storia per l'undo
            this._dictationHistory.push(this.dictationContent);

            // Aggiungi uno spazio se il contenuto esistente non termina con uno spazio
            if (this.dictationContent.length > 0 && !/\s$/.test(this.dictationContent)) {
                this.dictationContent += ' ';
            }

            // Applica la maiuscola se necessario
            if (this._capitalizeNextDictationWord) {
                textToAdd = textToAdd.charAt(0).toUpperCase() + textToAdd.slice(1);
            }

            // Aggiungi il nuovo pezzo di testo
            this.dictationContent += textToAdd;

            // Pulisci gli spazi prima della punteggiatura, normalizza gli spazi multipli
            // e assicurati che ci sia uno spazio dopo la punteggiatura per la parola successiva.
            this.dictationContent = this.dictationContent.replace(/\s+([,.])/g, '$1').replace(/\s\s+/g, ' ').trim();
            if (/[.,]$/.test(this.dictationContent)) this.dictationContent += ' ';

            // Aggiorna il flag per la capitalizzazione della prossima frase
            if (this.dictationContent.trim().endsWith('.')) {
                this._capitalizeNextDictationWord = true;
            } else {
                this._capitalizeNextDictationWord = false;
            }

            dictationText.textContent = this.dictationContent;
            this._lastObservedDictationText = null;
        } else {
            // Risultato provvisorio: mostra un'anteprima
            let preview = this.dictationContent;
            if (preview.length > 0 && !/\s$/.test(preview)) preview += ' ';
            if (this._capitalizeNextDictationWord) processedText = processedText.charAt(0).toUpperCase() + processedText.slice(1);
            preview += processedText;
            dictationText.textContent = preview.replace(/\s+([,.])/g, '$1').replace(/\s\s+/g, ' ').trimStart();
        }
        // Scrolla automaticamente in fondo per mostrare il testo più recente
        dictationText.scrollTop = dictationText.scrollHeight;
    }

    /**
     * Pulisce e nasconde il contenitore della dettatura.
     * @param {boolean} force - Se true, esegue il reset anche se la dettatura è attiva.
     */
    resetDictationBox(force = false) {
        // Previene un reset accidentale (es. cambio lingua) se la dettatura è in corso.
        // Il reset viene eseguito solo se forzato (da Hard Reset) o se la dettatura è spenta.
        if (!force && this.isDictationActive) {
            console.warn('[Dictation] Reset prevented while active.');
            return;
        }

        const dictationBox = this.shadowRoot.querySelector('#dictation-box');
        const dictationText = this.shadowRoot.querySelector('#dictation-text');
        if (dictationBox) {
            this.isDictationActive = false; // Assicura che lo stato sia disattivato
            if (dictationText) dictationText.textContent = '';
            dictationBox.style.display = 'none';
        }
        this.dictationContent = '';
        this._dictationHistory = [];
        this._lastObservedDictationText = null;
        this._lastDictationEventTime = 0;
        this._lastFinalDictationTime = 0;
        this._lastFinalDictationText = '';
        this._capitalizeNextDictationWord = true;
    }

    deactivate() {
        console.log('photo-game-component: deactivate called.');
        // Scrive nel localStorage che il gioco è stato disattivato dall'utente.
        localStorage.setItem('photoGameStatus', 'off');

        // Pulisce la board mantenendo lo stato della modalità corrente (photo/sound)
        this.clearBoard(false);
        this.setImage('');
        this.stopTimer();
        this.voiceCommandManager.stopVoiceListening();

        const reconstructionAreas = this.shadowRoot.querySelector('#reconstruction-areas');
        if (reconstructionAreas) reconstructionAreas.style.display = 'none';

        const errorCounters = this.shadowRoot.querySelector('#error-counters');
        if (errorCounters) errorCounters.style.display = 'none';

        this.dispatchEvent(new CustomEvent('game-deactivated', { bubbles: true, composed: true }));
    }

    /**
     * Riattiva l'interfaccia del gioco. Chiamato dall'esterno.
     */
    activate() {
        console.log('photo-game-component: activate called.');
        const reconstructionAreas = this.shadowRoot.querySelector('#reconstruction-areas');
        if (reconstructionAreas) {
            reconstructionAreas.style.display = ''; // Usa una stringa vuota per ripristinare il valore di default (flex)
        }
        const errorCounters = this.shadowRoot.querySelector('#error-counters');
        if (errorCounters) {
            errorCounters.style.display = 'flex';
        }
        
        // Assicura che il gioco non parta automaticamente e la scena sia pulita
        this._blockAutoStart = true;
        this.isPhotoGameActive = false;
        this.clearBoard();
        this.setImage('');
        this.randomImageElement.classList.add('is-inactive');
        if (voiceService) voiceService.cancelSpeech();
        try { if (photoGameManager && photoGameManager.stopAllSounds) photoGameManager.stopAllSounds(); } catch {}
    }

    async loadGameData() {
        try {
            // Carica tutti i dati tramite il servizio dedicato
            const data = await gameDataService.loadAllGameData();
            const gameServiceData = await gameDataService.loadAllGameData();
            
            this.phonemeStyles = data.phonemeStyles;
            this.phonemeSounds = data.phonemeSounds;
            this.phonemeInfo = data.phonemeInfo;
            this.allPhonemes = data.allPhonemes;
            this.letterStyles = data.letterStyles;
            this.letterInfo = data.letterInfo;
            this.allWordsData = data.allWordsData;
            this.phonemeStyles = gameServiceData.phonemeStyles;
            this.phonemeSounds = gameServiceData.phonemeSounds;
            this.phonemeInfo = gameServiceData.phonemeInfo;
            this.allPhonemes = gameServiceData.allPhonemes;
            this.letterStyles = gameServiceData.letterStyles;
            this.letterInfo = gameServiceData.letterInfo;

            // NUOVO: Carica il database JSON completo al posto di commonWords.js
            const wordsDataPath = this.getAssetPrefix() + 'data/database_words_complete.json';
            const response = await fetch(wordsDataPath);
            if (!response.ok) throw new Error(`Failed to fetch word database: ${response.statusText}`);
            this.allWordsData = await response.json();
            
            // Pulizia globale dei dati fonetici (rimuove tutti gli slash /)
            if (Array.isArray(this.allWordsData)) {
                this.allWordsData.forEach(w => {
                    if (w.fullPhonetic) w.fullPhonetic = w.fullPhonetic.replace(/\//g, '');
                });
            }
            
            // Crea un Set per la ricerca rapida delle parole comuni
            this.commonWordsSet = new Set(this.allWordsData.map(w => w.text.toLowerCase()));
            console.log(`Caricato database con ${this.allWordsData.length} parole.`);

            // Inizializza il servizio fonetico con i fonemi caricati
            phoneticService.setValidPhonemes(this.allPhonemes);

        } catch (error) {
            console.error("Could not load game data (phonemes, letters, or words):", error);
        }
    }

    // Funzione chiamata dal manager per iniziare un nuovo turno
    startGame(wordData) {
        // BLOCCO DI SICUREZZA: Se l'avvio non è stato autorizzato (es. al reload), ferma tutto.
        if (this._blockAutoStart) {
            console.log('photo-game-component: startGame BLOCKED by _blockAutoStart flag.');
            return;
        }

        console.log('photo-game-component: startGame called with wordData:', wordData);
        // Disabilita eventuale selezione globale attiva post-CLEAR
        this.practiceManager.disableSelectionModeAfterStart();
        // Assicurati che l'interfaccia sia visibile prima di iniziare
        const reconstructionAreas = this.shadowRoot.querySelector('#reconstruction-areas');
        if (reconstructionAreas) {
            reconstructionAreas.style.display = ''; // Ripristina la visibilità
        }
        // Ripristina la visibilità anche dei contatori
        const errorCounters = this.shadowRoot.querySelector('#error-counters');
        if (errorCounters) {
            errorCounters.style.display = 'flex';
            reconstructionAreas.style.display = ''; // Ripristina la visibilità
        }
        // Preserva la modalità SOUND attraverso la pulizia iniziale
        const preserveSoundMode = !!(this.soundGameMode || this.isSoundGameActive);
        this.clearBoard();
        this._blockAutoStart = false; // Sblocca l'avvio dopo che clearBoard lo ha bloccato
        if (preserveSoundMode) {
            this.soundGameMode = true;
            this.isSoundGameActive = true;
        }
        // Non avviare automaticamente il timer: l'utente decide quando partire
        // this.timeLeft = this.selectedDuration; // Gestito da GameTimer
        this.updateTimerDisplay();
        this.timerDisplay.classList.remove('times-up');
        // Fai lampeggiare l'ingranaggio per indicare che avvia il timer
        this.resetTimeBtn.classList.add('pulse-animation');
        
        // Inizializza il turno nel controller
        this.gameController.initTurn(wordData);

        // --- INNESTO CORRETTIVO ---
        // La tua analisi è corretta: il problema è che la logica interna del gioco
        // non stava usando correttamente il campo `silentIndexes` del database.
        // Questa nuova funzione forza la creazione della sequenza fonetica corretta
        // basandosi sui dati del JSON e sovrascrive quella errata.
        const correctSequence = this._createSequenceFromData(wordData);
        if (correctSequence) {
            this.correctIpaSequence = correctSequence;
            this.correctIpaSet = new Set(correctSequence);
            
            // Se la parola è già completa (es. una sola lettera), dobbiamo forzare
            // l'aggiornamento dell'interfaccia con la sequenza corretta.
            if (this.gameController.isWordComplete) {
                this.onWordComplete(correctSequence);
            }
        }
        // --- FINE INNESTO ---

        const isPractice = !!wordData.isPracticeWord;

        // Mostra solo le letterboxes con gli aloni (delegato al controller che chiama createLetterBoxes)
        this.uiManager.createLetterBoxes(wordData.text);
        // Assicura che gli hover su nuove aree aggiornino i visori
        this.voiceCommandManager.startVoiceListening(); // Avvia l'ascolto per la ricostruzione della parola
        this.visorManager.setupVisorHoverBindings();
        // Sincronizza la dimensione delle celle hover con i box correnti
        this.visorManager.syncHoverCellSize();

        // Se è una parola di pratica, non mostrare l'immagine e avvia l'auto-spelling
        if (isPractice) {
            // Mostra l'immagine 'wordy.png' per la modalità pratica
            const wordyPath = `${this.getAssetPrefix()}img/wordy.png`;
            this.setImage(wordyPath);
            this.randomImageElement.style.display = 'block';
            // Rendi Wordy cliccabile per avviare la sequenza
            this.randomImageElement.style.cursor = 'pointer';
            this.randomImageElement.classList.add('suggestion-pulse'); // Fai pulsare Wordy per invitare al click
            this.randomImageElement.onclick = null; // Usa il listener globale in connectedCallback
            // Non avviare automaticamente l'auto-spelling. L'utente deve cliccare su Wordy.
        } else if (this.soundGameMode) {
            // SOUND-GAME: sostituisci l'immagine con again.png MA NON riprodurre il suono automaticamente
            const againPath = `${this.getAssetPrefix()}img/again.png`;
            this.setImage(againPath);
            // L'audio parte solo su comando vocale o interazione utente
        } else {
            // Modalità PHOTO normale: assicurati che l'immagine sia visibile
            this.randomImageElement.style.display = 'block';
        }
    }

    /**
     * @private
     * Genera la sequenza di simboli IPA corretta per la ricostruzione,
     * usando `silentIndexes` dal database per garantire l'accuratezza.
     * @param {object} wordData - L'oggetto dati della parola dal database.
     * @returns {string[]|null} L'array della sequenza fonetica corretta.
     */
    _createSequenceFromData(wordData) {
        let { text, fullPhonetic, silentIndexes } = wordData;

        if (!text || !fullPhonetic || !Array.isArray(silentIndexes)) {
            console.warn(`Dati incompleti per '${text}', impossibile generare la sequenza corretta.`);
            return null;
        }

        // FIX SPECIFICO: Correzione forzata per "mother" se i dati sono errati
        if (text.toLowerCase() === 'mother' && (!silentIndexes.includes(3) || !silentIndexes.includes(5))) {
            console.warn("Fixing silentIndexes for 'mother' (forcing [3, 5])");
            silentIndexes = [3, 5];
            wordData.silentIndexes = silentIndexes;
        }

        console.log(`[Fix] Genero sequenza per '${text}' (${fullPhonetic}) usando silentIndexes: [${silentIndexes.join(',')}]`);

        const letters = text.split('');
        const phonemes = phoneticService.parsePhoneticString(fullPhonetic);
        const silentSet = new Set(silentIndexes);
        
        const sequence = [];
        let phonemeCursor = 0;

        for (let i = 0; i < letters.length; i++) {
            if (silentSet.has(i)) {
                sequence.push('SILENT');
            } else {
                if (phonemeCursor < phonemes.length) {
                    sequence.push(phonemes[phonemeCursor]);
                    phonemeCursor++;
                } else {
                    console.warn(`Errore dati per '${text}': la lettera '${letters[i]}' (idx ${i}) non è muta ma non ci sono più fonemi disponibili.`);
                    sequence.push('?'); // Segnala un errore nei dati
                }
            }
        }

        if (phonemeCursor < phonemes.length) {
            console.warn(`Errore dati per '${text}': non tutti i fonemi sono stati consumati. Rimanenti: ${phonemes.slice(phonemeCursor).join(' ')}`);
        }
        
        return sequence;
    }

    createEmptyBoxes(word, ipaArray) {
        this.uiManager.createEmptyBoxes(word, ipaArray);
    }

    // Crea solo le letterboxes, con gli aloni colorati delle lettere previste
    createLetterBoxes(word) {
        this.uiManager.createLetterBoxes(word);
    }

    // Crea le IPA boxes in base alla sequenza corretta, con aloni/icone SILENT
    createIpaBoxes(ipaArray) {
        this.uiManager.createIpaBoxes(ipaArray);
    }
    
    setupIpaOptions() {
        this.uiManager.setupIpaOptions();
    }

    /**
     * Incrementa il contatore degli errori delle lettere e aggiorna l'interfaccia.
     * Chiamato dall'esterno (dal PhotoGameManager).
     * @param {number} letterIndex - L'indice della casella target da far pulsare.
     */
    incrementLetterError(letterIndex) {
        this.uiManager.incrementLetterError(letterIndex);
    }

    /**
     * Fa vibrare un elemento (usato per risposte sbagliate).
     * @param {HTMLElement} element - L'elemento da far vibrare.
     */
    shakeElement(element) {
        this.uiManager.shakeElement(element);
    }

    async handleSymbolClick(clickedEl) {
        this.visorManager.updateVisorFromOption(clickedEl);
        const clickedSymbol = clickedEl.dataset.symbol;
        let soundPath = this.phonemeSounds.get(clickedSymbol);

        const dataPath = window.location.pathname.includes('/games/') ? '../' : '';
        let fullSoundPath = soundPath ? `${dataPath}${soundPath}` : null;

        if (fullSoundPath) {
            window.soundDispatcher.playSound(fullSoundPath);
        }

        // Delega la logica al controller
        this.gameController.handleSymbolInteraction(clickedSymbol, clickedEl);
    }

    // --- Metodi chiamati dal GameController per aggiornare la UI ---
    animateSilentCorrect(clickedEl, targetIndex) {
        // Implementazione volo faccina (midispiace)
        if (clickedEl) {
            const sourceImg = clickedEl.querySelector('img') || (clickedEl.tagName === 'IMG' ? clickedEl : null);
            const targetBox = this.ipaAnswerArea.children[targetIndex];
            
            if (sourceImg && targetBox) {
                const clone = sourceImg.cloneNode(true);
                clone.style.position = 'fixed'; // Usa fixed per uscire dallo shadow DOM clipping
                clone.style.zIndex = '10000';
                clone.style.transition = 'all 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                clone.style.pointerEvents = 'none';
                
                const sourceRect = sourceImg.getBoundingClientRect();
                const targetRect = targetBox.getBoundingClientRect();
                
                clone.style.width = `${sourceRect.width}px`;
                clone.style.height = `${sourceRect.height}px`;
                clone.style.left = `${sourceRect.left}px`;
                clone.style.top = `${sourceRect.top}px`;
                
                document.body.appendChild(clone);
                
                // Force reflow
                clone.getBoundingClientRect();
                
                // Target position (center of box)
                const targetWidth = targetRect.width * 0.8; 
                
                clone.style.left = `${targetRect.left + (targetRect.width - targetWidth) / 2}px`;
                clone.style.top = `${targetRect.top + (targetRect.height - targetWidth) / 2}px`;
                clone.style.width = `${targetWidth}px`;
                clone.style.height = `${targetWidth}px`;

                // Funzione di pulizia sicura
                const cleanup = () => {
                    clone.remove();
                    
                    // FIX: Inserisci l'immagine finale nel box per renderla permanente
                    targetBox.innerHTML = '';
                    const finalImg = document.createElement('img');
                    finalImg.src = sourceImg.src;
                    finalImg.alt = 'mi dispiace';
                    finalImg.style.width = '100%';
                    finalImg.style.height = '100%';
                    finalImg.style.objectFit = 'contain';
                    finalImg.style.display = 'block';
                    
                    targetBox.appendChild(finalImg);
                    targetBox.style.background = 'transparent';
                    targetBox.style.opacity = '1';
                    targetBox.style.visibility = 'visible';
                    
                    const sorrySound = `${this.getAssetPrefix()}Audio/Tastiere/tunoncanti.wav`;
                    targetBox.dataset.sound = sorrySound;
                };

                clone.addEventListener('transitionend', cleanup);
                // Fallback di sicurezza nel caso l'evento transitionend non parta (es. tab in background)
                setTimeout(cleanup, 1600);
            }
        }
    }

    hideSilentOption() {
        const sorryOption = this.ipaOptionsArea.querySelector('.midispiace-option');
        if (sorryOption) sorryOption.classList.add('hidden');
    }

    async animateSymbolCorrect(clickedEl, targetIndex, clickedSymbol) {
        // SICUREZZA: Se il simbolo è SILENT, forza l'uso dell'animazione specifica
        // Questo risolve il caso in cui il controller chiami genericamente animateSymbolCorrect
        if (clickedSymbol === 'SILENT') {
            this.animateSilentCorrect(clickedEl, targetIndex);
            return;
        }
        if (this.animationManager) this.animationManager.animateSymbolCorrect(clickedEl, targetIndex, clickedSymbol);
    }

    flyLetterToBox(sourceKey, letterIndex, durationInSeconds, soundPath, char = null) {
        const prom = this.animationManager ? this.animationManager.flyLetterToBox(sourceKey, letterIndex, durationInSeconds || 1.5, soundPath, char) : Promise.resolve();
        this._currentFlyPromise = prom;
        return prom;
    }

    updateErrorCounters() {
        this.uiManager.updateErrorCounters();
    }

    onIpaComplete() {
        this.uiManager.onIpaComplete();
        // Nascondi il bottone auto-solve quando i simboli sono completi
        const autoSolveBtn = this.shadowRoot.querySelector('#auto-solve-btn');
        if (autoSolveBtn) autoSolveBtn.style.display = 'none';
    }

    async notifyWordCompleted() {
        // Attendi che l'ultima lettera sia atterrata
        if (this._currentFlyPromise) {
            await this._currentFlyPromise;
        }
        // Aggiungi 1 secondo di pausa prima di mostrare le opzioni
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Delega al controller
        this.gameController.notifyWordCompleted();
    }

    onWordComplete(correctIpaSequence) {
        this.correctIpaSequence = correctIpaSequence;
        // Ora mostra le IPA boxes e prepara le options in base alla sequenza
        this.uiManager.createIpaBoxes(correctIpaSequence);
        this.uiManager.setupIpaOptions();
        
        // Mostra il bottone auto-solve quando la parola è completa e appaiono le opzioni
        const autoSolveBtn = this.shadowRoot.querySelector('#auto-solve-btn');
        if (autoSolveBtn) autoSolveBtn.style.display = 'block';
    }

    onGameComplete() {
            this.stopTimer(); // Ferma il timer quando il turno è completato
            this.showNextButton();
            this.setMaestrosVisible(true);
            this.setupHoverListeners(); // evidenziazioni a fine partita
            this.practiceManager.enablePractice();

            setTimeout(() => {
                this.uiManager.showPerplexedIndicator();
                this._perplexedModeActive = true;
            }, 1000);

            // SOUND-GAME: al termine della sessione, sostituisci again con l'immagine reale
            if (this.soundGameMode && photoGameManager && photoGameManager.currentImageData) {
                // Disattiva prima la modalità sound-game per consentire il cambio immagine immediato
                this.soundGameMode = false;
                const realImg = photoGameManager.currentImageData.img || '';
                this.setImage(realImg);
            }
        }

    showPerplexedIndicator() {
        this.uiManager.showPerplexedIndicator();
    }

    removePerplexedIndicator() {
        this.uiManager.removePerplexedIndicator();
    }

    stopSuggestions() {
        this.uiManager.stopSuggestions();
    }

    activateSuggestions() {
        this.uiManager.activateSuggestions();
    }

    createSuggestionArrows() {
        this.uiManager.createSuggestionArrows();
    }

    removeSuggestionArrows() {
        this.uiManager.removeSuggestionArrows();
    }

    async autoSpellCurrentWord() {
        // BUG FIX: In modalità pratica (Wordy), l'auto-spelling richiede SIA Mike CHE Pratica attivi.
        const isPracticeWord = photoGameManager && photoGameManager.currentImageData && photoGameManager.currentImageData.isPracticeWord;
        if (isPracticeWord) {
            if (!this.voiceCommandManager.isVoiceEnabled || !this.voiceCommandManager.isPracticeButtonActive) return;
        } else {
            // Comportamento standard
            if (!this.voiceCommandManager.isVoiceEnabled && !this.voiceCommandManager.isPracticeButtonActive) return;
        }

        if (!this.gameController.currentWord || this.gameController.isWordComplete || this.isAutoSpelling) {
            return;
        }
        this.isAutoSpelling = true;

        // Disabilita temporaneamente l'ascolto per evitare interferenze
        // FIX: Usa i flag di stato invece di isListening che potrebbe essere momentaneamente false
        const shouldResumeListening = this.voiceCommandManager.isVoiceEnabled || this.voiceCommandManager.isAlwaysListeningEnabled;
        if (this.voiceCommandManager.isListening) {
            this.voiceCommandManager.stopVoiceListening();
        }

        // Disabilita il click sull'immagine durante l'auto-spelling
        this.randomImageElement.style.pointerEvents = 'none';

        // --- NUOVA LOGICA: Riproduci il suono della parola e attendi la fine ---
        await new Promise(async (resolve) => {
            // Priorità al file audio WAV se esiste, anche se la voce è attiva
            const soundUrl = photoGameManager.currentImageData ? photoGameManager.currentImageData.wordSound : null;
            
            if (soundUrl) {
                photoGameManager.playCurrentImageSound();
                try {
                    const duration = await this.getAudioDuration(soundUrl);
                    const waitTime = (isFinite(duration) && duration > 0) ? (duration * 1000) + 100 : 1500;
                    setTimeout(resolve, waitTime);
                } catch (e) {
                    setTimeout(resolve, 1500); // Fallback
                }
            } else if (this.voiceCommandManager.isVoiceEnabled) {
                const utterance = this.voiceCommandManager.speak(this.gameController.currentWord);
                if (utterance) {
                    utterance.addEventListener('end', resolve, { once: true });
                    utterance.addEventListener('error', resolve, { once: true }); // Non bloccare il gioco in caso di errore TTS
                } else {
                    resolve(); // Prosegui se TTS non è disponibile
                }
            } else {
                resolve();
            }
        });

        const letters = Array.from(this.gameController.currentWord);
        for (const letter of letters) {
            // Se il gioco viene resettato o completato nel frattempo, interrompi
            if (this.gameController.isWordComplete || !this.gameController.currentWord) break;

            this.visorManager.hideVisor('letter');
            this.voiceCommandManager.processFoundChar(letter);
            
            // Attendi la fine dell'animazione di volo
            if (this._currentFlyPromise) await this._currentFlyPromise;

            // Leggera pausa dopo l'atterraggio, prima di far partire la lettera successiva
            const pause = letter === ' ' ? 200 : 1000;
            await new Promise(resolve => setTimeout(resolve, pause));
        }

        this.visorManager.hideVisor('letter');
        // Riabilita il click sull'immagine
        this.randomImageElement.style.pointerEvents = 'auto';

        // Riattiva l'ascolto se era attivo prima (preserva Always Listening anche se MIKE è OFF)
        if (shouldResumeListening) {
            this.voiceCommandManager.startVoiceListening();
        }
        this.isAutoSpelling = false;
    }

    async autoSolvePhonetics() {
        if (!this.gameController.isWordComplete || this.gameController.isIpaComplete) return;
        if (this._isAutoSolvingPhonetics) return;
        
        this._isAutoSolvingPhonetics = true;
        
        const sequence = this.correctIpaSequence;
        if (!sequence) {
            this._isAutoSolvingPhonetics = false;
            return;
        }

        const boxes = Array.from(this.ipaAnswerArea.children);
        
        for (let i = 0; i < boxes.length; i++) {
            if (this.gameController.isIpaComplete) break;

            const box = boxes[i];
            const isFilled = box.querySelector('.main-text') || box.querySelector('img:not(.silent-icon)');
            
            if (!isFilled) {
                const targetSymbol = sequence[i];
                const options = Array.from(this.ipaOptionsArea.querySelectorAll('.ipa-option-symbol'));
                const option = options.find(opt => opt.dataset.symbol === targetSymbol && !opt.classList.contains('hidden'));
                
                if (option) {
                    // Assicura che il visore appaia durante l'auto-soluzione
                    this.visorManager.updateVisorFromOption(option);
                    await this.handleSymbolClick(option);
                    await new Promise(r => setTimeout(r, 2000)); // Aumentato a 2.0s per completare l'animazione
                }
            }
        }
        
        this._isAutoSolvingPhonetics = false;
    }

    clearBoard(resetModes = true) {
        // Interrompe l'auto-spelling se in corso
        this.isAutoSpelling = false;
        this.randomImageElement.style.pointerEvents = 'auto';
        this.randomImageElement.onclick = null;
        if (this._usedPracticePhrases) this._usedPracticePhrases.clear();
        this._practiceState = null; // Reset stato pratica
        this._perplexedModeActive = false;

        // Chiudi e pulisci il menu Thesaurus
        this.thesaurusManager.closeThesaurusMenu();
        
        // Nascondi esplicitamente il bottone menu
        const menuBtn = this.shadowRoot.querySelector('#menu-button');
        if (menuBtn) {
            menuBtn.style.display = 'none';
        }
        
        // Nascondi il bottone auto-solve al reset
        const autoSolveBtn = this.shadowRoot.querySelector('#auto-solve-btn');
        if (autoSolveBtn) autoSolveBtn.style.display = 'none';

        const diffSelector = this.shadowRoot.querySelector('#difficulty-selector');
        if (diffSelector) diffSelector.style.display = 'none';

        phraseGeneratorService.resetHistory();
        
        // Nascondi feedback vocale e traduzione
        const feedback = this.shadowRoot.querySelector('#voice-feedback');
        if (feedback) {
            feedback.classList.remove('show');
            feedback.textContent = '';
            delete feedback.dataset.originalText;
        }
        if (this.voiceCommandManager) {
            this.voiceCommandManager._lastFeedbackText = null;
        }
        const translation = this.shadowRoot.querySelector('#voice-translation');
        if (translation) {
            translation.classList.remove('show');
            translation.textContent = '';
        }
        const langTrans = this.shadowRoot.querySelector('#voice-lang-translation');
        if (langTrans) {
            langTrans.classList.remove('show');
            langTrans.textContent = '';
            langTrans.style.display = ''; // Reset display
        }
        const engTrans = this.shadowRoot.querySelector('#voice-translation');
        if (engTrans) {
            engTrans.style.display = ''; // Reset display (remove flex)
        }
        this._lastTranslatedText = null;
        if (this._translationSpeakTimer) clearTimeout(this._translationSpeakTimer);
        if (this._translationDebounce) clearTimeout(this._translationDebounce);
        if (this._hideTranslationTimer) clearTimeout(this._hideTranslationTimer);
        if (this._typingInterval) clearInterval(this._typingInterval);
        if (this._fallbackTimer) clearInterval(this._fallbackTimer);
        if (this._phoneticTypingInterval) clearInterval(this._phoneticTypingInterval);

        this.setMaestrosVisible(false);
        this.wordArea.innerHTML = '';
        this.ipaAnswerArea.innerHTML = '';
        this.ipaAnswerArea.style.borderColor = ''; // Resetta il bordo di vittoria
        // Pulisce anche i visori per evitare residui
        if (this.visorManager) {
            this.visorManager.hideVisor('letter');
            this.visorManager.hideVisor('symbol');
        }

        // FIX: Assicura che le aree di gioco siano visibili dopo la pulizia
        const reconstructionAreas = this.shadowRoot.querySelector('#reconstruction-areas');
        if (reconstructionAreas) reconstructionAreas.style.display = '';
        const errorCounters = this.shadowRoot.querySelector('#error-counters');
        if (errorCounters) errorCounters.style.display = 'flex';

        if (this.animationManager) this.animationManager.lastAnimatePhraseArgs = null;
        this.phraseDisplayArea.style.pointerEvents = ''; // Ripristina il default (none)
        this.phraseDisplayArea.style.cursor = ''; // Ripristina il cursore default
        // Rimuove tutte le options IPA mantenendo il bottone CLEAR, se presente
        if (this.ipaOptionsArea) {
            const children = Array.from(this.ipaOptionsArea.children || []);
            children.forEach(child => {
                if (!(child.id === 'clear-button')) {
                    try { child.remove(); } catch {}
                }
            });
        }
        
        this.stopTimer(); // Assicura che il timer sia fermo prima di pulire
        this.gameController.reset();
        this.updateErrorCounters();

        this._blockAutoStart = true; // Blocca nuovi avvii automatici finché non c'è interazione

        // Annulla qualsiasi timeout di pulizia precedente per evitare conflitti
        if (this.animationManager) {
            this.animationManager.resetPhraseCycle(false);
        }
        const floatingAgainBtn = document.getElementById('floating-again-btn');
        if (floatingAgainBtn) floatingAgainBtn.remove();
        if (this.animationManager && this.animationManager._againArrow) {
            this.animationManager._againArrow.remove();
            this.animationManager._againArrow = null;
        }
        const floatingAgainArrow = document.getElementById('floating-again-arrow');
        if (floatingAgainArrow) floatingAgainArrow.remove();

        // Se è in corso la ricostruzione volante, NON toccare frase/traduzione per evitare scomparse
        if (this.animationManager && !this.animationManager.floatingInProgress) {
            // Fa svanire anche la traduzione
            const translationSpans = this.translationDisplayArea.querySelectorAll('span');
            if (translationSpans.length > 0) {
                translationSpans.forEach(span => {
                    span.style.opacity = '0';
                    span.style.transform = 'scale(0.5)';
                });
            }

            // Fa svanire la frase con un'animazione invece di cancellarla bruscamente.
            const phraseSpans = this.phraseDisplayArea.querySelectorAll('span');
            if (phraseSpans.length > 0) {
                phraseSpans.forEach(span => {
                    span.style.opacity = '0';
                    span.style.transform = 'scale(0.5)';
                });
                // Pulisce l'area solo dopo che l'animazione di scomparsa è terminata, salvando l'ID del timeout.
                this.animationManager.clearPhraseTimeoutId = setTimeout(() => {
                    this.phraseDisplayArea.innerHTML = '';
                    this.translationDisplayArea.innerHTML = '';
                }, 300); // 300ms è la durata della transizione definita nel CSS
            } else {
                this.phraseDisplayArea.innerHTML = ''; // Pulisce subito se non c'è nulla da animare
                this.translationDisplayArea.innerHTML = '';
                // Interrompe la sintesi vocale se si pulisce la board
                if (voiceService) voiceService.cancelSpeech();
            }
        }

        this.hideNextButton();
        // Ripristina l'aspetto dell'immagine per il nuovo turno
        this.randomImageElement.style.opacity = '1';
        this.randomImageElement.classList.remove('is-inactive');
        this.randomImageElement.classList.remove('pulse-image'); // Ferma l'animazione dell'immagine
        this.randomImageElement.style.cursor = 'pointer';
        this.randomImageElement.classList.remove('suggestion-pulse'); // Rimuove il suggerimento
        this.removeSuggestionArrows(); // Rimuove le frecce
        this.uiManager.removePerplexedIndicator(); // Rimuove l'omino perplesso
        this.stopSuggestions(); // Assicura che tutte le pulsazioni siano ferme

        // Disabilita pratica e rimuovi listener globale se presente
        this.practiceManager.disablePractice();
        // Disattiva completamente le modalità gioco solo se richiesto
        if (resetModes) {
            this.soundGameMode = false;
            this.isSoundGameActive = false;
            this.isPhotoGameActive = false;
            const clearBtn = this.shadowRoot.querySelector('#clear-button');
            if (clearBtn) clearBtn.classList.remove('suggestion-pulse');

            // --- HARD RESET: TTS OFF ---
            if (this.voiceCommandManager) {
                this.voiceCommandManager.ttsEnabled = false;
            }
            const ttsSelector = this.shadowRoot.querySelector('#tts-mode-selector');
            if (ttsSelector) ttsSelector.classList.remove('active');
        }
    }
    
    setImage(imageUrl) {
        if (!this.randomImageElement) return;

        // BLOCCO DI SICUREZZA: Se l'avvio automatico è bloccato e si tenta di impostare un'immagine (non vuota), ignora.
        if (imageUrl && this._blockAutoStart) {
            return;
        }

        // In modalità sound-game, forza l'immagine placeholder 'again.png' FINCHÉ il turno non è completo
        let finalUrl = imageUrl;
        if (this.soundGameMode && !(this.isWordComplete && this.isIpaComplete)) {
            finalUrl = `${this.getAssetPrefix()}img/again.png`;
        }
        this.randomImageElement.src = finalUrl || '';
        this.randomImageElement.style.display = finalUrl ? 'block' : 'none';
    }

    setMaestrosVisible(visible) {
        const typyBtn = this.shadowRoot.querySelector('#typy-maestro-btn');
        if (typyBtn) {
            typyBtn.style.display = visible ? 'block' : 'none';
        }
        const lookyBtn = this.shadowRoot.querySelector('#looky-maestro-btn');
        if (lookyBtn) {
            lookyBtn.style.display = visible ? 'block' : 'none';
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
            // Rimuove floating buttons/arrows se presenti
            const floatingAgainBtn = document.getElementById('floating-again-btn');
            if (floatingAgainBtn) floatingAgainBtn.remove();
            const floatingAgainArrow = document.getElementById('floating-again-arrow');
            if (floatingAgainArrow) floatingAgainArrow.remove();
            if (this._againArrow) {
                this._againArrow.remove();
                this._againArrow = null;
            }
            
            // FIX: Resetta flag floating e ferma suggerimenti per pulizia completa (Cupido, frecce, pulsazioni)
            if (this.animationManager) this.animationManager.floatingInProgress = false;
            this.stopSuggestions();

            // Pulisce la scena come CLEAR, ma NON termina la sessione di gioco
            try { if (photoGameManager.stopAllSounds) photoGameManager.stopAllSounds(); } catch {}
            this.clearBoard();
            this.setImage('');

            // Reset Microfono e Pratica (Hard Reset)
            this.voiceCommandManager.isVoiceEnabled = false;
            this.voiceCommandManager.isListening = false;
            this.voiceCommandManager.stopVoiceListening();
            this.voiceCommandManager.updateVoiceIndicator('disabled');
            setTimeout(() => {
                this.voiceCommandManager.setupVoiceCommands();
                this.voiceCommandManager.startVoiceListening();
            }, 100);

            this.voiceCommandManager.isPracticeButtonActive = false;
            const practiceIndicator = this.shadowRoot.querySelector('#practice-indicator');
            if (practiceIndicator) practiceIndicator.classList.add('disabled');

            this.isDictationActive = false;
            const dictationIndicator = this.shadowRoot.querySelector('#dictation-indicator');
            if (dictationIndicator) dictationIndicator.classList.add('disabled');
            this.resetDictationBox();

            // NON disaccoppia le modalità, il gioco continua
            // Avvia una nuova immagine random con aloni
            this.setMaestrosVisible(false);
            // Sblocca l'avvio automatico per il nuovo turno
            this._blockAutoStart = false;
            if (typeof photoGameManager !== 'undefined') {
                photoGameManager.showNextImage();
            }
        });
        this.nextButtonContainer.appendChild(nextButton);
    }

    hideNextButton() {
        if (this.nextButtonContainer) {
            const btn = this.nextButtonContainer.querySelector('#next-button');
            if (btn) btn.remove();
        }
    }

    setupHoverListeners() {
        const ipaBoxes = this.shadowRoot.querySelectorAll('#ipa-answer-area .ipa-box');
        const letterBoxes = this.shadowRoot.querySelectorAll('#word-reconstruction-area .letter-box');
        const nextButton = this.shadowRoot.querySelector('#next-button');

        if (!nextButton || nextButton.style.display === 'none') {
            return; // Do nothing if the next button isn't visible
        }

        ipaBoxes.forEach((box, index) => {
            const correspondingLetter = letterBoxes[index];

            box.addEventListener('mouseenter', () => {
                if (correspondingLetter) {
                    correspondingLetter.classList.add('flashing-letter');
                }

                // Se questa posizione è SILENT, fai pulsare l'icona midispiace
                if (this.correctIpaSequence && this.correctIpaSequence[index] === 'SILENT') {
                    // Pulsazione su eventuale icona midispiace nell'IPA box (se già posizionata)
                    const sorryImg = box.querySelector('img');
                    if (sorryImg) {
                        sorryImg.classList.add('midispiace-pulse');
                    }
                    // Evidenzia anche l'opzione midispiace nell'area opzioni
                    const sorryOption = this.ipaOptionsArea.querySelector('.midispiace-option');
                    if (sorryOption) {
                        sorryOption.classList.add('midispiace-highlight');
                        const optImg = sorryOption.querySelector('img');
                        if (optImg) optImg.classList.add('midispiace-pulse');
                    }
                }

                ipaBoxes.forEach((otherBox, otherIndex) => {
                    if (index !== otherIndex) {
                        otherBox.style.opacity = '0';
                        otherBox.style.pointerEvents = 'none';
                    }
                });
                letterBoxes.forEach((otherLetter, otherIndex) => {
                    if (index !== otherIndex) {
                        otherLetter.style.opacity = '0';
                        otherLetter.style.pointerEvents = 'none';
                    }
                });
            });

            box.addEventListener('mouseleave', () => {
                if (correspondingLetter) {
                    correspondingLetter.classList.remove('flashing-letter');
                }

                // Rimuove la pulsazione dall'icona midispiace (se presente)
                if (this.correctIpaSequence && this.correctIpaSequence[index] === 'SILENT') {
                    const sorryImg = box.querySelector('img');
                    if (sorryImg) {
                        sorryImg.classList.remove('midispiace-pulse');
                    }
                    const sorryOption = this.ipaOptionsArea.querySelector('.midispiace-option');
                    if (sorryOption) {
                        sorryOption.classList.remove('midispiace-highlight');
                        const optImg = sorryOption.querySelector('img');
                        if (optImg) optImg.classList.remove('midispiace-pulse');
                    }
                }
                
                ipaBoxes.forEach(otherBox => {
                    otherBox.style.opacity = '1';
                    otherBox.style.pointerEvents = 'auto';
                });
                letterBoxes.forEach(otherLetter => {
                    otherLetter.style.opacity = '1';
                    otherLetter.style.pointerEvents = 'auto';
                });
            });
        });

        // Aggiunge hover sui box delle lettere per far pulsare i simboli IPA correlati
        letterBoxes.forEach((letterBox, index) => {
            const correspondingIpaBox = ipaBoxes[index];

            letterBox.addEventListener('mouseenter', () => {
                // Invece di far pulsare la lettera, fai pulsare il simbolo IPA corrispondente
                const isSilent = this.correctIpaSequence && this.correctIpaSequence[index] === 'SILENT';
                if (correspondingIpaBox) {
                    if (isSilent) {
                        // Se è SILENT, fai pulsare l'immagine midispiace nel box IPA
                        const ipaImg = correspondingIpaBox.querySelector('img');
                        if (ipaImg) ipaImg.classList.add('midispiace-pulse');
                    } else {
                        // Altrimenti, fai pulsare il testo del simbolo IPA
                        const symbolSpan = correspondingIpaBox.querySelector('.main-text');
                        if (symbolSpan) symbolSpan.classList.add('flashing-letter');
                    }
                }

                // Se la posizione è SILENT, fai pulsare l'opzione midispiace nella lista opzioni
                if (isSilent) {
                    const sorryOption = this.ipaOptionsArea.querySelector('.midispiace-option');
                    if (sorryOption) {
                        sorryOption.classList.add('midispiace-highlight');
                        const sorryOptionImg = sorryOption.querySelector('img');
                        if (sorryOptionImg) {
                            sorryOptionImg.classList.add('midispiace-pulse');
                        }
                    }
                    // Mostra un tooltip discreto
                    this.showSilentTooltip(letterBox, '🤐');
                    // Nascondi l'immagine principale per evitare sovrapposizioni
                    if (this.randomImageElement) this.randomImageElement.style.opacity = '0';
                }

                // Opzionale: offusca gli altri box come per gli IPA
                ipaBoxes.forEach((otherBox, otherIndex) => {
                    if (index !== otherIndex) {
                        otherBox.style.opacity = '0';
                        otherBox.style.pointerEvents = 'none';
                    }
                });
                letterBoxes.forEach((otherLetter, otherIndex) => {
                    if (index !== otherIndex) {
                        otherLetter.style.opacity = '0';
                        otherLetter.style.pointerEvents = 'none';
                    }
                });
            });

            letterBox.addEventListener('mouseleave', () => {
                // Rimuovi la pulsazione dal simbolo IPA correlato
                if (correspondingIpaBox) {
                    const symbolSpan = correspondingIpaBox.querySelector('.main-text');
                    if (symbolSpan) symbolSpan.classList.remove('flashing-letter');
                    const ipaImg = correspondingIpaBox.querySelector('img');
                    if (ipaImg) ipaImg.classList.remove('midispiace-pulse');
                }

                // Rimuove la pulsazione dall'opzione midispiace
                if (this.correctIpaSequence && this.correctIpaSequence[index] === 'SILENT') {
                    const sorryOption = this.ipaOptionsArea.querySelector('.midispiace-option');
                    if (sorryOption) {
                        sorryOption.classList.remove('midispiace-highlight');
                        const sorryOptionImg = sorryOption.querySelector('img');
                        if (sorryOptionImg) {
                            sorryOptionImg.classList.remove('midispiace-pulse');
                        }
                    }
                }

                // Ripristina visibilità
                ipaBoxes.forEach(otherBox => {
                    otherBox.style.opacity = '1';
                    otherBox.style.pointerEvents = 'auto';
                });
                letterBoxes.forEach(otherLetter => {
                    otherLetter.style.opacity = '1';
                    otherLetter.style.pointerEvents = 'auto';
                });

                // Ripristina l'immagine principale e rimuovi il tooltip
                if (this.randomImageElement) this.randomImageElement.style.opacity = '1';
                const tip = letterBox.querySelector('.silent-tooltip');
                if (tip) tip.remove();
            });
        });
    }

    // Mostra un piccolo tooltip sopra il box passato, poi lo rimuove automaticamente
    showSilentTooltip(targetBox, text) {
        this.uiManager.showSilentTooltip(targetBox, text);
    }

    // Prefisso per asset quando il componente gira sotto /games/
    getAssetPrefix() {
        return window.location.pathname.includes('/games/') ? '../' : '';
    }

    // --- METODI DEL TIMER ---

    startTimer() {
        console.log(`Timer avviato.`);
        this.updateTimerDisplay();
        this.timerDisplay.classList.remove('times-up');
        this.gameTimer.start();
    }

    stopTimer() {
        this.gameTimer.stop();
        // Aggiorna il display per mostrare il tempo resettato
        this.updateTimerDisplay();
    }

    updateTimerDisplay() {
        const time = this.gameTimer.getTimeLeft();
        const minutes = Math.floor(time / 60);
        const seconds = time % 60;
        if (this.timerDisplay) {
            this.timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    adjustTime(amount) {
        this.gameTimer.adjust(amount);
        // Il callback onTick aggiornerà il display
    }

    handleTimeUp() {
        console.log("Tempo scaduto!");
        this.stopTimer();
        this.timerDisplay.classList.add('times-up');
        this.timerDisplay.textContent = "Time's Up!";

        // Disabilita le aree di interazione
        this.gameController.incrementTimeoutError();

        this.ipaOptionsArea.style.pointerEvents = 'none';
        // Potresti voler disabilitare anche la tastiera delle lettere qui

        // Mostra il pulsante "Next" dopo un breve ritardo
        setTimeout(() => {
            this.showNextButton();
        }, 2000);
    }

    async animateFullPhrase(phraseText, phraseSoundUrl, translationText) {
        if (this.animationManager) this.animationManager.animateFullPhrase(phraseText, phraseSoundUrl, translationText);
    }

    showCupid() {
        if (this.animationManager) this.animationManager.showCupid();
    }

    createFirework(x, y) {
        if (this.animationManager) this.animationManager.createFirework(x, y);
    }

    async animateFullPhrase(phraseText, phraseSoundUrl, translationText, seedWord, lang) {
        if (this.animationManager) this.animationManager.animateFullPhrase(phraseText, phraseSoundUrl, translationText, seedWord, lang);
    }

    showPhoneticTooltip(target, word) {
        this.uiManager.showPhoneticTooltip(target, word);
    }

    hidePhoneticTooltip() {
        this.uiManager.hidePhoneticTooltip();
    }

    renderJuSymbol(container) {
        this.uiManager.renderJuSymbol(container);
    }

    async handleVoiceTranslation(text) {
        // Genera un ID univoco per questa richiesta di traduzione
        this._translationRequestId = (this._translationRequestId || 0) + 1;
        const currentRequestId = this._translationRequestId;

        const isItalian = this.voiceCommandManager && this.voiceCommandManager.recognitionLang === 'it-IT';
        if (isItalian) {
            await this.handleItalianToEnglishFlow(text, currentRequestId);
            return;
        }
        
        const translation = await phraseGeneratorService.getItalianTranslation(text);
        const transEl = this.shadowRoot.querySelector('#voice-lang-translation');
        const feedbackEl = this.shadowRoot.querySelector('#voice-feedback');
        const voiceTransEl = this.shadowRoot.querySelector('#voice-translation');
        
        if (transEl && translation) {
            transEl.innerHTML = '';
            transEl.classList.add('show');
            transEl.style.transform = 'none';
            transEl.style.display = ''; // Reset display (in case it was hidden by IT->EN flow)
            transEl.style.left = ''; // Reset to CSS default
            
            // Nascondi la traduzione della frase di gioco (gialla) per evitare sovrapposizioni
            if (voiceTransEl) voiceTransEl.classList.remove('show');
            
            // Impedisci che il feedback originale scompaia prima del tempo
            if (this.voiceCommandManager && this.voiceCommandManager._feedbackTimeout) {
                clearTimeout(this.voiceCommandManager._feedbackTimeout);
            }
            if (feedbackEl) feedbackEl.classList.add('show');
            
            // Effetto macchina da scrivere lettera per lettera
            if (this._typingInterval) clearInterval(this._typingInterval);
            if (this._translationSpeakTimer) clearTimeout(this._translationSpeakTimer);
            if (this._hideTranslationTimer) clearTimeout(this._hideTranslationTimer);

            this._translationSpeakTimer = setTimeout(() => {
                const onComplete = () => {
                    if (this._hideTranslationTimer) clearTimeout(this._hideTranslationTimer);
                    this._hideTranslationTimer = setTimeout(() => {
                        if (this.voiceCommandManager && this.voiceCommandManager.keepFeedbackMode) {
                            return;
                        }
                        transEl.classList.remove('show');
                        if (feedbackEl) feedbackEl.classList.remove('show');
                        if (voiceTransEl) voiceTransEl.classList.remove('show');
                        this._lastTranslatedText = null;
                    }, 3000);
                };

                const startTyping = () => {
                    const chars = Array.from(translation);
                    let i = 0;
                    
                    if (this._typingInterval) clearInterval(this._typingInterval);
                    this._typingInterval = setInterval(() => {
                        if (feedbackEl) feedbackEl.classList.add('show');
                        if (i >= chars.length) {
                            clearInterval(this._typingInterval);
                            if (!voiceService) onComplete();
                            return;
                        }
                        const char = chars[i];
                        const span = document.createElement('span');
                        span.textContent = char;
                        
                        const style = this.letterStyles.get(char.toUpperCase());
                        if (style) {
                            if (style.color) span.style.color = style.color;
                            if (style.textShadow) span.style.textShadow = style.textShadow;
                            if (style.fontFamily) span.style.fontFamily = style.fontFamily;
                        }
                        
                        transEl.appendChild(span);
                        i++;
                    }, 50);
                };

                if (voiceService) {
                    startTyping();
                    voiceService.speak(translation, { 
                        lang: 'it-IT', 
                        onEnd: onComplete,
                        onError: onComplete
                    });
                } else {
                    startTyping();
                }
            }, 1000);
        }
    }

    async handleItalianToEnglishFlow(inputText, requestId, skipDelay = false, isAlreadyEnglish = false, onCompleteCallback = null, secondaryText = null) {
        // Assicura che la frase italiana rimanga visibile durante l'elaborazione
        const feedbackEl = this.shadowRoot.querySelector('#voice-feedback');
        const engTransEl = this.shadowRoot.querySelector('#voice-translation');
        const phonTransEl = this.shadowRoot.querySelector('#voice-lang-translation');

        // Pulisce subito per evitare sovrapposizioni o testo vecchio
        if (engTransEl) engTransEl.innerHTML = '';
        if (phonTransEl) phonTransEl.innerHTML = '';
        
        const keepFeedbackVisible = () => {
            if (feedbackEl && !isAlreadyEnglish) {
                feedbackEl.classList.add('show');
                if (this.voiceCommandManager && this.voiceCommandManager._feedbackTimeout) {
                    clearTimeout(this.voiceCommandManager._feedbackTimeout);
                }
            }
        };

        keepFeedbackVisible();

        let englishText = inputText;
        if (!isAlreadyEnglish) {
            englishText = await phraseGeneratorService.getEnglishTranslation(inputText);
        }
        if (!englishText) return;

        const words = englishText.trim().split(/\s+/);

        // Mappa delle forme deboli e eccezioni di pronuncia richieste
        const weakForms = new Map([
            ['a', 'ə'],
            ['an', 'ən'],
            ['and', 'ənd'],
            ['the', 'ðə'],
            ['for', 'fə'],
            ['from', 'frəm'],
            ['of', 'əv'],
            ['to', 'tə'],
            ['some', 'səm'],
            ['are', 'ɑː'],   // Richiesta: "ar"
            ['cat', 'kæt'],  // Richiesta: "æ"
            ['ball', 'bɔːl'], // Richiesta: "ɔ"
            ['call', 'kɔːl'], // Richiesta: "ɔ"
            ['is', 'z']      // Richiesta: "z"
        ]);

        const phoneticPromises = words.map(w => {
            const lowerWord = w.toLowerCase().replace(/[.,!?;:]/g, '');
            if (weakForms.has(lowerWord)) {
                return Promise.resolve(weakForms.get(lowerWord));
            }
            return this.voiceCommandManager.getPhonetic(w);
        });
        const phoneticsArray = await Promise.all(phoneticPromises);
        
        let symbolsToType = [];
        phoneticsArray.forEach((ph, idx) => {
            if (ph) {
                const syms = phoneticService.parsePhoneticString(ph);
                symbolsToType.push(...syms);
            }
            if (idx < phoneticsArray.length - 1) symbolsToType.push(' ');
        });

        // Log per trovare traduzione e trascrizione
        console.log("Traduzione Inglese:", englishText);
        console.log("Trascrizione Fonetica:", symbolsToType.join(''));

        // Ritardo per attendere la fine della registrazione
        if (!skipDelay) {
            // Usa un intervallo per forzare la visibilità durante l'attesa
            const keepAlive = setInterval(keepFeedbackVisible, 100);
            await new Promise(resolve => setTimeout(resolve, 1500));
            clearInterval(keepAlive);
        }

        // Verifica se questa richiesta è ancora valida (o se l'utente ha continuato a parlare)
        if (this._translationRequestId !== requestId) return;
        
        // Nascondi il feedback italiano prima di mostrare la traduzione
        // if (feedbackEl) feedbackEl.classList.remove('show');

        if (phonTransEl) {
            phonTransEl.style.display = 'none';
            phonTransEl.classList.remove('show');
        }

        // Clear timers
        if (this._typingInterval) clearInterval(this._typingInterval);
        if (this._phoneticTypingInterval) clearInterval(this._phoneticTypingInterval);
        if (this._translationSpeakTimer) clearTimeout(this._translationSpeakTimer);
        if (this._hideTranslationTimer) clearTimeout(this._hideTranslationTimer);
        if (this._fallbackTimer) clearInterval(this._fallbackTimer);

        // Setup UI for animation
        if (feedbackEl) {
            if (isAlreadyEnglish) {
                feedbackEl.classList.remove('show');
            } else {
                feedbackEl.classList.add('show');
            }
        }
        
        if (engTransEl) {
            engTransEl.innerHTML = '';
            engTransEl.classList.add('show');
            engTransEl.style.display = 'flex'; // Layout flessibile per i blocchi parola
            engTransEl.style.flexWrap = 'wrap';
            engTransEl.style.gap = '15px'; // Spazio tra le parole
            engTransEl.style.pointerEvents = 'auto'; // Abilita i click
            
            if (isAlreadyEnglish) {
                engTransEl.style.top = '95px';
                engTransEl.style.left = '135px';
            } else {
                engTransEl.style.top = '';
                engTransEl.style.left = '';
            }
        }

        // Stop any existing word animations
        if (this._wordAnimators) {
            this._wordAnimators.forEach(a => clearInterval(a));
        }
        this._wordAnimators = [];

        const tokens = englishText.match(/(\S+|\s+)/g) || [];
        const wordBlueprints = [];
        let wordIdx = 0;
        let charCountSoFar = 0;
        
        for (const token of tokens) {
            if (/^\s+$/.test(token)) {
                charCountSoFar += token.length;
                continue; 
            }

                const currentPhonetic = phoneticsArray[wordIdx];
                const currentWord = words[wordIdx];
                wordIdx++;

                // Crea il BLOCCO (Colonna: Parola sopra, Fonetica sotto)
                const block = document.createElement('div');
                block.style.display = 'flex';
                block.style.flexDirection = 'column';
                block.style.alignItems = 'center';

                // Elemento Parola (Sopra)
                const wordSpan = document.createElement('span');
                wordSpan.className = 'interactive-word';
                wordSpan.style.cursor = 'pointer';
                wordSpan.onclick = (e) => { 
                    e.stopPropagation(); 
                    this.voiceCommandManager.speak(currentWord); 
                };

                if (isAlreadyEnglish) {
                    Array.from(currentWord).forEach(char => {
                        const span = document.createElement('span');
                        span.textContent = char;
                        const style = this.letterStyles.get(char.toUpperCase());
                        if (style) {
                            if (style.color) span.style.color = style.color;
                            if (style.textShadow) span.style.textShadow = style.textShadow;
                            if (style.fontFamily) span.style.fontFamily = style.fontFamily;
                        } else {
                            span.style.color = '#ffd700';
                        }
                        wordSpan.appendChild(span);
                    });
                }
                
                // Elemento Fonetica (Sotto)
                const phonSpan = document.createElement('div');
                phonSpan.style.fontFamily = '"Times New Roman", serif';
                phonSpan.style.color = '#00ffff';
                phonSpan.style.fontSize = '1.2em'; // Raddoppiato
                phonSpan.style.marginTop = '2px';
                phonSpan.style.height = '1em'; // Riserva spazio

                // Highlight della trascrizione all'hover sulla parola
                wordSpan.onmouseenter = () => {
                    phonSpan.style.textShadow = '0 0 10px #00ffff, 0 0 20px #00ffff';
                    phonSpan.style.transform = 'scale(1.1)';
                    phonSpan.style.transition = 'all 0.2s ease';
                };
                wordSpan.onmouseleave = () => {
                    phonSpan.style.textShadow = 'none';
                    phonSpan.style.transform = 'scale(1)';
                };

                block.appendChild(wordSpan);
                block.appendChild(phonSpan);

                // Prepare Actions (Interleaved)
                const actions = [];
                const wordChars = isAlreadyEnglish ? [] : Array.from(token);
                let phonChars = [];
                if (currentPhonetic) {
                    phonChars = phoneticService.parsePhoneticString(currentPhonetic);
                    phonChars.unshift('/');
                    phonChars.push('/');
                }
                
                const maxLen = Math.max(wordChars.length, phonChars.length);
                for (let i = 0; i < maxLen; i++) {
                    if (i < wordChars.length) {
                        actions.push({ type: 'char', char: wordChars[i], parent: wordSpan, style: 'word' });
                    }
                    if (i < phonChars.length) {
                        actions.push({ type: 'char', char: phonChars[i], parent: phonSpan, style: 'phon' });
                    }
                }

                wordBlueprints.push({
                    block: block,
                    actions: actions,
                    startIndex: charCountSoFar,
                    animated: false
                });
                
                charCountSoFar += token.length;
        }

            const animateWord = (index) => {
                if (index >= wordBlueprints.length) return;
                const blueprint = wordBlueprints[index];
                if (blueprint.animated) return;
                
                blueprint.animated = true;
                engTransEl.appendChild(blueprint.block);
                
                let actionIdx = 0;
                const interval = setInterval(() => {
                    keepFeedbackVisible();
                    if (actionIdx >= blueprint.actions.length) {
                        clearInterval(interval);
                        return;
                    }
                    const action = blueprint.actions[actionIdx];
                    const span = document.createElement('span');
                    span.textContent = action.char;
                    
                    if (action.style === 'word') {
                        const style = this.letterStyles.get(action.char.toUpperCase());
                        if (style) {
                            if (style.color) span.style.color = style.color;
                            if (style.textShadow) span.style.textShadow = style.textShadow;
                            if (style.fontFamily) span.style.fontFamily = style.fontFamily;
                        } else {
                            span.style.color = '#ffd700';
                        }
                    } else {
                        const style = this.phonemeStyles.get(action.char);
                        if (style) {
                            if (style.color) span.style.color = style.color;
                            if (style.textShadow) span.style.textShadow = style.textShadow;
                        } else {
                            span.style.color = '#00ffff';
                        }
                    }
                    action.parent.appendChild(span);
                    
                    actionIdx++;
                }, 30);
                
                this._wordAnimators.push(interval);
            };

            const onComplete = () => {
                if (this._fallbackTimer) clearInterval(this._fallbackTimer);
                // Ensure all words are shown
                wordBlueprints.forEach((bp) => {
                    if (!bp.animated) {
                        bp.animated = true;
                        engTransEl.appendChild(bp.block);
                        bp.actions.forEach(action => {
                            const span = document.createElement('span');
                            span.textContent = action.char;
                            if (action.style === 'word') {
                                const style = this.letterStyles.get(action.char.toUpperCase());
                                if (style) {
                                    if (style.color) span.style.color = style.color;
                                    if (style.textShadow) span.style.textShadow = style.textShadow;
                                    if (style.fontFamily) span.style.fontFamily = style.fontFamily;
                                } else {
                                    span.style.color = '#ffd700';
                                }
                            } else {
                                const style = this.phonemeStyles.get(action.char);
                                if (style) {
                                    if (style.color) span.style.color = style.color;
                                    if (style.textShadow) span.style.textShadow = style.textShadow;
                                } else {
                                    span.style.color = '#00ffff';
                                }
                            }
                            action.parent.appendChild(span);
                        });
                    }
                });

                if (isAlreadyEnglish && secondaryText && phonTransEl) {
                    phonTransEl.innerHTML = '';
                    Array.from(secondaryText).forEach(char => {
                        const span = document.createElement('span');
                        span.textContent = char;
                        const style = this.letterStyles.get(char.toUpperCase());
                        if (style) {
                            if (style.color) span.style.color = style.color;
                            if (style.textShadow) span.style.textShadow = style.textShadow;
                            if (style.fontFamily) span.style.fontFamily = style.fontFamily;
                        } else {
                            span.style.color = '#ffd700';
                        }
                        phonTransEl.appendChild(span);
                    });
                    
                    phonTransEl.style.display = '';
                    phonTransEl.style.left = '';
                    phonTransEl.style.top = '';
                    phonTransEl.classList.add('show');
                }

                if (onCompleteCallback) onCompleteCallback();

                if (this._hideTranslationTimer) clearTimeout(this._hideTranslationTimer);
                this._hideTranslationTimer = setTimeout(() => {
                    if (this.voiceCommandManager && this.voiceCommandManager.keepFeedbackMode) return;
                    if (engTransEl) engTransEl.classList.remove('show');
                    if (phonTransEl) phonTransEl.classList.remove('show');
                    // if (feedbackEl) feedbackEl.classList.remove('show');
                    this._lastTranslatedText = null;
                }, 3000);
            };

            if (voiceService) {
                const utterance = voiceService.speak(englishText, { 
                    lang: 'en-GB', 
                    rate: 0.75,
                    rate: 0.65,
                    pitch: 1.4,
                    onEnd: onComplete,
                    onError: onComplete
                });
                if (utterance) {
                    utterance.onboundary = (event) => {
                        if (event.name === 'word') {
                            const charIndex = event.charIndex;
                            // Find the word that starts near this index
                            let bestIdx = -1;
                            for(let i=0; i<wordBlueprints.length; i++) {
                                if (wordBlueprints[i].startIndex <= charIndex + 1) {
                                    bestIdx = i;
                                } else {
                                    break;
                                }
                            }
                            if (bestIdx !== -1) {
                                // Ensure previous words are shown
                                for(let k=0; k<bestIdx; k++) animateWord(k);
                                animateWord(bestIdx);
                            }
                        }
                    };
                    utterance.onstart = () => {
                        animateWord(0);
                        // Pacer: forza la visualizzazione della parola successiva ogni 550ms se non è già apparsa
                        let pacerIdx = 1;
                        this._fallbackTimer = setInterval(() => {
                            if (pacerIdx >= wordBlueprints.length) {
                                clearInterval(this._fallbackTimer);
                                return;
                            }
                            if (!wordBlueprints[pacerIdx].animated) {
                                animateWord(pacerIdx);
                            }
                            pacerIdx++;
                        }, 450);
                    };
                } else {
                    // Fallback simulation
                    let wIdx = 0;
                    this._fallbackTimer = setInterval(() => {
                        if (wIdx >= wordBlueprints.length) {
                            clearInterval(this._fallbackTimer);
                            onComplete();
                            return;
                        }
                        animateWord(wIdx);
                        wIdx++;
                    }, 450);
                }
            } else {
                // No voice service fallback
                let wIdx = 0;
                this._fallbackTimer = setInterval(() => {
                    if (wIdx >= wordBlueprints.length) {
                        clearInterval(this._fallbackTimer);
                        onComplete();
                        return;
                    }
                    animateWord(wIdx);
                    wIdx++;
                }, 450);
            }
    }
}

customElements.define('photo-game-component', PhotoGameComponent);