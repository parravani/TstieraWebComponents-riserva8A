class AlphabetKeyboard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.colormap = {};
    }

    async connectedCallback() {
        const template = await this.fetchTemplate();
        this.shadowRoot.appendChild(template.content.cloneNode(true));

        const data = await this.fetchData();
        const phonemeData = await this.fetchPhonemeData() || data;

        this.colormap = this.generateColorMap(phonemeData);

        if (data && data.layout) {
            this.generateKeyboard(data.layout);
        }
    }

    async fetchTemplate() {
        const response = await fetch('components/alphabet-keyboard/alphabet-keyboard.html');
        const text = await response.text();
        const html = new DOMParser().parseFromString(text, 'text/html');
        return html.querySelector('#alphabet-keyboard-template');
    }

    async fetchData() {
        const dataSrc = this.getAttribute('data-src');
        if (!dataSrc) return null;
        const response = await fetch(dataSrc);
        return await response.json();
    }

    async fetchPhonemeData() {
        const dataSrc = this.getAttribute('data-phoneme');
        if (!dataSrc) return null;
        const response = await fetch(dataSrc);
        return await response.json();
    }

    generateColorMap(data) {
        const map = {};
        data.layout.forEach(row => {
            row.keys.forEach(key => {
                if (key.style?.color) map[key.ch] = key.style.color;
            });
        });
        return map;
    }

    generateKeyboard(layout) {
        const wrapper = this.shadowRoot.querySelector('.keyboard-wrapper');
        if (!wrapper) return;

        layout.forEach(rowData => {
            const rowElement = document.createElement('div');
            rowElement.className = 'keyboard-row';

            const keysContainer = document.createElement('div');
            keysContainer.className = 'keys-container';
            if (rowData.width) keysContainer.style.width = rowData.width;

            rowData.keys.forEach(keyData => {
                const keyElement = document.createElement('letter-key');
                Object.assign(keyElement.dataset, {
                    mainText: keyData.char || keyData.ch,
                    subText: keyData.ipa,
                    img: keyData.img,
                    sound: keyData.sound,
                    word: keyData.word,
                    wordPhonetic: keyData.wordPhonetic,
                    wordSound: keyData.wordSound,
                    previewPosition: keyData.previewPosition,
                    color: keyData.style?.color,
                    borderColor: keyData.style?.borderColor,
                    textShadow: keyData.style?.textShadow,
                    flex: keyData.style?.flex
                });

                keyElement.colormap = this.colormap;
                keysContainer.appendChild(keyElement);
            });

            rowElement.appendChild(keysContainer);
            wrapper.appendChild(rowElement);
        });
    }
}

customElements.define('alphabet-keyboard', AlphabetKeyboard);
