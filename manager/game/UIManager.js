import { StyleUtils } from '../../services/StyleUtils.js';
import { GameLogicService } from '../../services/GameLogicService.js';
import { phoneticService } from '../../services/PhoneticService.js';

export class UIManager {
    constructor(component) {
        this.component = component;
        this._arrows = [];
        this._currentTooltip = null;
    }

    getAssetPrefix() {
        return this.component.getAssetPrefix();
    }

    // Helper per ottenere le aree in modo sicuro
    get wordArea() { return this.component.wordArea || this.component.shadowRoot?.querySelector('#word-reconstruction-area'); }
    get ipaAnswerArea() { return this.component.ipaAnswerArea || this.component.shadowRoot?.querySelector('#ipa-answer-area'); }
    get ipaOptionsArea() { return this.component.ipaOptionsArea || this.component.shadowRoot?.querySelector('#ipa-options-area'); }

    createEmptyBoxes(word, ipaArray) {
        if (!this.wordArea || !this.ipaAnswerArea) return;
        this.wordArea.innerHTML = '';
        this.ipaAnswerArea.innerHTML = '';

        if (word) {
            Array.from(word).forEach((char) => {
                const box = document.createElement('div');
                box.className = 'letter-box';
                const letterStyle = this.component.letterStyles.get(char.toUpperCase());
                if (letterStyle && letterStyle.color) {
                    try {
                        const color = letterStyle.color.startsWith('#') ? StyleUtils.hexToRgba(letterStyle.color, 0.6) : letterStyle.color;
                        box.style.background = `radial-gradient(circle, ${color} 20%, transparent 70%)`;
                    } catch (e) {
                        box.style.background = `radial-gradient(circle, rgba(255,255,255,0.3) 20%, transparent 70%)`;
                    }
                }
                this.wordArea.appendChild(box);
            });
        }
        if (ipaArray) {
            ipaArray.forEach((symbol) => {
                const box = document.createElement('div');
                box.className = 'ipa-box';
                if (symbol === 'SILENT') {
                    const img = document.createElement('img');
                    img.className = 'silent-icon';
                    img.src = `${this.getAssetPrefix()}img/midispiace.png`;
                    img.alt = 'lettera muta';
                    box.appendChild(img);
                    const sorrySound = `${this.getAssetPrefix()}Audio/Tastiere/tunoncanti.wav`;
                    box.dataset.sound = sorrySound;
                    box.addEventListener('mouseenter', () => {
                        this.component.visorManager.updateVisor('symbol', img, 'image', box);
                        const visor = this.component.visorManager.symbolVisor;
                        if (visor) {
                            const imgEl = visor.querySelector('.visor-image');
                            if (imgEl) {
                                imgEl.classList.remove('show');
                                imgEl.removeAttribute('src');
                            }
                        }
                    });
                    box.addEventListener('mouseleave', () => {
                        this.component.visorManager.hideVisor('symbol');
                    });
                } else if (symbol) {
                    box.setAttribute('data-symbol', symbol);
                    const soundPath = this.component.phonemeSounds.get(symbol);
                    if (soundPath) {
                        box.dataset.sound = `${this.getAssetPrefix()}${soundPath}`;
                    }
                    const symbolStyle = this.component.phonemeStyles.get(symbol);
                    if (symbolStyle && symbolStyle.color) {
                        const rgbaColor = StyleUtils.hexToRgba(symbolStyle.color, 0.6);
                        box.style.background = `radial-gradient(circle, ${rgbaColor} 20%, transparent 70%)`;
                    }
                    box.addEventListener('mouseenter', () => {
                        this.component.visorManager.updateVisorFromExternalText('symbol', symbol, box);
                    });
                    box.addEventListener('mouseleave', () => {
                        this.component.visorManager.hideVisor('symbol');
                    });
                }
                this.component.ipaAnswerArea.appendChild(box);
            });
        }
    }

    createLetterBoxes(word) {
        if (!this.component.wordArea) return;
        this.component.wordArea.innerHTML = '';
        if (!word) return;
        
        Array.from(word).forEach((char) => {
            const box = document.createElement('div');
            box.className = 'letter-box';
            
            if (char === ' ') {
                box.style.border = 'none';
                box.style.background = 'transparent';
            } else {
                const upperChar = char.toUpperCase();
                const letterStyle = this.component.letterStyles.get(upperChar);
                
                if (letterStyle) {
                    if (letterStyle.color) {
                        const rgbaColor = StyleUtils.hexToRgba(letterStyle.color, 0.6);
                        box.style.background = `radial-gradient(circle, ${rgbaColor} 20%, transparent 70%)`;
                        box.style.color = letterStyle.color;
                    }
                    if (letterStyle.fontFamily) box.style.fontFamily = letterStyle.fontFamily;
                    if (letterStyle.textShadow) box.style.textShadow = letterStyle.textShadow;
                } else {
                    // Fallback visibile se lo stile manca
                    box.style.background = `radial-gradient(circle, rgba(255,255,255,0.3) 20%, transparent 70%)`;
                }

                box.dataset.letter = upperChar;
                box.setAttribute('data-main-text', upperChar);
                const info = this.component.letterInfo.get(upperChar);
                if (info && info.sound) {
                    box.dataset.sound = `${this.getAssetPrefix()}${info.sound}`;
                }
                box.addEventListener('mouseenter', () => {
                    this.component.visorManager.updateVisorFromExternalText('letter', upperChar, box);
                });
                box.addEventListener('mouseleave', () => {
                    this.component.visorManager.hideVisor('letter');
                });
            }
            this.component.wordArea.appendChild(box);
        });
    }

    createIpaBoxes(ipaArray) {
        if (!this.component.ipaAnswerArea) return;
        this.component.ipaAnswerArea.innerHTML = '';
        if (!ipaArray || !Array.isArray(ipaArray)) return;
        
        ipaArray.forEach((symbol) => {
            const box = document.createElement('div');
            box.className = 'ipa-box';
            if (symbol === 'SILENT') {
                const img = document.createElement('img');
                img.className = 'silent-icon';
                img.src = `${this.getAssetPrefix()}img/midispiace.png`;
                img.alt = 'lettera muta';
                box.appendChild(img);
                const sorrySound = `${this.getAssetPrefix()}Audio/Tastiere/tunoncanti.wav`;
                box.dataset.sound = sorrySound;
                    box.addEventListener('mouseenter', () => {
                        this.component.visorManager.updateVisor('symbol', img, 'image', box);
                        const visor = this.component.visorManager.symbolVisor;
                        if (visor) {
                            const imgEl = visor.querySelector('.visor-image');
                            if (imgEl) {
                                imgEl.classList.remove('show');
                                imgEl.removeAttribute('src');
                            }
                        }
                    });
                    box.addEventListener('mouseleave', () => {
                        this.component.visorManager.hideVisor('symbol');
                    });
            } else if (symbol === ' ') {
                box.style.border = 'none';
                box.style.background = 'transparent';
            } else if (symbol) {
                box.setAttribute('data-symbol', symbol);
                const soundPath = this.component.phonemeSounds.get(symbol);
                if (soundPath) {
                    box.dataset.sound = `${this.getAssetPrefix()}${soundPath}`;
                }
                const symbolStyle = this.component.phonemeStyles.get(symbol);
                if (symbolStyle && symbolStyle.color) {
                    const rgbaColor = StyleUtils.hexToRgba(symbolStyle.color, 0.6);
                    box.style.background = `radial-gradient(circle, ${rgbaColor} 20%, transparent 70%)`;
                } else {
                    box.style.background = `radial-gradient(circle, rgba(255,255,255,0.3) 20%, transparent 70%)`;
                }
                    box.addEventListener('mouseenter', () => {
                        this.component.visorManager.updateVisorFromExternalText('symbol', symbol, box);
                    });
                    box.addEventListener('mouseleave', () => {
                        this.component.visorManager.hideVisor('symbol');
                    });
            }
            this.component.ipaAnswerArea.appendChild(box);
        });
    }

    setupIpaOptions() {
        if (!this.component.gameController.correctIpaSequence || this.component.allPhonemes.length === 0) return;

        const options = GameLogicService.generateIpaOptions(this.component.gameController.correctIpaSequence, this.component.allPhonemes);

        options.forEach(symbol => {
            const symbolEl = document.createElement('div');
            symbolEl.className = 'ipa-option-symbol';
            if (symbol.length >= 3) {
                symbolEl.classList.add('long-symbol');
            }

            if (symbol === 'ju:') {
                this.renderJuSymbol(symbolEl);
            } else {
                symbolEl.textContent = symbol;
            }
            symbolEl.dataset.symbol = symbol;
            
            const style = this.component.phonemeStyles.get(symbol);
            if (style && style.color) {
                symbolEl.style.color = style.color;
            }
            if (style && style.textShadow) {
                symbolEl.style.textShadow = style.textShadow;
            }
            symbolEl.style.borderColor = (style && style.borderColor) ? style.borderColor : '#ccc';

            this.component.ipaOptionsArea.appendChild(symbolEl);
        });

        const midispiaceSrc = `${this.getAssetPrefix()}img/midispiace.png`;
        const sorryEl = document.createElement('div');
        sorryEl.className = 'ipa-option-symbol midispiace-option';
        const img = document.createElement('img');
        img.src = midispiaceSrc;
        img.alt = 'mi dispiace';
        img.style.maxWidth = '80%';
        img.style.maxHeight = '80%';
        img.style.objectFit = 'contain';
        sorryEl.appendChild(img);
        sorryEl.dataset.symbol = 'SILENT';
        sorryEl.style.borderColor = '#ccc';
        this.component.ipaOptionsArea.appendChild(sorryEl);
    }

    incrementLetterError(letterIndex) {
        console.log(`Errore lettera registrato.`);
        this.component.gameController.incrementLetterError();
        this.updateErrorCounters();
    }

    showLetterErrorEffect(letterIndex) {
        const targetBox = this.component.wordArea.children[letterIndex];
        if (targetBox) {
            targetBox.classList.add('error-pulse');
            setTimeout(() => targetBox.classList.remove('error-pulse'), 800);
        }
    }

    shakeElement(element) {
        element.classList.add('shake');
        setTimeout(() => element.classList.remove('shake'), 500);
    }

    updateErrorCounters() {
        this.component.letterErrorsValueSpan.textContent = this.component.gameController.letterErrors;
        this.component.symbolErrorsValueSpan.textContent = this.component.gameController.symbolErrors;
        this.component.timeoutErrorsValueSpan.textContent = this.component.gameController.timeoutErrors;
    }

    onIpaComplete() {
        this.component.ipaAnswerArea.style.borderColor = 'lime';
        const remainingOptions = this.component.ipaOptionsArea.querySelectorAll('.ipa-option-symbol');
        remainingOptions.forEach(option => {
            if (!option.classList.contains('hidden')) {
                option.classList.add('hidden');
            }
        });
    }

    showPerplexedIndicator() {
        this.removePerplexedIndicator();
        const gameArea = this.component.shadowRoot.querySelector('#game-area');
        const ipaArea = this.component.ipaAnswerArea;
        if (!gameArea || !ipaArea) return;

        const overlay = document.createElement('div');
        overlay.id = 'perplexed-overlay';
        overlay.onclick = (e) => e.stopPropagation();
        gameArea.appendChild(overlay);

        const container = document.createElement('div');
        container.className = 'perplexed-indicator';
        container.innerHTML = '🤷<span style="position: absolute; top: -45px; left: 50%; transform: translateX(-40%); font-size: 45px; color: #ff00cc; text-shadow: 0 0 8px white;">❓</span>';
        const ipaRect = ipaArea.getBoundingClientRect();
        const gameRect = gameArea.getBoundingClientRect();
        container.style.top = `${ipaRect.bottom - gameRect.top + 80}px`;
        container.style.left = `${ipaRect.left - gameRect.left + ipaRect.width / 2}px`;
        container.style.transform = 'translateX(-50%)';

        container.onclick = (e) => {
            e.stopPropagation();
            this.removePerplexedIndicator();
            this.activateSuggestions();
            this.component._perplexedModeActive = true;
        };
        gameArea.appendChild(container);
    }

    removePerplexedIndicator() {
        const el = this.component.shadowRoot.querySelector('.perplexed-indicator');
        if (el) el.remove();
        const overlay = this.component.shadowRoot.querySelector('#perplexed-overlay');
        if (overlay) overlay.remove();
    }

    stopSuggestions() {
        this.removeSuggestionArrows();
        const pulsed = this.component.shadowRoot.querySelectorAll('.suggestion-pulse');
        pulsed.forEach(el => el.classList.remove('suggestion-pulse'));
    }

    activateSuggestions() {
        const letters = this.wordArea ? this.wordArea.querySelectorAll('.letter-box') : [];
        letters.forEach(el => el.classList.add('suggestion-pulse'));

        const symbols = this.ipaAnswerArea ? this.ipaAnswerArea.querySelectorAll('.ipa-box') : [];
        symbols.forEach(el => el.classList.add('suggestion-pulse'));

        this.component.randomImageElement.classList.add('suggestion-pulse');
        const nextBtn = this.component.shadowRoot.querySelector('#next-button');
        if (nextBtn) nextBtn.classList.add('suggestion-pulse');
        
        const clearBtn = this.component.shadowRoot.querySelector('#clear-button');
        if (clearBtn) clearBtn.classList.add('suggestion-pulse');

        this.createSuggestionArrows();
        this.component.voiceCommandManager.startVoiceListening();
    }

    createSuggestionArrows() {
        this.removeSuggestionArrows();
        this._arrows = [];

        const addArrow = (target, direction) => {
            if (!target) return;
            const arrowContainer = document.createElement('div');
            arrowContainer.className = 'suggestion-arrow';
            
            const char = '➳'; 
            let anim = 'arrow-bounce-v';
            let rotation = '90deg';
            
            if (direction === 'left') { rotation = '0deg'; anim = 'arrow-bounce-h'; }
            else if (direction === 'right') { rotation = '180deg'; anim = 'arrow-bounce-h'; }
            else if (direction === 'bottom') { rotation = '-90deg'; anim = 'arrow-bounce-v'; }
            
            arrowContainer.innerHTML = `<span style="display:block; transform: rotate(${rotation});">${char}</span>`;
            arrowContainer.style.animation = `${anim} 0.8s infinite alternate`;

            const gameArea = this.component.shadowRoot.querySelector('#game-area');
            gameArea.appendChild(arrowContainer);
            
            const targetRect = target.getBoundingClientRect();
            const gameRect = gameArea.getBoundingClientRect();
            const offset = 70;

            let top, left;
            if (direction === 'left') {
                left = (targetRect.left - gameRect.left) - offset;
                top = (targetRect.top - gameRect.top) + (targetRect.height / 2) - 30;
            } else if (direction === 'right') {
                left = (targetRect.right - gameRect.left) + 20;
                top = (targetRect.top - gameRect.top) + (targetRect.height / 2) - 30;
            } else if (direction === 'top') {
                left = (targetRect.left - gameRect.left) + (targetRect.width / 2) - 25;
                top = (targetRect.top - gameRect.top) - offset;
            }

            arrowContainer.style.left = `${left}px`;
            arrowContainer.style.top = `${top}px`;
            this._arrows.push(arrowContainer);
        };

        const firstLetter = this.wordArea ? this.wordArea.firstElementChild : null;
        if (firstLetter) addArrow(firstLetter, 'left');

        const firstSymbol = this.ipaAnswerArea ? this.ipaAnswerArea.firstElementChild : null;
        if (firstSymbol) addArrow(firstSymbol, 'left');

        const nextBtn = this.component.shadowRoot.querySelector('#next-button');
        if (nextBtn) addArrow(nextBtn, 'top');

        const clearBtn = this.component.shadowRoot.querySelector('#clear-button');
        if (clearBtn) addArrow(clearBtn, 'top');
    }

    removeSuggestionArrows() {
        if (this._arrows) {
            this._arrows.forEach(arrow => arrow.remove());
            this._arrows = [];
        }
    }

    showSilentTooltip(targetBox, text) {
        if (!targetBox) return;
        const existing = targetBox.querySelector('.silent-tooltip');
        if (existing) existing.remove();

        const tip = document.createElement('div');
        tip.className = 'silent-tooltip';
        tip.textContent = text || '🤐';
        targetBox.appendChild(tip);
        requestAnimationFrame(() => tip.classList.add('show'));

        setTimeout(() => {
            tip.classList.remove('show');
            setTimeout(() => tip.remove(), 200);
        }, 1400);
    }

    async showPhoneticTooltip(target, word) {
        const cupid = this.component.shadowRoot.querySelector('.cupid-indicator');
        if (!cupid) return;

        this.hidePhoneticTooltip();

        const phonetic = await this.component.voiceCommandManager.getPhonetic(word);
        
        if (!target.matches(':hover')) return;
        if (!phonetic) return;

        const tooltip = document.createElement('div');
        tooltip.className = 'phonetic-tooltip';
        tooltip.dataset.forWord = word;
        
        Object.assign(tooltip.style, {
            position: 'fixed',
            zIndex: '11000',
            pointerEvents: 'none',
            background: 'transparent',
            textShadow: '0 0 4px rgba(255, 255, 255, 0.8)',
            fontWeight: 'bold',
            fontSize: '2.5em',
            fontFamily: "'Times New Roman', serif",
            display: 'flex',
            gap: '1px',
            padding: '4px 8px',
            borderRadius: '8px'
        });

        const symbols = phoneticService.parsePhoneticString(phonetic);
        symbols.forEach(sym => {
            const span = document.createElement('span');
            if (sym === 'ju:') {
                this.renderJuSymbol(span);
            } else {
                span.textContent = sym;
                const style = this.component.phonemeStyles.get(sym);
                if (style) {
                    if (style.color) span.style.color = style.color;
                    if (style.textShadow) span.style.textShadow = style.textShadow;
                }
            }
            tooltip.appendChild(span);
        });

        document.body.appendChild(tooltip);

        const rect = target.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        
        const top = rect.top - tooltipRect.height - 5;
        const left = rect.left + (rect.width - tooltipRect.width) / 2;
        
        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
        
        tooltip.animate([
            { opacity: 0, transform: 'translateY(5px)' },
            { opacity: 1, transform: 'translateY(0)' }
        ], { duration: 200, fill: 'forwards' });
        
        this._currentTooltip = tooltip;
    }

    hidePhoneticTooltip() {
        if (this._currentTooltip) {
            this._currentTooltip.remove();
            this._currentTooltip = null;
        }
    }

    renderJuSymbol(container) {
        container.innerHTML = '';
        container.style.display = 'inline-flex';
        container.style.alignItems = 'baseline';
        container.style.justifyContent = 'center';
        container.style.gap = '1px';
        
        const spanJ = document.createElement('span');
        spanJ.textContent = 'j';
        const styleJ = this.component.phonemeStyles.get('j');
        if (styleJ) {
            if (styleJ.color) spanJ.style.color = styleJ.color;
            if (styleJ.textShadow) spanJ.style.textShadow = styleJ.textShadow;
        }
        
        const spanU = document.createElement('span');
        spanU.textContent = 'u:';
        spanU.style.color = '#00ff00';
        
        container.appendChild(spanJ);
        container.appendChild(spanU);
    }
}