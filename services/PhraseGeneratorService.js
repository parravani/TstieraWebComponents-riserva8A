export class PhraseGeneratorService {
    constructor() {
        this.usedPracticePhrases = new Set();
    }

    resetHistory() {
        this.usedPracticePhrases.clear();
    }

    async generateRandomPracticePhrase(word, difficultyLevel, commonWordsSet) {
        const w = word.toLowerCase();
        
        // Helper per formare il gerundio (ing form)
        const getIngForm = (verb) => {
            const v = verb.toLowerCase();
            if (v === 'be') return 'being';
            if (v === 'see') return 'seeing';
            if (v.endsWith('ie')) return v.slice(0, -2) + 'ying';
            if (v.endsWith('e') && !v.endsWith('ee') && !v.endsWith('oe') && !v.endsWith('ye')) return v.slice(0, -1) + 'ing';
            const doubling = ['run', 'swim', 'cut', 'put', 'get', 'let', 'sit', 'win', 'stop', 'plan', 'shop', 'chat', 'beg', 'rob', 'rub', 'fit', 'hit', 'set'];
            if (doubling.includes(v)) return v + v.slice(-1) + 'ing';
            return v + 'ing';
        };

        // --- TENTATIVO 1: PESCA DALLA RETE (API Dizionario + Traduzione) ---
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                const examples = [];
                if (Array.isArray(data)) {
                    data.forEach(entry => {
                        if (entry.meanings) {
                            entry.meanings.forEach(meaning => {
                                if (meaning.definitions) {
                                    meaning.definitions.forEach(def => {
                                        if (def.example) examples.push(def.example);
                                    });
                                }
                            });
                        }
                    });
                }

                const availableExamples = examples.filter(ex => {
                    if (this.usedPracticePhrases.has(ex)) return false;
                    if (ex.length > 100) return false;
                    if (ex.split(/\s+/).length > 10) return false;
                    return true;
                });

                if (difficultyLevel === 'beginner' || difficultyLevel === 'elementary') {
                    const filteredExamples = availableExamples.filter(ex => {
                        const lowerEx = ex.toLowerCase();
                        
                        if (difficultyLevel === 'beginner') {
                            const forbiddenTenses = [
                                'will', 'shall', 'won\'t', 'shan\'t', 'would', 'should', 'could', 'wouldn\'t', 'shouldn\'t', 'couldn\'t',
                                'was', 'were', 'wasn\'t', 'weren\'t', 'did', 'didn\'t',
                                'had', 'hadn\'t', 'been', 'gone', 'done', 'seen', 'taken', 'eaten',
                                'yesterday', 'tomorrow', 'last', 'ago'
                            ];
                            const words = lowerEx.split(/[\s,.!?]+/);
                            if (words.some(wd => forbiddenTenses.includes(wd))) return false;
                            const edExceptions = ['red', 'bed', 'fed', 'led', 'shed', 'speed', 'need', 'seed', 'weed', 'feed', 'breed', 'bleed'];
                            if (words.some(wd => wd.endsWith('ed') && wd.length > 3 && !edExceptions.includes(wd))) return false;
                        }

                        const wordsInSentence = ex.toLowerCase().match(/[a-z]+/g) || [];
                        let unknownWords = 0;
                        for (const sWord of wordsInSentence) {
                            if (sWord.includes(w) || w.includes(sWord)) continue;
                            if (!commonWordsSet.has(sWord)) unknownWords++;
                        }
                        const limit = difficultyLevel === 'beginner' ? 1 : 2;
                        return unknownWords <= limit;
                    });
                    if (filteredExamples.length > 0) {
                        availableExamples.length = 0;
                        availableExamples.push(...filteredExamples);
                    }
                }
                
                if (availableExamples.length > 0) {
                    const selectedText = availableExamples[Math.floor(Math.random() * availableExamples.length)];
                    this.usedPracticePhrases.add(selectedText);

                    let translation = "Traduzione in corso...";
                    const transText = await this.fetchTranslation(selectedText, 'en', 'it');
                    if (transText) translation = transText;

                    return { text: selectedText, translation: translation };
                }
            }
        } catch (e) {
            console.warn("Pesca online fallita, uso fallback locale:", e);
        }

        // --- TENTATIVO 2: FALLBACK LOCALE ---
        // (Logica semplificata per brevità, espandibile come nel codice originale se necessario)
        const templates = [
            { text: `I like ${w}`, translation: '', type: 'positive' },
            { text: `Do you see the ${w}?`, translation: '', type: 'question' },
            { text: `The ${w} is here`, translation: '', type: 'positive' }
        ];
        
        const selected = templates[Math.floor(Math.random() * templates.length)];
        const transTemplate = await this.fetchTranslation(selected.text, 'en', 'it');
        if (transTemplate) {
            selected.translation = transTemplate;
        }

        this.usedPracticePhrases.add(selected.text);
        return selected;
    }

    async fetchTranslation(text, sourceLang, targetLang) {
        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (data && data[0]) {
                    return data[0].map(segment => segment[0]).join('');
                }
            }
        } catch (e) {
            console.warn("Google GTX translation failed, trying fallback...", e);
        }

        try {
            const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`);
            const data = await res.json();
            if (data && data.responseData && data.responseStatus === 200) {
                const translated = data.responseData.translatedText;
                if (!translated.includes("MYMEMORY WARNING") && !translated.includes("QUERY LENGTH LIMIT EXCEEDED")) {
                    return translated;
                }
            }
        } catch (e) {
            console.warn("MyMemory translation failed", e);
        }

        return '';
    }

    async getEnglishTranslation(text) {
        return await this.fetchTranslation(text, 'it', 'en');
    }

    async getItalianTranslation(text) {
        return await this.fetchTranslation(text, 'en', 'it');
    }
}

export const phraseGeneratorService = new PhraseGeneratorService();