export class GameTimer {
    constructor(callbacks) {
        this.timerId = null;
        this.timeLeft = 60;
        this.selectedDuration = 60;
        this.onTick = callbacks.onTick;
        this.onEnd = callbacks.onEnd;
    }

    start() {
        if (this.timerId) return;
        this.timeLeft = this.selectedDuration;
        if (this.onTick) this.onTick(this.timeLeft);
        
        this.timerId = setInterval(() => {
            this.timeLeft--;
            if (this.onTick) this.onTick(this.timeLeft);
            
            if (this.timeLeft <= 0) {
                this.stop();
                if (this.onEnd) this.onEnd();
            }
        }, 1000);
    }

    stop() {
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
        this.timeLeft = this.selectedDuration;
    }

    adjust(amount) {
        if (!this.timerId) {
            let newTime = this.selectedDuration + amount;
            this.selectedDuration = Math.max(5, Math.min(newTime, 180));
            this.timeLeft = this.selectedDuration;
            if (this.onTick) this.onTick(this.timeLeft);
        }
    }
    
    isRunning() {
        return !!this.timerId;
    }

    getTimeLeft() {
        return this.timeLeft;
    }
}