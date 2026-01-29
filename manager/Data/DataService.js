// /manager/data/dataService.js
export class DataService {
    constructor() {
        // cache dei dati e delle colormap per file
        this.dataCache = {};      // { [filePath]: datiJSON }
        this.colorMapCache = {};  // { [filePath]: colorMap }
        this.loadingPromises = {}; // evita fetch duplicati simultanei
    }

    /**
     * Carica un file JSON.
     * Se il file è già stato caricato, ritorna la cache.
     * @param {string} filePath - percorso del file
     * @returns {Promise<Object>} dati JSON
     */
    async getData(filePath) {
        if (!filePath) throw new Error("DataService: filePath non definito");

        // se già in cache, ritorna subito
        if (this.dataCache[filePath]) return this.dataCache[filePath];

        // se il file è già in caricamento, ritorna la stessa promessa
        if (this.loadingPromises[filePath]) return this.loadingPromises[filePath];

        // altrimenti fetch
        const promise = (async () => {
            const res = await fetch(filePath);
            if (!res.ok) throw new Error(`DataService: fetch ${filePath} fallito, status ${res.status}`);
            const json = await res.json();
            this.dataCache[filePath] = json;
            this.colorMapCache[filePath] = this._generateColorMap(json);
            this.colorMapCache[filePath].source = filePath; // traccia la sorgente della colormap
            delete this.loadingPromises[filePath];
            return json;
        })();

        this.loadingPromises[filePath] = promise;
        return promise;
    }

    /**
     * Ritorna la color map associata a un file.
     * Se il file non è stato caricato, lo carica automaticamente.
     * @param {string} filePath - percorso del file
     * @returns {Promise<Object>} color map
     */
    async getColorMap(filePath) {
        if (!filePath) throw new Error("DataService: filePath non definito");

        // se già presente
        if (this.colorMapCache[filePath]) return this.colorMapCache[filePath];

        // altrimenti carica i dati e ritorna la color map
        await this.getData(filePath);
        return this.colorMapCache[filePath];
    }

    /**
     * Funzione interna per generare la color map da un JSON
     * @param {Object} data - dati caricati
     * @returns {Object} mappa { char: color }
     */
    _generateColorMap(data) {
        const map = {};
        if (!data?.layout) return map;
        data.layout.forEach(row => {
            row.keys.forEach(key => {
                const ch = key.ch || key.symbol;
                if (ch && key.style) {
                    map[ch] = {
                        color: key.style.color,
                        textShadow: key.style.textShadow,
                        borderColor: key.style.borderColor,
                        flex: key.style.flex
                    };
                }
            });
        });
        return map;
    }

    /**
     * Metodo helper per pulire cache (opzionale)
     */
    clearCache(filePath) {
        if (filePath) {
            delete this.dataCache[filePath];
            delete this.colorMapCache[filePath];
        } else {
            this.dataCache = {};
            this.colorMapCache = {};
            this.loadingPromises = {};
        }
    }
}

export const dataService = new DataService();
