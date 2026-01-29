export class StyleUtils {
    /**
     * Converte un colore esadecimale in formato RGBA.
     * @param {string} hex - Il colore esadecimale (es. "#FF0000").
     * @param {number} alpha - Il valore di trasparenza (da 0 a 1).
     * @returns {string} La stringa RGBA (es. "rgba(255, 0, 0, 0.5)").
     */
    static hexToRgba(hex, alpha) {
        // Gestisce colori esadecimali a 3 cifre (es. #F0C) espandendoli a 6 cifre (#FF00CC)
        if (hex.length === 4) {
            hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
        }
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
}