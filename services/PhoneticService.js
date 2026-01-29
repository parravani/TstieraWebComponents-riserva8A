// /Applications/XAMPP/xamppfiles/htdocs/TastieraWebComponents riserva8A/services/PhoneticService.js

export class PhoneticService {
    constructor() {
        this.validPhonemes = [];
    }

    /**
     * Imposta l'elenco dei fonemi validi supportati dal gioco.
     */
    setValidPhonemes(phonemes) {
        this.validPhonemes = phonemes || [];
        // Aggiunta manuale per simboli composti o mancanti
        this.validPhonemes.push('ɔ:');

        // Ordina per lunghezza decrescente per un parsing "greedy"
        this.validPhonemes.sort((a, b) => b.length - a.length);
    }

    /**
     * Recupera la trascrizione fonetica da un'API esterna.
     */
    async getPhoneticsFromApi(text) {
        if (!text) return '';
        const words = text.trim().split(/\s+/);
        const phoneticParts = [];

        // Determina il tipo di "due punti" (lunghezza) usato nel set di fonemi validi del gioco
        const useAsciiColon = this.validPhonemes.some(p => p.includes(':'));
        const useIpaColon = this.validPhonemes.some(p => p.includes('ː'));
        const colonChar = useIpaColon ? 'ː' : (useAsciiColon ? ':' : 'ː');

        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const cleanWord = word.replace(/[^a-zA-Z']/g, '');
            if (!cleanWord) {
                phoneticParts.push(''); 
                continue;
            }
            
            // Gestione casi speciali
            const lower = cleanWord.toLowerCase();
            if (lower === 'okay') { phoneticParts.push('əʊkeɪ'); continue; }
            if (cleanWord === 'I') { phoneticParts.push('aɪ'); continue; }
            if (lower === 'my') { phoneticParts.push('maɪ'); continue; }
            if (lower === 'is') { phoneticParts.push('ɪz'); continue; }
            if (lower === 'the') { phoneticParts.push('ðə'); continue; }
            if (lower === 'your') { phoneticParts.push(`jɔ${colonChar}`); continue; }
            if (lower === 'do') {
                // Regola: də all'inizio/mezzo, du: alla fine
                if (i === words.length - 1) {
                    phoneticParts.push(`du${colonChar}`);
                } else {
                    phoneticParts.push('də');
                }
                continue;
            }

            let ph = '';
            try {
                const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord.toLowerCase()}`);
                if (response.ok) {
                    const data = await response.json();
                    const entry = data[0];
                    
                    // Priorità UK
                    if (entry.phonetics) {
                        const ukEntry = entry.phonetics.find(x => x.audio && (x.audio.includes('-uk') || x.audio.includes('/uk/')));
                        if (ukEntry && ukEntry.text) ph = ukEntry.text;
                    }
                    
                    // Fallback
                    if (!ph) {
                        ph = entry.phonetic || (entry.phonetics && entry.phonetics.find(x => x.text) ? entry.phonetics.find(x => x.text).text : '') || '';
                    }

                    if (ph) {
                        ph = ph.replace(/^[\/\[]|[\/\]]$/g, '').replace(/[ˈˌ.]/g, '');
                        // Normalizzazione IPA (British English)
                        
                        // Adatta il simbolo di lunghezza (colon) al formato del gioco
                        if (colonChar === ':') {
                            ph = ph.replace(/ː/g, ':');
                        } else {
                            ph = ph.replace(/:/g, 'ː');
                        }

                        ph = ph.replace(/g/g, 'ɡ')
                               .replace(/ɹ/g, 'r')
                               .replace(/ɛ/g, 'e')
                               .replace(/oʊ/g, 'əʊ')
                               .replace(new RegExp(`a${colonChar}`, 'g'), `ɑ${colonChar}`)
                               .replace(new RegExp(`i(?!${colonChar}|ə)`, 'g'), 'ɪ')
                               .replace(new RegExp(`u(?!${colonChar}|ə)`, 'g'), 'ʊ')
                               .replace(/ɑɪ/g, 'aɪ');
                    }
                }
            } catch (e) {
                console.warn(`Phonetic fetch failed for ${cleanWord}:`, e);
            }
            phoneticParts.push(ph || cleanWord);
        }
        return phoneticParts.join(' ');
    }

    /**
     * Converte una stringa fonetica in un array di simboli validi.
     */
    parsePhoneticString(phoneticString) {
        if (phoneticString && phoneticString.includes('g') && !this.validPhonemes.includes('g') && this.validPhonemes.includes('ɡ')) {
            phoneticString = phoneticString.replaceAll('g', 'ɡ');
        }

        const symbols = [];
        let remainingString = phoneticString;
        while (remainingString.length > 0) {
            if (remainingString[0] === ' ') {
                symbols.push(' ');
                remainingString = remainingString.substring(1);
                continue;
            }
            
            let matchedPhoneme = this.validPhonemes.find(p => remainingString.startsWith(p));
            
            if (!matchedPhoneme && remainingString.length > 0) {
                const lower = remainingString[0].toLowerCase();
                if (this.validPhonemes.includes(lower)) {
                    matchedPhoneme = lower;
                }
            }

            if (matchedPhoneme) {
                symbols.push(matchedPhoneme);
                remainingString = remainingString.substring(remainingString.startsWith(matchedPhoneme) ? matchedPhoneme.length : 1);
            } else {
                console.warn(`Simbolo fonetico ignorato (non in tastiera): ${remainingString[0]}`);
                remainingString = remainingString.substring(1);
            }
        }
        return symbols;
    }

    /**
     * Allinea i fonemi alle lettere della parola (logica SILENT letters).
     */
    alignPhoneticsToLetters(text, phoneticString) {
        const textParts = text.split(/(\s+)/).filter(p => p);
        let processedPhonetic = phoneticString.trim();
        processedPhonetic = processedPhonetic.replace(/aɪə/g, 'aɪ ə').replace(/aʊə/g, 'aʊ ə');
        const allSymbols = this.parsePhoneticString(processedPhonetic);
        const finalAlignment = [];
        let phonemeCursor = 0;

        const isVowel = (symbol) => {
            return ['iː', 'ɪ', 'ʊ', 'uː', 'e', 'ə', 'ɜː', 'ɔː', 'æ', 'ʌ', 'ɑː', 'ɒ', 
                    'eɪ', 'aɪ', 'ɔɪ', 'əʊ', 'aʊ', 'ɪə', 'eə', 'ʊə', 'aɪə', 'aʊə'].includes(symbol);
        };

        for (let i = 0; i < textParts.length; i++) {
            const part = textParts[i];
            
            if (/^\s+$/.test(part)) {
                for (let i = 0; i < part.length; i++) finalAlignment.push(' ');
                if (phonemeCursor < allSymbols.length && allSymbols[phonemeCursor] === ' ') {
                    phonemeCursor++;
                }
                continue;
            }

            const word = part;
            const lowerWord = word.toLowerCase();
            const wordPhonemes = [];
            while (phonemeCursor < allSymbols.length && allSymbols[phonemeCursor] !== ' ') {
                wordPhonemes.push(allSymbols[phonemeCursor]);
                phonemeCursor++;
            }
            if (phonemeCursor < allSymbols.length && allSymbols[phonemeCursor] === ' ') {
                phonemeCursor++;
            }

            const letters = Array.from(word);
            const alignment = new Array(letters.length).fill(null);
            let p = 0; 
            let l = 0; 

            // --- ECCEZIONI ---
            if (lowerWord.startsWith('who')) {
                if (letters[0].toLowerCase() === 'w') {
                    alignment[0] = 'SILENT';
                    l = 1;
                }
            }

            // --- REGOLE ---
            while (l < letters.length) {
                if (alignment[l] !== null) { l++; continue; }

                const char = letters[l].toLowerCase();
                const nextChar = (l + 1 < letters.length) ? letters[l+1].toLowerCase() : null;
                const nextNextChar = (l + 2 < letters.length) ? letters[l+2].toLowerCase() : null;
                const isFinal = (l === letters.length - 1);

                // -EER ending
                if (char === 'e' && nextChar === 'e' && nextNextChar === 'r' && l + 2 === letters.length - 1) {
                    alignment[l] = 'SILENT';
                    alignment[l+1] = (p < wordPhonemes.length) ? wordPhonemes[p++] : 'SILENT';
                    alignment[l+2] = 'SILENT';
                    l += 3;
                    continue;
                }

                // EA digraph
                if (char === 'e' && nextChar === 'a') {
                    const currentPhoneme = (p < wordPhonemes.length) ? wordPhonemes[p] : null;
                    if (currentPhoneme === 'iː') {
                        alignment[l] = 'iː';
                        alignment[l+1] = 'SILENT';
                        p++;
                        l += 2;
                        continue;
                    }
                }

                // Lettere Doppie
                if (nextChar && char === nextChar) {
                    alignment[l] = (p < wordPhonemes.length) ? wordPhonemes[p++] : 'SILENT';
                    alignment[l+1] = 'SILENT';
                    l += 2;
                    continue;
                }

                // Digrafi con H
                if (nextChar === 'h' && ['t', 's', 'c', 'w'].includes(char)) {
                    alignment[l] = (p < wordPhonemes.length) ? wordPhonemes[p++] : 'SILENT';
                    alignment[l+1] = 'SILENT';
                    l += 2;
                    continue;
                }

                // OW
                if (char === 'o' && nextChar === 'w') {
                    alignment[l] = (p < wordPhonemes.length) ? wordPhonemes[p++] : 'SILENT';
                    alignment[l+1] = 'SILENT';
                    l += 2;
                    continue;
                }

                // E finale
                if (isFinal && char === 'e') {
                    const exceptions = ['me', 'he', 'she', 'we', 'be', 'the'];
                    if (!exceptions.includes(lowerWord)) {
                        alignment[l] = 'SILENT';
                        l++;
                        continue;
                    }
                }

                // ER finale
                if (char === 'e' && nextChar === 'r' && l + 1 === letters.length - 1) {
                    alignment[l] = 'SILENT';
                    alignment[l+1] = (p < wordPhonemes.length) ? wordPhonemes[p++] : 'SILENT';
                    l += 2;
                    continue;
                }

                // R finale (Linking R)
                if (isFinal && char === 'r') {
                    let isLinking = false;
                    if (phonemeCursor < allSymbols.length) {
                        const nextPhoneme = allSymbols[phonemeCursor];
                        if (isVowel(nextPhoneme)) isLinking = true;
                    }
                    if (!isLinking) {
                        alignment[l] = 'SILENT';
                        l++;
                        continue;
                    }
                }

                // H finale
                if (isFinal && char === 'h' && letters.length > 1 && !['oh', 'ah', 'eh'].includes(lowerWord)) {
                    alignment[l] = 'SILENT';
                    l++;
                    continue;
                }

                alignment[l] = (p < wordPhonemes.length) ? wordPhonemes[p++] : 'SILENT';
                l++;
            }
            finalAlignment.push(...alignment);
        }
        return finalAlignment;
    }

    normalizePhonemeSymbol(sym) {
        if (!sym) return sym;
        if (sym === 'g') return 'ɡ';
        if (sym.includes(':')) {
            const candidate = sym.replaceAll(':', '\u02D0');
            if (this.validPhonemes.includes(candidate)) return candidate;
        }
        if (sym === 'a\u02D0' || sym === 'a:') {
            if (this.validPhonemes.includes('ɑː')) return 'ɑː';
        }
        return sym;
    }
}

export const phoneticService = new PhoneticService();
