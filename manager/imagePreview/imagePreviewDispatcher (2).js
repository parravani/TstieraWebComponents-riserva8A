//La responsabilità di questo pezzo di codice è gestire gli eventi che vengono dai bottoni per
//far apparire e comparire immagini e tooltip

class ImagePreviewDispatcher {
    constructor() {
        this.previewElement = document.getElementById('global-image-preview');
        this.previewImage = this.previewElement ? this.previewElement.querySelector('img') : null;
        this.tooltipElement = document.getElementById('wordCharTooltip');

        this.keyStyleMap = {};  //in questo oggetto ci vanno a finire gli stili per colorare le lettere e i simboli fonetici
        let data = this.fetchData('data/letters.json');
        data.then(x => this.populateStyleMap(x));
        data = this.fetchData('data/phonemes-new.json');
        data.then(x => this.populateStyleMap(x));

        // Timer per gestire lo sfarfallio del tooltip
        this.hideTooltipTimer = null;

        if (!this.previewElement || !this.previewImage) {
            console.error("Elementi per l'anteprima non trovati. Assicurarsi che #global-image-preview e la sua immagine esistano.");
        }
        if (!this.tooltipElement) {
            console.warn("Elemento per il tooltip non trovato. Assicurarsi che #wordCharTooltip esista.");
        }

        if (!this.previewElement && !this.tooltipElement) {
            return;
        }

        //mi registro per ascoltare gli eventi custom provenienti dai bottoni
        document.body.addEventListener('keyEnter', (event) => this.showPreview(event));
        document.body.addEventListener('keyLeave', (event) => this.hidePreview(event));
    }

    async fetchData(dataSrc) {
        //legge un file in json e lo restituisce come oggetto
        const response = await fetch(dataSrc);
        return await response.json();
    }

    populateStyleMap(data) {
        //popola l'oggetto keyStyleMap con gli stili associati a ogni lettera o simbolo fonetico
        data.layout.forEach(row => {
            row.keys.forEach(key => {
                const phonemeChar = key.ch || key.symbol; // Es. 'p', 'iː'
                if (phonemeChar && key.style) {
                    this.keyStyleMap[phonemeChar] = key.style; // Salva 'p' -> stile
                }
            });
        });
    }

    // Nuova funzione per colorare ogni lettera di una parola
    colorizeWord(word) {
        if (!word) return '';
        return word.split('').map(char => {
            const style = this.keyStyleMap[char.toUpperCase()];
            if (style) {
                return `<span style="color: ${style.color}; text-shadow: ${style.textShadow || 'none'};">${char}</span>`;
            }
            return `<span>${char}</span>`; // Carattere senza stile se non trovato
        }).join('');
    }

    // Nuova funzione per colorare una stringa di simboli IPA
    colorizeIpa(ipaString) {
        if (!ipaString) return '';
        const ipaSymbolsRegex = /iː|eɪ|aɪ|ɔɪ|əʊ|aʊ|uː|tʃ|dʒ|ɜː|ɑː|ɔː|ɪə|eə|ʊə|./g;
        const symbols = ipaString.match(ipaSymbolsRegex) || [];
        return symbols.map(symbol => {
            const style = this.keyStyleMap[symbol]; // Cerca il simbolo fonetico direttamente
            if (style) {
                return `<span style="color: ${style.color}; text-shadow: ${style.textShadow || 'none'};">${symbol}</span>`;
            }
            return `<span>${symbol}</span>`; // Simbolo senza stile se non trovato
        }).join('');
    }

    async showPreview(event) {
        const { detail } = event;

        // Annulla qualsiasi timer per nascondere il tooltip, perché stiamo entrando in un nuovo tasto.
        clearTimeout(this.hideTooltipTimer);

        // Gestione del tooltip testuale
        if (this.tooltipElement && detail.char && detail.char !== "undefined") {
            // Applica lo stile del tasto corrente solo alla prima lettera, non a tutto il tooltip.
            const charStyle = `style="color: ${detail.style.color || 'white'}; text-shadow: ${detail.style.textShadow || 'none'};"`;
            const styledChar = `<span ${charStyle}>${detail.char}</span>`;

            let ipa = detail.ipa || "";
            if (ipa == "undefined") ipa = "";

            // La trascrizione della lettera (detail.ipa) arriva già colorata da letter-key
            const line1 = `${styledChar} <span class="ipa-font">${ipa}</span>`;
            let line2 = '';

            // Costruisce la seconda riga se la parola esiste
            if (detail.word && detail.word !== "undefined") {
                // Attende che la mappa degli stili sia stata caricata prima di procedere.
                await this.isStyleMapReady;
                const coloredWord = this.colorizeWord(detail.word);
                const coloredWordPhonetic = this.colorizeIpa(detail.wordPhonetic); // Colora la trascrizione della parola
                // --- MODIFICA CHIAVE ---
                // Avvolgiamo la parola colorata in uno span con la classe per l'effetto lampeggiante.
                line2 = `<br><span class="flashing-word">${coloredWord}</span> <span class="ipa-font">${coloredWordPhonetic}</span>`;
            }

            this.tooltipElement.innerHTML = line1 + line2;

            this.positionTooltip(detail.rect, detail.previewPosition);
            this.tooltipElement.classList.add('visible');
        }

        // Mostra l'anteprima solo se c'è un'immagine associata
        // --- MODIFICA CHIAVE ---
        // Aggiungiamo il controllo qui per bloccare solo l'immagine fluttuante per i tasti fonetici.
        if (detail.isPhonetic) {
            return; // Non mostrare l'immagine fluttuante per i tasti fonetici.
        }

        if (detail.img && detail.img !== 'undefined' && detail.img.trim() !== '') {
            // Imposta la sorgente dell'immagine e attendi che venga caricata
            // per avere le dimensioni corrette prima di posizionarla.
            this.previewImage.onload = () => {
                this.positionPreview(detail.rect, detail.previewPosition);
                this.previewElement.classList.add('visible');
                // Rimuovi l'handler per evitare che venga eseguito per caricamenti futuri
                this.previewImage.onload = null;
            };

            // Aggiungi un gestore per l'errore di caricamento dell'immagine
            this.previewImage.onerror = () => {
                console.error(`Errore nel caricamento dell'immagine: ${this.previewImage.src}`);
                this.previewImage.onerror = null; // Rimuovi l'handler
            };

            // Aggiungiamo un prefisso al percorso per renderlo assoluto
            // rispetto alla root del server web.
            const imagePath = `./${detail.img}`;
            this.previewImage.src = imagePath;
            this.previewElement.style.borderColor = detail.borderColor || '#ccc';
        }
    }

    hidePreview(event) {
        if (this.previewElement) {
            this.previewElement.classList.remove('visible');
        }

        // Avvia un timer per nascondere il tooltip. Se l'utente entra in un altro
        // tasto prima che il timer scada, il timer verrà annullato da showPreview().
        // Questo previene lo sfarfallio.
        this.hideTooltipTimer = setTimeout(() => {
            if (this.tooltipElement) this.tooltipElement.classList.remove('visible');
        }, 50); // Un breve ritardo di 50ms è sufficiente.
    }

    positionPreview(keyRect, position) {
        if (!this.previewElement) return;
        const previewRect = this.previewElement.getBoundingClientRect();
        const offset = 10; // Distanza dal tasto

        let top, left;

        // Calcola la posizione centrata orizzontalmente rispetto al tasto
        left = keyRect.left + (keyRect.width / 2) - (previewRect.width / 2);

        // Calcola la posizione verticale in base all'attributo 'previewPosition'
        if (position === 'fixed') {
            // se la posizione è fixed dove mettere la preview lo decide il css
            top = keyRect.top - previewRect.height - offset;
            this.previewElement.style.top = "";
        } else {
            // la posizione dipende dalla posizione del bottone
            top = keyRect.bottom + offset;
            this.previewElement.style.top = `${top}px`;
        }

        // Assicura che l'anteprima non esca dai bordi dello schermo
        if (left < 0) left = 5;
        if (left + previewRect.width > window.innerWidth) {
            left = window.innerWidth - previewRect.width - 5;
        }

        this.previewElement.style.left = `${left}px`;
    }

    positionTooltip(keyRect, position) {
        if (!this.tooltipElement) return;
        const offset = 10; // Aumentato per alzare di più il tooltip

        // Posizioniamo il tooltip in modo più robusto usando transform.
        // L'origine (top) è la parte superiore del tasto.
        // L'origine (left) è il centro del tasto.
        let top, left;
        if (position === 'fixed') {
            // se la posizione è fixed dove mettere la preview lo decide il css            
            this.tooltipElement.style.top = "";            
            this.tooltipElement.style.transform = 'translate(-50%, 170%)';
            
        } else {
            top = keyRect.top - offset;
            this.tooltipElement.style.top = `${top}px`;
            this.tooltipElement.style.transform = 'translate(-50%, -100%)';            
        }

        
        left = keyRect.left + (keyRect.width / 2);
        this.tooltipElement.style.left = `${left}px`;

        // Applichiamo la posizione e poi usiamo transform per spostarlo
        // verso l'alto della sua stessa altezza (-100%) e centrarlo orizzontalmente (-50%).
        // Questo garantisce che sia sempre posizionato correttamente sopra il tasto,
        // indipendentemente dalla sua altezza (una o due righe).        
    }
}

// Inizializza il dispatcher quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
    new ImagePreviewDispatcher();
});