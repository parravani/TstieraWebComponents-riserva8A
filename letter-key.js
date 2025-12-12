const IPA_REGEX = /iː|eɪ|aɪ|ɔɪ|əʊ|aʊ|uː|tʃ|dʒ|ɜː|ɑː|ɔː|ɪə|eə|ʊə|./g;
class LetterKey extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.boxElement = null;
        this.colormap = null; // sarà passata dal padre
    }

    async connectedCallback() {
        const template = await this.fetchTemplate();
        this.shadowRoot.appendChild(template.content.cloneNode(true));

        this.boxElement = this.shadowRoot.querySelector('.key-box');
        this.mainTextElement = this.shadowRoot.querySelector('.main-text');
        this.subTextElement = this.shadowRoot.querySelector('.sub-text');

        this.render();
        this.attachEvents();
    }

    async fetchTemplate() {
        const templateUrl = new URL('letter-key.html', import.meta.url);
        const response = await fetch(templateUrl);
        const text = await response.text();
        const html = new DOMParser().parseFromString(text, 'text/html');
        return html.querySelector('#letter-key-template');
    }

    render() {
        const mainText = this.dataset.mainText || '';
        const subText = this.dataset.subText || '';
        this.mainTextElement.textContent = mainText;
        this.subTextElement.innerHTML = this.colorizeIpaString(subText);

        const color = this.dataset.color || '#ccc';
        const borderColor = this.dataset.borderColor || '#ccc';
        const textShadow = this.dataset.textShadow || 'none';

        this.boxElement.style.borderColor = borderColor;
        this.mainTextElement.style.color = color;
        this.mainTextElement.style.textShadow = textShadow;

        if (this.dataset.flex) {
            this.style.flex = this.dataset.flex;
        }
    }

    attachEvents() {
        this.boxElement.addEventListener('mousedown', () => this.handleKeyPress());
        this.boxElement.addEventListener('mouseup', () => this.handleKeyRelease());
        this.boxElement.addEventListener('touchstart', e => { e.preventDefault(); this.handleKeyPress(); }, { passive: false });
        this.boxElement.addEventListener('touchend', e => { e.preventDefault(); this.handleKeyRelease(); });

        this.boxElement.addEventListener('mouseenter', () => this.handleMouseEnter());
        this.boxElement.addEventListener('mouseleave', () => this.handleMouseLeave());

        this.boxElement.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.handleKeyPress();
            }
        });

        this.boxElement.addEventListener('keyup', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                this.handleKeyRelease();
            }
        });
    }

    handleKeyPress() {
        this.boxElement.classList.add('pressed');
        this.dispatchEvent(new CustomEvent('keyPress', {
            bubbles: true,
            composed: true,
            detail: {
                char: this.dataset.mainText,
                sound: this.dataset.sound
            }
        }));
    }

    handleKeyRelease() {
        this.boxElement.classList.remove('pressed');
        this.dispatchEvent(new CustomEvent('keyRelease', {
            bubbles: true,
            composed: true,
            detail: {
                char: this.dataset.mainText,
                sound: this.dataset.sound,
                wordSound: this.dataset.wordSound,
                rect: this.getBoundingClientRect()
            }
        }));
    }

    handleMouseEnter() {
        this.dispatchEvent(new CustomEvent('keyEnter', {
            bubbles: true,
            composed: true,
            detail: this.getKeyDetails()
        }));
    }

    handleMouseLeave() {
        this.dispatchEvent(new CustomEvent('keyLeave', {
            bubbles: true,
            composed: true,
            detail: this.getKeyDetails()
        }));
    }

    getKeyDetails() {
        return {
            char: this.dataset.mainText,
            ipa: this.colorizeIpaString(this.dataset.subText),
            word: this.dataset.word,
            wordPhonetic: this.dataset.wordPhonetic,
            img: this.dataset.img,
            previewPosition: this.dataset.previewPosition || 'bottom',
            rect: this.getBoundingClientRect(),
            style: {
                color: this.dataset.color,
                textShadow: this.dataset.textShadow
            },
            borderColor: this.dataset.borderColor,
            isPhonetic: this.dataset.isPhonetic === 'true',
            source: this.colormap.source
        };
    }

    colorizeIpaString(ipaString) {
        if (!ipaString || ipaString === 'undefined') return '';

        const symbols = ipaString.match(IPA_REGEX) || [];
        return symbols.map(symbol => {
            const style = this.colormap?.[symbol];
            const color = style?.color || '#ccc'; // Grigio di default se non trova lo stile
            const textShadow = style?.textShadow || 'none';
            return `<span style="color: ${color}; text-shadow: ${textShadow};">${symbol}</span>`;
        }).join('');
    }
}

customElements.define('letter-key', LetterKey);
