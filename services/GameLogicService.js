// /Applications/XAMPP/xamppfiles/htdocs/TastieraWebComponents riserva8A/services/GameLogicService.js

export class GameLogicService {

    /**
     * Genera la lista ottimizzata di opzioni IPA (simboli corretti + distrattori intelligenti).
     * Gestisce le coppie vocali (breve/lunga), i distrattori forzati e l'ordinamento.
     * @param {Array<string>} correctSequence - La sequenza corretta di simboli IPA.
     * @param {Array<string>} allPhonemes - Tutti i fonemi disponibili nel gioco.
     * @returns {Array<string>} Array di simboli ordinati e pronti per essere renderizzati.
     */
    static generateIpaOptions(correctSequence, allPhonemes) {
        if (!correctSequence || !allPhonemes || allPhonemes.length === 0) return [];

        const correctIpaSet = new Set(correctSequence);
        // Escludi i segnaposto SILENT e spazi dai simboli corretti per l'analisi
        const correctSymbols = correctSequence.filter(s => s !== 'SILENT' && s !== ' ');

        // Deriva automaticamente le coppie breve↔lungo dai simboli disponibili.
        const hasIpaMarker = allPhonemes.some(p => p.includes('\u02D0'));
        const hasColonMarker = allPhonemes.some(p => p.includes(':'));
        const longMarker = hasIpaMarker ? '\u02D0' : (hasColonMarker ? ':' : '\u02D0');
        
        const counterparts = new Map(); // short -> long
        const reverseCounterparts = new Map(); // long -> short
        const phonemeSet = new Set(allPhonemes);

        // Deduzione automatica coppie
        for (const sym of allPhonemes) {
            if (sym.includes(longMarker)) {
                const short = sym.replaceAll(longMarker, '');
                if (phonemeSet.has(short)) {
                    counterparts.set(short, sym);
                    reverseCounterparts.set(sym, short);
                }
            } else {
                const long = sym + longMarker;
                if (phonemeSet.has(long)) {
                    counterparts.set(sym, long);
                    reverseCounterparts.set(long, sym);
                }
            }
        }

        // Coppie manuali esplicite
        const manualPairs = [
            ['ɪ', `i${longMarker}`],
            ['ʌ', `a${longMarker}`],
            ['ɒ', `ɔ${longMarker}`],
            ['ʊ', `u${longMarker}`],
            ['ə', `ɜ${longMarker}`],
            ['n', 'ŋ'],
            ['ʃ', 'tʃ'],
            ['θ', 'ð'],
            ['s', 'z'],
            ['t', 'd'],
            ['f', 'v']
        ];
        for (const [shortSym, longSym] of manualPairs) {
            if (phonemeSet.has(shortSym) && phonemeSet.has(longSym)) {
                counterparts.set(shortSym, longSym);
                reverseCounterparts.set(longSym, shortSym);
            }
        }
        
        // Filtra per ottenere solo i distrattori (simboli non presenti nella risposta corretta)
        const distractorsPool = allPhonemes.filter(symbol => !correctIpaSet.has(symbol) && symbol !== 'double' && symbol !== ':' && symbol !== '\u02D0');

        // Forza la presenza della controparte (breve↔lungo) nei distrattori
        const forcedDistractors = new Set();
        const syntheticForced = new Set();
        
        for (const sym of correctSymbols) {
            if (counterparts.has(sym)) {
                const longSym = counterparts.get(sym);
                if (!correctIpaSet.has(longSym)) {
                    if (phonemeSet.has(longSym)) forcedDistractors.add(longSym);
                    else syntheticForced.add(longSym);
                }
            }
            if (reverseCounterparts.has(sym)) {
                const shortSym = reverseCounterparts.get(sym);
                if (!correctIpaSet.has(shortSym)) {
                    if (phonemeSet.has(shortSym)) forcedDistractors.add(shortSym);
                    else syntheticForced.add(shortSym);
                }
            }
        }

        // Costruisci la lista finale dei distrattori
        const basePool = distractorsPool.filter(d => !forcedDistractors.has(d));
        const minDistractors = Math.max(7, forcedDistractors.size);

        // 1) PRIORITÀ COPPIE
        const pairPriority = [];
        const pairAdded = new Set();
        for (const [a, b] of manualPairs) {
            const pairRelevant = correctIpaSet.has(a) || correctIpaSet.has(b);
            if (!pairRelevant) continue;

            const aIsCorrect = correctIpaSet.has(a);
            const bIsCorrect = correctIpaSet.has(b);
            const aCandidate = (!aIsCorrect && (forcedDistractors.has(a) || syntheticForced.has(a) || basePool.includes(a)));
            const bCandidate = (!bIsCorrect && (forcedDistractors.has(b) || syntheticForced.has(b) || basePool.includes(b)));
            if (aCandidate || bCandidate) {
                if (aCandidate && !pairAdded.has(a)) { pairPriority.push(a); pairAdded.add(a); }
                if (bCandidate && !pairAdded.has(b)) { pairPriority.push(b); pairAdded.add(b); }
            }
        }

        // 2) RIEMPIMENTO
        const fillList = [];
        for (const s of forcedDistractors) { if (!pairAdded.has(s)) fillList.push(s); }
        for (const s of syntheticForced) { if (!pairAdded.has(s)) fillList.push(s); }

        const numberOfDistractors = Math.min(minDistractors, pairPriority.length + fillList.length + basePool.length);
        const remainingSlots = Math.max(0, numberOfDistractors - pairPriority.length - fillList.length);
        const randomFill = [...basePool].filter(s => !pairAdded.has(s)).sort(() => 0.5 - Math.random()).slice(0, remainingSlots);

        const finalDistractors = [...pairPriority, ...fillList, ...randomFill];
        
        // Ordina le options affinché breve↔lungo stiano adiacenti
        const used = new Set();
        const orderedOptions = [];

        const appendCounterpartIfAvailable = (sym) => {
            let counterpart = null;
            if (counterparts.has(sym)) counterpart = counterparts.get(sym);
            else if (reverseCounterparts.has(sym)) counterpart = reverseCounterparts.get(sym);
            if (counterpart && !used.has(counterpart)) {
                if (correctSymbols.includes(counterpart) || finalDistractors.includes(counterpart)) {
                    used.add(counterpart);
                    orderedOptions.push(counterpart);
                }
            }
        };

        for (const sym of correctSymbols) {
            orderedOptions.push(sym);
            appendCounterpartIfAvailable(sym);
        }
        for (const sym of finalDistractors) {
            if (used.has(sym)) continue;
            used.add(sym);
            orderedOptions.push(sym);
            appendCounterpartIfAvailable(sym);
        }

        // Mescola i blocchi mantenendo le coppie adiacenti
        const groups = [];
        for (let i = 0; i < orderedOptions.length; i++) {
            const sym = orderedOptions[i];
            const next = orderedOptions[i + 1];
            const isPair = next && (
                (counterparts.has(sym) && counterparts.get(sym) === next) ||
                (reverseCounterparts.has(sym) && reverseCounterparts.get(sym) === next)
            );
            if (isPair) {
                groups.push([sym, next]);
                i++;
            } else {
                groups.push([sym]);
            }
        }
        
        // Fisher-Yates shuffle
        for (let i = groups.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [groups[i], groups[j]] = [groups[j], groups[i]];
        }
        
        return groups.flat();
    }
}
