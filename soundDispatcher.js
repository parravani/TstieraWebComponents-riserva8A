class SoundDispatcher {

    constructor() {

        // Singleton protection
        if (window.__soundDispatcherInstance) {
            return window.__soundDispatcherInstance;
        }
        window.__soundDispatcherInstance = this;

        this.audio = new Audio();
        this.playlist = [];
        this.isPlaying = false;

        this.enableSound = true;
        this.enableWordSound = true;

        // Playback chain
        this.audio.addEventListener("ended", () => this.playNext());

        // Global event listener
        document.body.addEventListener("keyRelease", (e) => this.handleKeyRelease(e));
    }

    // ---- EVENT ENTRYPOINT ----
    handleKeyRelease(event) {
        const data = event.detail || {};

        const isPhotoGamePage = window.location.pathname.includes('/games/photo-game.html');

        // Aggiungi il suono del tasto SOLO se NON siamo nella pagina del photo-game
        if (!isPhotoGamePage && this.enableSound && data.sound) {
            this.addToPlaylist(data.sound);
        }

        // Aggiungi il wordSound SOLO se NON siamo nella pagina del photo-game
        if (!isPhotoGamePage && this.enableWordSound && data.wordSound) {
            this.addToPlaylist(data.wordSound);
        }
    }

    // ---- PUBLIC API ----
    playSound(src) {
        if (!src) return;
        this.stop();
        this.addToPlaylist(src);
    }

    stop() {
        this.audio.pause();
        this.audio.currentTime = 0;
        this.playlist = [];
        this.isPlaying = false;
    }

    // ---- INTERNAL QUEUE ----
    addToPlaylist(src) {
        if (typeof src !== "string" || !src.trim()) return;

        this.playlist.push(src);

        if (!this.isPlaying) {
            this.playNext();
        }
    }

    playNext() {
        if (this.playlist.length === 0) {
            this.isPlaying = false;
            return;
        }

        const nextSrc = this.playlist.shift();
        this.isPlaying = true;

        this.audio.src = nextSrc;

        this.audio.play().catch(err => {
            console.error("Errore nella riproduzione audio:", err);
            this.isPlaying = false;
            this.playNext(); // fallback automatico
        });
    }
}

// Ensure singleton creation
window.soundDispatcher = new SoundDispatcher();
