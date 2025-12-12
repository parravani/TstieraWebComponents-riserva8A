// imagePreviewDispatcher.js

/**
 * Dispatcher modulare per gestire preview immagini e tooltip
 * Interagisce con i componenti tramite eventi custom keyEnter/keyLeave
 */

import { dataService } from '../data/dataservice.js';
export class ImagePreviewDispatcher {
    /**
     * @param {Object} options - configurazione iniziale
     * @param {HTMLElement} options.previewElement - contenitore immagine
     * @param {HTMLImageElement} options.previewImage - immagine effettiva
     * @param {HTMLElement} options.tooltipElement - contenitore tooltip
     * @param {string[]} options.dataFiles - array di file JSON da caricare per la colormap
     */
    constructor({ previewElement, previewImage, tooltipElement, styleMap }) {
        this.enabled = true;
        this.previewManager = new PreviewImageManager(previewElement, previewImage);
        this.tooltipManager = new TooltipManager(tooltipElement);
        this.keyStyleMap = {};

        this.hideTooltipTimer = null;
        this.hideImageTimer = null;
    }

    async init() {

        document.body.addEventListener('keyEnter', e => { if (this.enabled) this.handleKeyEnter(e); });
        document.body.addEventListener('keyLeave', e => { if (this.enabled) this.handleKeyLeave(e); });
    }

    async fetchData(path) {
        const response = await fetch(path);
        return await response.json();
    }



    async handleKeyEnter(event) {
        const isPhotoGamePage = window.location.pathname.includes('/games/photo-game.html');
        if (isPhotoGamePage) {
            return; // Non mostrare tooltip o anteprime nella pagina del gioco
        }

        // Logica originale ripristinata
        const { detail } = event;
        clearTimeout(this.hideImageTimer);
        clearTimeout(this.hideTooltipTimer);

        if (detail.char) {
            // Passa la colormap al tooltip
            this.tooltipManager.showTooltip({
                char: detail.char,
                ipa: detail.ipa || '',
                word: detail.word || '',
                wordPhonetic: detail.wordPhonetic || '',
                rect: detail.rect,
                previewPosition: detail.previewPosition,
                style: detail.style,
                borderColor: detail.borderColor,
                isPhonetic: detail.isPhonetic,
                source: detail.source
            });
        }

        if (!detail.isPhonetic && detail.img) {
            this.previewManager.showPreview(detail.img, detail.rect, detail.previewPosition, detail.borderColor);
        }
    }




    handleKeyLeave(event) {

        this.hideImageTimer = setTimeout(() => this.previewManager.hidePreview(), 50);
        this.hideTooltipTimer = setTimeout(() => this.tooltipManager.hideTooltip(), 50);
    }

    enable() { this.enabled = true; }
    disable() { this.enabled = false; }
}

/**
 * Manager per il tooltip testuale
 */
export class TooltipManager {
    constructor(element) { this.tooltipElement = element; }

    async showTooltip(detail) {
        if (!this.tooltipElement) return;
        // Recupera la colormap dal DataService usando la source indicata
        const colorMap = await dataService.getColorMap(detail.source);
        const dataPath = window.location.pathname.includes('/games/') ? '../data/' : 'data/';
        const lettersMap = await dataService.getColorMap(`${dataPath}letters.json`);
        const charStyled = `<span style="color:${detail.style?.color || 'white'}; text-shadow:${detail.style?.textShadow || 'none'};">${detail.char}</span>`;
        const ipaStyled = detail.ipa || '';
        let line2 = '';

        if (detail.word) {
            const coloredWord = this.colorizeWord(detail.word, lettersMap);
            const coloredIpa = this.colorizeIpa(detail.wordPhonetic, colorMap);
            line2 = `<br><span class="flashing-word">${coloredWord}</span> <span class="ipa-font">${coloredIpa}</span>`;
        }

        this.tooltipElement.innerHTML = `${charStyled} <span class="ipa-font">${ipaStyled}</span>${line2}`;
        this.positionTooltip(detail.rect, detail.previewPosition);
        this.tooltipElement.classList.add('visible');
    }

    colorizeWord(word, colorMap) {
        if (!word) return '';
        return word.split('').map(c => {
            const style = colorMap?.[c];
            return `<span style="color: ${style?.color || 'inherit'}; text-shadow: ${style?.textShadow || 'none'};">${c}</span>`;
        }).join('');
    }

    colorizeIpa(ipaString, colorMap) {
        if (!ipaString) return '';
        const symbols = ipaString.match(/iː|eɪ|aɪ|ɔɪ|əʊ|aʊ|uː|tʃ|dʒ|ɜː|ɑː|ɔː|ɪə|eə|ʊə|./g) || [];
        return symbols.map(s => {
            const style = colorMap?.[s];
            return `<span style="color: ${style?.color || 'inherit'}; text-shadow: ${style?.textShadow || 'none'};">${s}</span>`;
        }).join('');
    }


    hideTooltip() {
        this.tooltipElement?.classList.remove('visible');
    }

    positionTooltip(rect, position) {
        if (!this.tooltipElement) return;
        const offset = 10;
        let top, left;

        if (position === 'fixed') {
            this.tooltipElement.style.top = '';
            this.tooltipElement.style.transform = 'translate(-50%, 150%)';
        } else {
            top = rect.top - offset;
            this.tooltipElement.style.top = `${top}px`;
            this.tooltipElement.style.transform = 'translate(-50%, -100%)';
        }

        left = rect.left + rect.width / 2;
        this.tooltipElement.style.left = `${left}px`;
    }
}

/**
 * Manager per l'immagine preview
 */
class PreviewImageManager {
    constructor(previewElement, previewImage) {
        this.previewElement = previewElement;
        this.previewImage = previewImage;
    }

    showPreview(src, keyRect, position, borderColor) {
        if (!this.previewElement || !this.previewImage) return;

        this.previewImage.onload = () => {
            this.positionPreview(keyRect, position);
            this.previewElement.classList.add('visible');
            this.previewImage.onload = null;
        };
        this.previewImage.onerror = () => {
            console.error(`Errore caricamento immagine: ${this.previewImage.src}`);
            this.previewImage.onerror = null;
        };

        const isGamesPage = window.location.pathname.includes('/games/');
        const correctedSrc = isGamesPage ? `../${src}` : src;
        this.previewImage.src = correctedSrc;
        this.previewElement.style.borderColor = borderColor || '#ccc';
    }

    hidePreview() { this.previewElement?.classList.remove('visible'); }

    positionPreview(keyRect, position) {
        if (!this.previewElement) return;
        const offset = 10;
        const previewRect = this.previewElement.getBoundingClientRect();

        // Calcolo orizzontale sempre
        let left = keyRect.left + keyRect.width / 2 - previewRect.width / 2;

        // Limiti bordo schermo
        if (left < 0) left = 5;
        if (left + previewRect.width > window.innerWidth) {
            left = window.innerWidth - previewRect.width - 5;
        }
        this.previewElement.style.left = `${left}px`;

        // Solo se NON fixed calcolo top
        if (position !== 'fixed') {
            const top = keyRect.bottom + offset;
            this.previewElement.style.top = `${top}px`;
        } else {
            // Rimuovo qualsiasi top inline precedente per far prevalere il CSS
            this.previewElement.style.top = '';
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const previewEl = document.getElementById('global-image-preview');
    const previewImg = previewEl?.querySelector('img');
    const tooltipEl = document.getElementById('wordCharTooltip');

    const dispatcher = new ImagePreviewDispatcher({
        previewElement: previewEl,
        previewImage: previewImg,
        tooltipElement: tooltipEl
    });

    await dispatcher.init();
});
