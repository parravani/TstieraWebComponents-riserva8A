import { phoneticService } from '../../services/PhoneticService.js';

export class ThesaurusManager {
    constructor(component) {
        this.component = component;
        this.timers = {};
        this.levelWords = {}; // Tracks words used in thesaurus levels to avoid duplicates
        this.currentMenuPhoneticWord = null;
    }

    closeThesaurusMenu(keepButtonActive = false) {
        // Remove all open lists
        const lists = this.component.shadowRoot.querySelectorAll('.thesaurus-list');
        lists.forEach(l => l.remove());

        const btn = this.component.shadowRoot.querySelector('#menu-button');
        if (btn && !keepButtonActive) btn.classList.remove('active');
        
        // Clear timers
        Object.values(this.timers).forEach(t => clearTimeout(t));
        this.timers = {};
        this.levelWords = {}; // Reset used words
        this.hideMenuPhonetic();
    }

    async toggleThesaurusMenu() {
        const list1 = this.component.shadowRoot.querySelector('#thesaurus-list-1');
        const btn = this.component.shadowRoot.querySelector('#menu-button');
        
        this.component.playWhooshSound();

        if (list1) {
            this.closeThesaurusMenu();
            return;
        }

        const feedback = this.component.shadowRoot.querySelector('#voice-feedback');
        const rawText = feedback ? (feedback.dataset.originalText || feedback.textContent) : '';
        // Pulisce la parola da punteggiatura e spazi per una ricerca più affidabile.
        const word = (rawText || '').replace(/[.,!?;:]/g, '').replace(/\u00A0/g, ' ').trim();

        if (!word) {
            // Visual feedback if no word is recorded
            btn.style.borderColor = 'red';
            setTimeout(() => btn.style.borderColor = 'rgba(255,255,255,0.5)', 500);
            return;
        }

        btn.classList.add('active');
        this.levelWords = {}; // Initial reset
        await this.spawnThesaurusList(word, 1);
    }

    async spawnThesaurusList(word, level) {
        if (level > 5) return; // Max 5 levels

        // Close existing lists at this level and below
        for (let i = level; i <= 5; i++) {
            const l = this.component.shadowRoot.querySelector(`#thesaurus-list-${i}`);
            if (l) l.remove();
            if (this.levelWords[i]) {
                delete this.levelWords[i];
            }
        }

        const list = document.createElement('div');
        list.id = `thesaurus-list-${level}`;
        list.className = 'thesaurus-list';

        // Cascading positioning
        const baseLeft = 130;
        const baseTop = 185;
        const offset = 170; // Half of 340px
        
        list.style.top = `${baseTop}px`;
        list.style.left = `${baseLeft + (level - 1) * offset}px`;
        list.style.zIndex = `${10000 + level}`;

        list.innerHTML = '<div class="thesaurus-item">Caricamento...</div>';
        this.component.shadowRoot.querySelector('#photo-game-block').appendChild(list);

        // Collect words already used in previous levels
        const usedWords = new Set();
        Object.values(this.levelWords).forEach(arr => {
            if (arr) arr.forEach(w => usedWords.add(w.toLowerCase()));
        });
        usedWords.add(word.toLowerCase());

        try {
            const trgRes = await fetch(`https://api.datamuse.com/words?rel_trg=${encodeURIComponent(word)}&max=20&md=pf`);
            const data = await trgRes.json();

            list.innerHTML = '';
            
            // 1. Original Word
            const mainItem = document.createElement('div');
            mainItem.className = 'thesaurus-item main-word';
            mainItem.appendChild(this.createStyledWordElement(word.toUpperCase()));
            mainItem.onclick = async (e) => {
                e.stopPropagation();
                this.component.playWhooshSound();
                this.closeThesaurusMenu(true);
                await this.component.startPracticeFromMenu(word);
            };
            mainItem.onmouseenter = () => {
                this.handleItemHover(level, null);
                this.showMenuPhonetic(word);
            };
            list.appendChild(mainItem);

            const currentLevelWords = [word];
            
            for (const entry of data) {
                if (usedWords.has(entry.word.toLowerCase())) continue;
                
                const item = document.createElement('div');
                item.className = 'thesaurus-item';
                item.appendChild(this.createStyledWordElement(entry.word));
                
                item.onclick = async (e) => {
                    e.stopPropagation();
                    this.component.playWhooshSound();
                    this.closeThesaurusMenu(true);
                    await this.component.startPracticeFromMenu(entry.word);
                };

                item.onmouseenter = () => {
                    this.handleItemHover(level, entry.word);
                    this.showMenuPhonetic(entry.word);
                };
                list.appendChild(item);
                
                currentLevelWords.push(entry.word);
                usedWords.add(entry.word.toLowerCase());
                if (list.children.length >= 12) break;
            }
            
            this.levelWords[level] = currentLevelWords;

            if (list.children.length === 1) {
                const empty = document.createElement('div');
                empty.className = 'thesaurus-item';
                empty.textContent = "Nessuna correlazione";
                list.appendChild(empty);
            }

        } catch (e) {
            console.error("Thesaurus error:", e);
            list.innerHTML = '<div class="thesaurus-item">Errore connessione</div>';
        }
    }

    async showMenuPhonetic(word) {
        const container = this.component.shadowRoot.querySelector('#menu-phonetic-feedback');
        if (!container) return;
        this.currentMenuPhoneticWord = word;
        container.innerHTML = '';
        container.classList.remove('show');
        if (!word) return;

        let phonetic = await this.component.voiceCommandManager.getPhonetic(word);
        if (this.currentMenuPhoneticWord !== word) return;

        if (phonetic) {
            container.textContent = `/${phonetic}/`;
            container.classList.add('show');
        }
    }

    hideMenuPhonetic() {
        this.currentMenuPhoneticWord = null;
        const container = this.component.shadowRoot.querySelector('#menu-phonetic-feedback');
        if (container) {
            container.classList.remove('show');
            container.innerHTML = '';
        }
    }

    handleItemHover(level, word) {
        if (this.timers[`open-${level}`]) clearTimeout(this.timers[`open-${level}`]);
        if (word) {
            this.timers[`open-${level}`] = setTimeout(() => this.spawnThesaurusList(word, level + 1), 300);
        } else {
            this.timers[`open-${level}`] = setTimeout(() => {
                for (let i = level + 1; i <= 5; i++) {
                    const l = this.component.shadowRoot.querySelector(`#thesaurus-list-${i}`);
                    if (l) l.remove();
                }
            }, 300);
        }
    }

    createStyledWordElement(word) {
        const container = document.createElement('div');
        container.style.display = 'flex';
        Array.from(word).forEach(char => {
            const span = document.createElement('span');
            span.textContent = char;
            container.appendChild(span);
        });
        return container;
    }
}