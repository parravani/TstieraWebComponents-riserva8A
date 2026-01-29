// manager/game/VisorManager.js

export class VisorManager {
    constructor(component) {
        this.component = component;
        this.letterVisor = null;
        this.symbolVisor = null;
        this.letterHoverGrid = null;
        this.symbolHoverGrid = null;

        // State flags per gestione eventi
        this._visorBindingsInstalled = false;
        this._globalVisorHoverInstalled = false;
        this._globalVisorHoverDisabled = false;
        this._globalVisorExitGuardInstalled = false;
        this._optionSymbolsHoverInstalled = false;

        // Hover session tracking
        this._currentLetterHoverRoot = null;
        this._currentSymbolHoverRoot = null;
        this._onLetterRootLeave = null;
        this._onSymbolRootLeave = null;

        // Event handlers references
        this._onOptionsMouseOver = null;
        this._onOptionsPointerMove = null;
        this._globalMouseOver = null;
        this._onPointerMoveGuard = null;

        this._lastGlobalHoverTs = 0;
        this._globalVisorHideTimeoutId = null;
    }

    // --- VISORI: creazione, aggiornamento, binding hover ---
    createVisors() {
        const imageContainer = this.component.shadowRoot.querySelector('#image-container');
        if (!imageContainer) return;
        // Crea visore lettere (sinistra) solo se mancante
        if (!this.letterVisor) {
            this.letterVisor = document.createElement('div');
            this.letterVisor.className = 'visor letter-visor';
            const letterContent = document.createElement('div');
            letterContent.className = 'visor-content';
            this.letterVisor.appendChild(letterContent);
            const letterImg = document.createElement('img');
            letterImg.className = 'visor-image';
            letterImg.alt = 'letter image';
            this.letterVisor.appendChild(letterImg);
            imageContainer.appendChild(this.letterVisor);
        }
        // Crea visore simboli (destra) solo se mancante
        if (!this.symbolVisor) {
            this.symbolVisor = document.createElement('div');
            this.symbolVisor.className = 'visor symbol-visor';
            const symbolContent = document.createElement('div');
            symbolContent.className = 'visor-content';
            this.symbolVisor.appendChild(symbolContent);
            const symbolImg = document.createElement('img');
            symbolImg.className = 'visor-image';
            symbolImg.alt = 'symbol image';
            this.symbolVisor.appendChild(symbolImg);
            imageContainer.appendChild(this.symbolVisor);
        }
    }

    setupVisorHoverBindings() {
        if (this._visorBindingsInstalled) return;
        this._visorBindingsInstalled = true;
    }

    updateVisorFromBox(kind, box) {
        // Trova contenuto del box: span .main-text o img (midispiace)
        const contentSpan = box.querySelector('.main-text');
        const contentImg = box.querySelector('img');
        if (contentSpan) {
            this.updateVisor(kind, contentSpan, 'text');
        } else if (contentImg) {
            this.updateVisor(kind, contentImg, 'image');
        } else {
            // Box vuoto: niente da mostrare
            this.hideVisor(kind);
        }
    }

    updateVisorFromOption(opt) {
        const symbol = opt.dataset && opt.dataset.symbol;
        if (!symbol) { this.hideVisor('symbol'); return; }
        // Se SILENT, visualizza l'immagine midispiace
        if (symbol === 'SILENT') {
            const img = opt.querySelector('img');
            if (img) this.updateVisor('symbol', img, 'image');
            else this.hideVisor('symbol');
            // Assicura che l'immagine esterna (sotto il visore) sia esplicitamente nascosta per SILENT
            const visor = this.symbolVisor;
            if (visor) {
                const imgEl = visor.querySelector('.visor-image');
                if (imgEl) {
                    imgEl.classList.remove('show');
                    imgEl.removeAttribute('src');
                }
            }
            return;
        }
        // Altrimenti, usa updateVisorFromExternalText che gestisce sia il testo che l'immagine associata
        this.updateVisorFromExternalText('symbol', symbol, opt);
    }

    updateVisor(kind, sourceEl, type, sizingEl = null) {
        const visor = kind === 'letter' ? this.letterVisor : this.symbolVisor;
        if (!visor) return;
        const content = visor.querySelector('.visor-content');
        if (!content) return;

        // Pulisci contenuto
        content.innerHTML = '';

        // Accesso sicuro a isPracticeButtonActive tramite il manager vocale del componente
        const isPractice = this.component.voiceCommandManager ? this.component.voiceCommandManager.isPracticeButtonActive : false;

        // Calcola dimensione di riferimento dal contenuto originale
        const targetEl = sizingEl || sourceEl;
        const rect = targetEl.getBoundingClientRect();
        let sizeMultiplier = 3; // lettere e simboli: stessa dimensione di anteprima
        if (isPractice) {
            sizeMultiplier = (sizeMultiplier / 2) * 1.25;
        }
        const dim = Math.max(rect.width, rect.height) * sizeMultiplier;
        visor.style.width = `${Math.round(dim)}px`;
        visor.style.height = `${Math.round(dim)}px`;


        if (type === 'image') {
            const cloneImg = sourceEl.cloneNode(true);
            cloneImg.className = ''; // Rimuove classi interferenti (es. silent-icon)
            cloneImg.style.position = 'static';
            cloneImg.style.width = 'auto';
            cloneImg.style.height = 'auto';
            cloneImg.style.maxWidth = '88%';
            cloneImg.style.maxHeight = '88%';
            cloneImg.style.objectFit = 'contain';
            content.appendChild(cloneImg);
        } else {
            // Clona il testo e copia stile calcolato
            const span = document.createElement('span');
            const txt = (sourceEl.textContent || '').trim();
            if (txt === 'ju:') {
                this.component.renderJuSymbol(span);
            } else {
                span.textContent = txt;
            }
            const cs = window.getComputedStyle(sourceEl);
            span.style.fontFamily = cs.fontFamily;
            span.style.fontWeight = cs.fontWeight;
            // Imposta lo stesso font-size delle lettere (3×)
            let fontMultiplier = 1.5;
            if (isPractice) {
                fontMultiplier = (fontMultiplier / 2) * 1.25;
            }
            const sourceFontPx = parseFloat(cs.fontSize) || 16;
            const targetFontPx = Math.round(sourceFontPx * fontMultiplier);
            span.style.fontSize = `${Math.round(targetFontPx)}px`;
            span.style.color = cs.color;
            span.style.textShadow = cs.textShadow;
            span.style.lineHeight = '1';
            content.appendChild(span);
        }

        // Sposta in alto in modalità pratica
        if (isPractice) {
            visor.style.top = '25%';
        } else {
            visor.style.top = '50%';
        }

        // Mostra con transizione
        visor.classList.add('show');
    }

    hideVisor(kind) {
        const visor = kind === 'letter' ? this.letterVisor : this.symbolVisor;
        if (!visor) return;
        visor.classList.remove('show');
        const content = visor.querySelector('.visor-content');
        if (content) {
            content.innerHTML = '';
        }
        const imgEl = visor.querySelector('.visor-image');
        if (imgEl) {
            imgEl.classList.remove('show');
            imgEl.removeAttribute('src');
        }
        // Resetta tracking root corrente
        if (kind === 'letter') {
            this._currentLetterHoverRoot = null;
        } else {
            this._currentSymbolHoverRoot = null;
        }
    }

    // --- HOVER GRID: 26 lettere / 46 simboli ---
    createHoverGrids() {
        // Evita duplicati
        if (!this.letterHoverGrid) {
            this.letterHoverGrid = document.createElement('div');
            this.letterHoverGrid.className = 'hover-grid letter-hover-grid';
            const letters = Array.from(this.component.letterStyles.keys());
            letters.forEach(ch => {
                const cell = document.createElement('div');
                cell.className = 'hover-cell';
                cell.dataset.value = ch;
                cell.addEventListener('mouseenter', () => {
                    this.updateVisorFromExternalText('letter', ch, null);
                });
                cell.addEventListener('mouseleave', () => {
                    this.hideVisor('letter');
                });
                this.letterHoverGrid.appendChild(cell);
            });
            const leftContainer = this.component.shadowRoot.querySelector('#prev-button-placeholder');
            if (leftContainer) leftContainer.appendChild(this.letterHoverGrid);
        }

        if (!this.symbolHoverGrid) {
            this.symbolHoverGrid = document.createElement('div');
            this.symbolHoverGrid.className = 'hover-grid symbol-hover-grid';
            const symbols = Array.from(new Set(this.component.allPhonemes));
            symbols.forEach(sym => {
                const cell = document.createElement('div');
                cell.className = 'hover-cell';
                cell.dataset.value = sym;
                cell.addEventListener('mouseenter', () => {
                    this.updateVisorFromExternalText('symbol', sym, null);
                });
                cell.addEventListener('mouseleave', () => {
                    this.hideVisor('symbol');
                });
                this.symbolHoverGrid.appendChild(cell);
            });
            const rightContainer = this.component.shadowRoot.querySelector('#next-button-container');
            if (rightContainer) rightContainer.appendChild(this.symbolHoverGrid);
        }

        // Sincronizza dimensione dei cell con i box reali
        this.syncHoverCellSize();
    }

    syncHoverCellSize() {
        try {
            const letterBox = this.component.wordArea.querySelector('.letter-box');
            const ipaBox = this.component.ipaAnswerArea.querySelector('.ipa-box');
            if (letterBox && this.letterHoverGrid) {
                const w = Math.round(letterBox.getBoundingClientRect().width);
                this.letterHoverGrid.style.setProperty('--hover-size', `${w}px`);
            }
            if (ipaBox && this.symbolHoverGrid) {
                const w = Math.round(ipaBox.getBoundingClientRect().width);
                this.symbolHoverGrid.style.setProperty('--hover-size', `${w}px`);
            }
        } catch {}
    }

    removeHoverGrids() {
        if (this.letterHoverGrid && this.letterHoverGrid.parentElement) {
            this.letterHoverGrid.parentElement.removeChild(this.letterHoverGrid);
        }
        if (this.symbolHoverGrid && this.symbolHoverGrid.parentElement) {
            this.symbolHoverGrid.parentElement.removeChild(this.symbolHoverGrid);
        }
        this.letterHoverGrid = null;
        this.symbolHoverGrid = null;
    }

    setupGlobalVisorHover() {
        if (this._globalVisorHoverInstalled || this._globalVisorHoverDisabled) return;

        this._globalMouseOver = (e) => {
            const path = e.composedPath ? e.composedPath() : [];
            let sourceEl = null;
            let text = null;
            for (const node of path) {
                try {
                    // Caso 1: elemento con classe .main-text (tasti interni)
                    if (!sourceEl && node && node.classList && node.classList.contains('main-text')) {
                        sourceEl = node;
                        text = (node.textContent || '').trim();
                        if (text) break;
                    }
                    // Caso 2: custom element con attributo data-main-text (letter-key)
                    if (!text && node && node.getAttribute && node.hasAttribute('data-main-text')) {
                        text = (node.getAttribute('data-main-text') || '').trim();
                        // Preferisci lo span interno per stile preciso
                        if (node.shadowRoot) {
                            const inner = node.shadowRoot.querySelector('.main-text');
                            if (inner) sourceEl = inner;
                        }
                        sourceEl = sourceEl || node; // usa il custom element come riferimento dimensionale
                        if (text) break;
                    }
                    // Caso 3: simboli con attributo data-symbol
                    if (!text && node && node.getAttribute && node.hasAttribute('data-symbol')) {
                        text = (node.getAttribute('data-symbol') || '').trim();
                        if (node.shadowRoot) {
                            const inner = node.shadowRoot.querySelector('.main-text');
                            if (inner) sourceEl = inner;
                        }
                        sourceEl = sourceEl || node;
                        if (text) break;
                    }
                    // Caso 4: tasti con attributo data-ch (fallback comune)
                    if (!text && node && node.getAttribute && node.hasAttribute('data-ch')) {
                        text = (node.getAttribute('data-ch') || '').trim();
                        if (node.shadowRoot) {
                            const inner = node.shadowRoot.querySelector('.main-text');
                            if (inner) sourceEl = inner;
                        }
                        sourceEl = sourceEl || node;
                        if (text) break;
                    }
                } catch {}
            }
            if (!text) return;
            const isSymbol = this.component.allPhonemes.includes(text);
            const isLetter = this.component.letterStyles.has(text.toUpperCase());
            if (isSymbol) this.updateVisorFromExternalText('symbol', text, sourceEl);
            else if (isLetter) this.updateVisorFromExternalText('letter', text, sourceEl);

            // Debounced hide: aggiorna il timestamp e programma l'hide se il puntatore lascia elementi validi
            this._lastGlobalHoverTs = Date.now();
            if (this._globalVisorHideTimeoutId) clearTimeout(this._globalVisorHideTimeoutId);
            this._globalVisorHideTimeoutId = setTimeout(() => {
                const elapsed = Date.now() - (this._lastGlobalHoverTs || 0);
                if (elapsed >= 180) {
                    this.hideVisor('letter');
                    this.hideVisor('symbol');
                }
            }, 200);
        };
        // Usa mouseover globale in capture per Shadow DOM; niente mouseout immediato, solo hide debounce
        window.addEventListener('mouseover', this._globalMouseOver, true);
        this._globalVisorHoverInstalled = true;
    }

    disableGlobalVisorHover() {
        if (this._globalVisorHoverInstalled && this._globalMouseOver) {
            try { window.removeEventListener('mouseover', this._globalMouseOver, true); } catch {}
        }
        this._globalVisorHoverInstalled = false;
        this._globalVisorHoverDisabled = true;
    }

    // Nasconde i visori quando il puntatore non è sopra alcun tasto di tastiera lettere/simboli
    setupGlobalVisorExitGuard() {
        if (this._globalVisorExitGuardInstalled) return;
        this._onPointerMoveGuard = (e) => {
            const path = e.composedPath ? e.composedPath() : [];
            let overKey = false;
            for (const node of path) {
                try {
                    if (!node) continue;
                    if (node.tagName && (node.tagName.toLowerCase() === 'letter-key')) { overKey = true; break; }
                    if (node.getAttribute && (node.hasAttribute('data-main-text') || node.hasAttribute('data-symbol') || node.hasAttribute('data-ch'))) { overKey = true; break; }
                    if (node.classList && node.classList.contains('main-text')) { overKey = true; break; }
                } catch {}
            }
            if (!overKey) {
                this.hideVisor('letter');
                this.hideVisor('symbol');
            }
        };
        window.addEventListener('pointermove', this._onPointerMoveGuard, true);
        this._globalVisorExitGuardInstalled = true;
    }

    // Avvia una sessione di hover legata al tasto host; nasconde quando si esce dal tasto
    beginHoverSession(kind, text, sourceEl, hoverRootEl) {
        this.updateVisorFromExternalText(kind, text, sourceEl);
        const keyProp = kind === 'letter' ? '_currentLetterHoverRoot' : '_currentSymbolHoverRoot';
        const leaveHandlerProp = kind === 'letter' ? '_onLetterRootLeave' : '_onSymbolRootLeave';
        // Rimuovi vecchio listener se cambiato root
        if (this[keyProp] && this[keyProp] !== hoverRootEl) {
            try { this[keyProp].removeEventListener('pointerleave', this[leaveHandlerProp], true); } catch {}
            try { this[keyProp].removeEventListener('mouseleave', this[leaveHandlerProp], true); } catch {}
            try { this[keyProp].removeEventListener('pointerout', this[leaveHandlerProp], true); } catch {}
            this[keyProp] = null;
            this[leaveHandlerProp] = null;
        }
        if (!hoverRootEl) return;
        if (!this[leaveHandlerProp]) {
            this[leaveHandlerProp] = () => this.hideVisor(kind);
        }
        if (this[keyProp] !== hoverRootEl) {
            // Ascolta sia pointerleave che pointerout per massima affidabilità
            hoverRootEl.addEventListener('pointerleave', this[leaveHandlerProp], true);
            hoverRootEl.addEventListener('pointerout', this[leaveHandlerProp], true);
            this[keyProp] = hoverRootEl;
        }
    }

    // Hook diretto tastiera lettere
    setupAlphabetKeyboardHover() {
        try {
            const keyboards = document.querySelectorAll('alphabet-keyboard');
            keyboards.forEach(kb => {
                const sr = kb.shadowRoot;
                if (!sr) return;
                const keys = sr.querySelectorAll('letter-key, [data-main-text]');
                keys.forEach(keyEl => {
                    if (keyEl.__letterVisorHoverBound) return;
                    keyEl.addEventListener('pointerenter', () => {
                        let text = (keyEl.getAttribute('data-main-text') || '').trim();
                        if (!text) {
                            const mt = keyEl.shadowRoot ? keyEl.shadowRoot.querySelector('.main-text') : keyEl.querySelector('.main-text');
                            if (mt) text = (mt.textContent || '').trim();
                        }
                        const isLetter = /^[A-Z]$/.test(text);
                        const hasSymbolAttr = keyEl.hasAttribute('data-symbol') || keyEl.hasAttribute('data-ch');
                        if (!isLetter || hasSymbolAttr) return; // non gestire simboli qui
                        let sourceEl = null;
                        if (keyEl.shadowRoot) sourceEl = keyEl.shadowRoot.querySelector('.main-text');
                        else sourceEl = keyEl.querySelector('.main-text') || keyEl;
                        if (isLetter && text) this.beginHoverSession('letter', text, sourceEl || keyEl, keyEl);
                    }, true);
                    const hideLetter = () => this.hideVisor('letter');
                    keyEl.addEventListener('pointerleave', hideLetter, true);
                    keyEl.addEventListener('pointerout', hideLetter, true);
                    keyEl.__letterVisorHoverBound = true;
                });
                // Nasconde il visore quando si lascia l'intera tastiera lettere
                const hideLetterKb = () => this.hideVisor('letter');
                kb.addEventListener('pointerleave', hideLetterKb, true);
                kb.addEventListener('pointerout', hideLetterKb, true);
                kb.addEventListener('mouseleave', hideLetterKb, true);
            });
        } catch {}
    }

    // Hook diretto tastiera fonemi/simboli
    setupPhonemeKeyboardHover() {
        try {
            const keyboards = document.querySelectorAll('phoneme-keyboard, ipa-keyboard, symbol-keyboard, alphabet-keyboard');
            keyboards.forEach(kb => {
                const sr = kb.shadowRoot;
                if (!sr) return;
                const candidates = sr.querySelectorAll('symbol-key, letter-key, [data-symbol], [data-ch]');
                candidates.forEach(keyEl => {
                    if (keyEl.__symbolVisorHoverBound) return;
                    keyEl.addEventListener('pointerenter', () => {
                        let sym = (keyEl.getAttribute('data-symbol') || keyEl.getAttribute('data-ch') || '').trim();
                        if (!sym) {
                            const mt = keyEl.shadowRoot ? keyEl.shadowRoot.querySelector('.main-text') : keyEl.querySelector('.main-text');
                            if (mt) sym = (mt.textContent || '').trim();
                        }
                        // Se è una singola lettera A-Z, non trattarla come simbolo qui
                        if (/^[A-Z]$/.test(sym)) return;
                        let sourceEl = null;
                        if (keyEl.shadowRoot) sourceEl = keyEl.shadowRoot.querySelector('.main-text');
                        else sourceEl = keyEl.querySelector('.main-text') || keyEl;
                        if (sym) this.beginHoverSession('symbol', sym, sourceEl || keyEl, keyEl);
                    }, true);
                    const hideSymbol = () => this.hideVisor('symbol');
                    keyEl.addEventListener('pointerleave', hideSymbol, true);
                    keyEl.addEventListener('pointerout', hideSymbol, true);
                    keyEl.__symbolVisorHoverBound = true;
                });
                // Nasconde il visore quando si lascia l'intera tastiera simboli
                const hideSymbolKb = () => this.hideVisor('symbol');
                kb.addEventListener('pointerleave', hideSymbolKb, true);
                kb.addEventListener('pointerout', hideSymbolKb, true);
                kb.addEventListener('mouseleave', hideSymbolKb, true);
            });
        } catch {}
    }

    // Hover per le opzioni IPA: mostra nel visore di destra con gli stessi stili
    setupOptionSymbolsHover() {
        try {
            const area = this.component.ipaOptionsArea;
            if (!area || this._optionSymbolsHoverInstalled) return;
            this._optionSymbolsHoverInstalled = true;
            // Aggiorna il visore entrando su un'opzione
            this._onOptionsMouseOver = (e) => {
                const opt = e.target && e.target.closest ? e.target.closest('.ipa-option-symbol') : null;
                if (!opt) return;
                this.updateVisorFromOption(opt);
            };
            // Nasconde il visore quando il puntatore non è su un'opzione all'interno dell'area
            this._onOptionsPointerMove = (e) => {
                const opt = e.target && e.target.closest ? e.target.closest('.ipa-option-symbol') : null;
                if (!opt) this.hideVisor('symbol');
            };
            const hideArea = () => this.hideVisor('symbol');
            area.addEventListener('mouseover', this._onOptionsMouseOver, true);
            area.addEventListener('pointermove', this._onOptionsPointerMove, true);
            area.addEventListener('mouseleave', hideArea, true);
        } catch {}
    }

    updateVisorFromExternalText(kind, text, sourceEl) {
        const visor = kind === 'letter' ? this.letterVisor : this.symbolVisor;
        if (!visor) return;
        const content = visor.querySelector('.visor-content');
        if (!content) return;
        content.innerHTML = '';

        const isPractice = this.component.voiceCommandManager ? this.component.voiceCommandManager.isPracticeButtonActive : false;

        // Dimensionamento basato sull'elemento sorgente (se disponibile)
        const rect = (sourceEl && sourceEl.getBoundingClientRect) ? sourceEl.getBoundingClientRect() : { width: 48, height: 48 };
        const base = Math.max(rect.width, rect.height);
        let sizeMultiplier = 3; // lettere e simboli: stessa dimensione di anteprima
        if (isPractice) {
            sizeMultiplier = (sizeMultiplier / 2) * 1.25;
        }
        const dim = base * sizeMultiplier;

        visor.style.width = `${Math.round(dim)}px`;
        visor.style.height = `${Math.round(dim)}px`;

        const span = document.createElement('span');
        if (text === 'ju:') {
            this.component.renderJuSymbol(span);
        } else {
            span.textContent = text;
        }
        let styleMap = null;
        if (kind === 'letter') styleMap = this.component.letterStyles.get(text.toUpperCase()) || {};
        else styleMap = this.component.phonemeStyles.get(text) || {};

        // Copia stile calcolato dal sorgente, poi applica override da styleMap
        const cs = sourceEl ? window.getComputedStyle(sourceEl) : { fontFamily: styleMap.fontFamily || 'inherit', fontWeight: 'bold', fontSize: '24px', color: styleMap.color || '#222', textShadow: styleMap.textShadow || 'none' };
        span.style.fontFamily = cs.fontFamily || 'inherit';
        span.style.fontWeight = cs.fontWeight || 'bold';
        // Richiesta: il preview deve essere IDENTICO alla tastiera per stile e font-size.
        // Quindi applica lo stesso moltiplicatore (3×) anche ai simboli.
        let fontMultiplier = 1.5;
        if (isPractice) {
            fontMultiplier = (fontMultiplier / 2) * 1.25;
        }
        const sourceFontPx = parseFloat(cs.fontSize) || 24;
        const targetFontPx = sourceFontPx * fontMultiplier;
        span.style.fontSize = `${Math.round(targetFontPx)}px`;
        span.style.color = styleMap.color || cs.color;
        span.style.textShadow = styleMap.textShadow || cs.textShadow;
        span.style.lineHeight = '1';
        content.appendChild(span);
        // Aggiorna l'immagine associata sotto il visore
        try {
            const imgEl = visor.querySelector('.visor-image');
            let imgUrl = null;
            if (kind === 'letter') {
                const info = this.component.letterInfo.get(text.toUpperCase());
                if (info && info.img) {
                    const prefix = this.component.getAssetPrefix();
                    imgUrl = `${prefix}${info.img}`;
                }
            } else {
                const info = this.component.phonemeInfo.get(text);
                if (info && info.img) {
                    const prefix = this.component.getAssetPrefix();
                    imgUrl = `${prefix}${info.img}`;
                } else if (text === 'SILENT') {
                    imgUrl = `${this.component.getAssetPrefix()}img/midispiace.png`;
                }
            }
            if (imgEl) {
                // Dimezza la dimensione dell'immagine in modalità pratica
                if (isPractice) {
                    imgEl.style.width = '88px';
                    imgEl.style.height = '88px';
                } else {
                    imgEl.style.width = '140px';
                    imgEl.style.height = '140px';
                }
                if (imgUrl) {
                    imgEl.src = imgUrl;
                    imgEl.classList.add('show');
                } else {
                    imgEl.classList.remove('show');
                    imgEl.removeAttribute('src');
                }
            }
        } catch {}

        // Sposta in alto in modalità pratica
        if (isPractice) {
            visor.style.top = '25%';
        } else {
            visor.style.top = '50%';
        }

        // Mostra il visore correntemente aggiornato e nascondi l'altro per evitare ambiguità
        visor.classList.add('show');
        if (kind === 'letter' && this.symbolVisor) this.symbolVisor.classList.remove('show');
        if (kind === 'symbol' && this.letterVisor) this.letterVisor.classList.remove('show');
    }
}