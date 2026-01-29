// /Applications/XAMPP/xamppfiles/htdocs/TastieraWebComponents riserva8A/services/VoiceService.js

export class VoiceService {
    constructor() {
        this.recognition = null;
        this.synth = window.speechSynthesis;
        this.isListening = false;
        this.isPausedForSpeaking = false;
        this.lang = 'en-GB';
        
        // Callbacks
        this.onResultCallback = null;
        this.onSoundStartCallback = null;
        this.onSoundEndCallback = null;
        this.onErrorCallback = null;
        this.onStartCallback = null;
        this.onEndCallback = null;

        this.initRecognition();
    }

    initRecognition() {
        if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
            console.warn('Speech Recognition API not supported in this browser.');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 20;
        this.recognition.lang = this.lang;

        this.recognition.onstart = () => {
            this.isListening = true;
            if (this.onStartCallback) this.onStartCallback();
        };

        this.recognition.onend = () => {
            // Se era attivo e non è stato messo in pausa per parlare, riprova a partire (Always On)
            if (this.isListening && !this.isPausedForSpeaking) {
                try {
                    this.recognition.start();
                } catch (e) {
                    // Ignora errori di riavvio immediato
                }
            } else if (!this.isPausedForSpeaking) {
                this.isListening = false;
                if (this.onEndCallback) this.onEndCallback();
            }
        };

        this.recognition.onresult = (event) => {
            if (this.onResultCallback) this.onResultCallback(event);
        };

        this.recognition.onsoundstart = () => {
            if (this.onSoundStartCallback) this.onSoundStartCallback();
        };

        this.recognition.onsoundend = () => {
            if (this.onSoundEndCallback) this.onSoundEndCallback();
        };

        this.recognition.onerror = (event) => {
            if (this.onErrorCallback) this.onErrorCallback(event);
        };
    }

    setLanguage(lang) {
        this.lang = lang;
        if (this.recognition) {
            this.recognition.lang = lang;
            // Se è in ascolto, riavvia per applicare la lingua
            if (this.isListening) {
                this.stop();
                setTimeout(() => this.start(), 100);
            }
        }
    }

    setGrammar(grammarString) {
        if (!this.recognition) return;
        const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;
        if (SpeechGrammarList) {
            const speechRecognitionList = new SpeechGrammarList();
            speechRecognitionList.addFromString(grammarString, 1);
            this.recognition.grammars = speechRecognitionList;
        }
    }

    start() {
        if (!this.recognition) return;
        this.isListening = true;
        this.isPausedForSpeaking = false;
        try {
            this.recognition.start();
        } catch (e) {
            // Spesso lancia errore se è già partito, lo ignoriamo
        }
    }

    stop() {
        if (!this.recognition) return;
        this.isListening = false;
        this.isPausedForSpeaking = false;
        try {
            this.recognition.abort(); // Abort è più veloce di stop
        } catch (e) {}
    }

    /**
     * Parla un testo e gestisce automaticamente la pausa del microfono
     * per evitare che il computer si ascolti da solo.
     */
    speak(text, options = {}) {
        if (!this.synth) return null;
        
        this.synth.cancel(); // Ferma precedenti

        // Gestione conflitto Audio/Microfono
        const wasListening = this.isListening;
        if (wasListening) {
            this.stop();
            this.isPausedForSpeaking = true;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = options.lang || this.lang;
        utterance.rate = options.rate || 0.9;
        utterance.pitch = options.pitch || 1.0;
        utterance.volume = options.volume || 1.0;

        // Selezione voce intelligente
        const voices = this.synth.getVoices();
        const targetVoice = voices.find(v => v.lang === utterance.lang && (v.name.includes('Female') || v.name.includes('Google UK English Female'))) 
                         || voices.find(v => v.lang === utterance.lang);
        if (targetVoice) utterance.voice = targetVoice;

        // Callback per riattivare il microfono
        const resumeListening = () => {
            if (wasListening && this.isPausedForSpeaking) {
                setTimeout(() => {
                    if (!this.synth.speaking) {
                        this.isPausedForSpeaking = false;
                        this.start();
                    }
                }, 200); // Piccolo buffer
            }
        };

        utterance.onend = (e) => {
            resumeListening();
            if (options.onEnd) options.onEnd(e);
        };

        utterance.onerror = (e) => {
            resumeListening();
            if (options.onError) options.onError(e);
        };

        // Eventi boundary per animazioni
        if (options.onBoundary) {
            utterance.onboundary = options.onBoundary;
        }

        this.synth.speak(utterance);
        return utterance;
    }

    cancelSpeech() {
        if (this.synth) this.synth.cancel();
    }
}

export const voiceService = new VoiceService();