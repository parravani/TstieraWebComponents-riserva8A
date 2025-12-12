import { dataService } from '../../manager/data/dataservice.js';
class AlphabetKeyboard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.colormap = {};
        this.dataFile = null;
        this.dataPhonemeFile = null;
    }
    async connectedCallback() {
        const template = await this.fetchTemplate();
        this.shadowRoot.appendChild(template.content.cloneNode(true));

        this.dataFile = this.getAttribute('data-src');
        this.dataPhonemeFile = this.getAttribute('data-phoneme') || this.dataFile;
        const data = await dataService.getData(this.dataFile);

        // Se vogliamo distinguere lettere e fonemi
        const phonemeData = this.getAttribute('data-phoneme')
            ? await dataService.getData(this.dataPhonemeFile)
            : data;

        this.colormap = await  dataService.getColorMap(this.dataPhonemeFile);


        if (data && data.layout) {
            this.generateKeyboard(data.layout);
        }
    }


    async fetchTemplate() {
        const templateUrl = new URL('alphabet-keyboard.html', import.meta.url);
        const response = await fetch(templateUrl);
        const text = await response.text();
        const html = new DOMParser().parseFromString(text, 'text/html');
        return html.querySelector('#alphabet-keyboard-template');
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

                // Aggiusta il percorso del suono se necessario
                let soundPath = keyData.sound;
                const isSubdirectory = window.location.pathname.includes('/games/');
                if (isSubdirectory && soundPath && !soundPath.startsWith('../')) {
                    soundPath = `../${soundPath}`;
                }


                Object.assign(keyElement.dataset, {
                    mainText: keyData.char || keyData.ch,
                    subText: keyData.ipa || keyData.symbol,
                    img: keyData.img,
                    sound: soundPath, // Usa il percorso corretto
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
