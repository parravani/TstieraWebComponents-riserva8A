// File: components/game-stage/game-stage.js

class GameStage extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    async connectedCallback() {
        const template = await this.fetchTemplate();
        this.shadowRoot.appendChild(template.content.cloneNode(true));
    }

    async fetchTemplate() {
        const templateUrl = new URL('game-stage.html', import.meta.url);
        const response = await fetch(templateUrl);
        const text = await response.text();
        const html = new DOMParser().parseFromString(text, 'text/html');
        return html.querySelector('#game-stage-template');
    }

    // Metodo pubblico per mostrare il palcoscenico
    show() {
        this.classList.add('visible');
    }

    // Metodo pubblico per nascondere il palcoscenico
    hide() {
        this.classList.remove('visible');
    }
}

customElements.define('game-stage', GameStage);