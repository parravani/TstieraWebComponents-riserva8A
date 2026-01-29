// File: components/word-display-animated/word-display-animated.js

class WordDisplayFlying extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    async connectedCallback() {
        const templateUrl = new URL('word-display-animated.html', import.meta.url);
        const response = await fetch(templateUrl);
        const text = await response.text();
        const template = new DOMParser().parseFromString(text, 'text/html').querySelector('#word-display-animated-template');
        this.shadowRoot.appendChild(template.content.cloneNode(true));
        this.displayContainer = this.shadowRoot.getElementById('display-container');
        this.animatedFrame = this.shadowRoot.getElementById('animated-frame');

        // Aggiunge gli eventi per l'effetto arcobaleno al passaggio del mouse
        this.addEventListener('mouseenter', () => {
            this.animatedFrame.classList.add('rainbow-active');
        });

        this.addEventListener('mouseleave', () => {
            this.animatedFrame.classList.remove('rainbow-active');
        });
    }

    show() {
        this.classList.add('visible');
    }

    hide() {
        this.classList.remove('visible');
        this.displayContainer.innerHTML = '';
    }

    /**
     * Prepara i segnaposto per la parola e la trascrizione.
     * @param {string[]} wordChars - Un array di caratteri della parola.
     * @returns {{letterPlaceholders: HTMLElement[], phonemePlaceholders: HTMLElement[]}}
     */
    setupPlaceholders(wordChars) {
        this.displayContainer.innerHTML = '';
        this.show();

        const letterPlaceholders = [];
        const phonemePlaceholders = [];

        wordChars.forEach(() => {
            const charContainer = document.createElement('div');
            charContainer.className = 'char-container';

            const letterPlaceholder = document.createElement('div');
            letterPlaceholder.className = 'placeholder';
            const phonemePlaceholder = document.createElement('div');
            phonemePlaceholder.className = 'placeholder';

            charContainer.appendChild(letterPlaceholder);
            charContainer.appendChild(phonemePlaceholder);
            this.displayContainer.appendChild(charContainer);

            letterPlaceholders.push(letterPlaceholder);
            phonemePlaceholders.push(phonemePlaceholder);
        });

        return { letterPlaceholders, phonemePlaceholders };
    }

    /**
     * Recupera i segnaposto esistenti senza ricrearli.
     * @returns {{letterPlaceholders: HTMLElement[], phonemePlaceholders: HTMLElement[]}}
     */
    getPlaceholders() {
        const letterPlaceholders = Array.from(this.shadowRoot.querySelectorAll('.char-container > div:first-child'));
        const phonemePlaceholders = Array.from(this.shadowRoot.querySelectorAll('.char-container > div:last-child'));
        return { letterPlaceholders, phonemePlaceholders };
    }

    /**
     * Pulisce solo i segnaposto delle lettere.
     */
    clearLetters() {
        const letterPlaceholders = this.shadowRoot.querySelectorAll('.char-container > div:first-child');
        letterPlaceholders.forEach(p => {
            p.innerHTML = '';
            p.className = 'placeholder';
            p.removeAttribute('style');
        });
    }
}

customElements.define('word-display-flying', WordDisplayFlying);