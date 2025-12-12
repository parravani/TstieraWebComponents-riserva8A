/**
 * PhotoGame Web Component
 * A responsive photo matching game using flexbox layout
 */
class PhotoGame extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    
    // Game state
    this.cards = [];
    this.flippedCards = [];
    this.matchedPairs = 0;
    this.moves = 0;
    this.timer = 0;
    this.timerInterval = null;
    this.isGameActive = false;
    
    // Default images - users can override via attribute
    this.images = [
      '🎨', '🎭', '🎪', '🎬', '🎮', '🎯', '🎲', '🎸'
    ];
  }

  connectedCallback() {
    this.render();
    this.setupGame();
  }

  disconnectedCallback() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  setupGame() {
    const level = this.getAttribute('level') || 'medium';
    const pairsCount = level === 'easy' ? 4 : level === 'hard' ? 8 : 6;
    
    // Create pairs of cards
    const selectedImages = this.images.slice(0, pairsCount);
    this.cards = [...selectedImages, ...selectedImages]
      .sort(() => Math.random() - 0.5)
      .map((image, index) => ({
        id: index,
        image,
        isFlipped: false,
        isMatched: false
      }));
    
    this.renderCards();
  }

  render() {
    const style = `
      <style>
        :host {
          display: block;
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        }

        .game-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .game-header {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          padding: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 12px;
          color: white;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .game-title {
          font-size: clamp(1.5rem, 4vw, 2rem);
          font-weight: bold;
          margin: 0;
        }

        .game-stats {
          display: flex;
          flex-wrap: wrap;
          gap: 20px;
          font-size: clamp(0.9rem, 2vw, 1rem);
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
        }

        .stat-label {
          opacity: 0.9;
          font-size: 0.85em;
        }

        .stat-value {
          font-size: 1.4em;
          font-weight: bold;
        }

        .game-controls {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 10px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 8px;
        }

        button {
          padding: 12px 24px;
          font-size: 1rem;
          font-weight: 600;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s ease;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }

        button:active {
          transform: translateY(0);
        }

        .cards-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 15px;
          justify-content: center;
          padding: 20px;
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        .card {
          width: calc(25% - 12px);
          min-width: 80px;
          max-width: 150px;
          aspect-ratio: 1;
          perspective: 1000px;
          cursor: pointer;
        }

        .card-inner {
          position: relative;
          width: 100%;
          height: 100%;
          transition: transform 0.6s;
          transform-style: preserve-3d;
        }

        .card.flipped .card-inner,
        .card.matched .card-inner {
          transform: rotateY(180deg);
        }

        .card-face {
          position: absolute;
          width: 100%;
          height: 100%;
          backface-visibility: hidden;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: clamp(2rem, 5vw, 3.5rem);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }

        .card-front {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .card-back {
          background: white;
          transform: rotateY(180deg);
          border: 3px solid #667eea;
        }

        .card.matched .card-back {
          background: linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%);
          border-color: #84fab0;
        }

        .victory-message {
          display: none;
          padding: 30px;
          text-align: center;
          background: linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%);
          border-radius: 12px;
          color: #333;
          animation: slideIn 0.5s ease;
        }

        .victory-message.show {
          display: block;
        }

        .victory-message h2 {
          margin: 0 0 15px 0;
          font-size: clamp(1.5rem, 4vw, 2.5rem);
        }

        .victory-message p {
          margin: 5px 0;
          font-size: clamp(1rem, 2vw, 1.2rem);
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Responsive breakpoints */
        @media (max-width: 768px) {
          .card {
            width: calc(33.333% - 10px);
          }
        }

        @media (max-width: 480px) {
          :host {
            padding: 10px;
          }

          .game-header {
            padding: 15px;
          }

          .cards-grid {
            gap: 10px;
            padding: 15px;
          }

          .card {
            width: calc(50% - 5px);
          }
        }

        @media (min-width: 1200px) {
          .card {
            width: calc(20% - 12px);
          }
        }
      </style>
    `;

    const template = `
      ${style}
      <div class="game-container">
        <div class="game-header">
          <h1 class="game-title">🎮 Photo Game</h1>
          <div class="game-stats">
            <div class="stat-item">
              <span class="stat-label">Mosse</span>
              <span class="stat-value" id="moves">0</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Tempo</span>
              <span class="stat-value" id="timer">0:00</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Coppie</span>
              <span class="stat-value" id="pairs">0</span>
            </div>
          </div>
        </div>

        <div class="game-controls">
          <button id="new-game">Nuovo Gioco</button>
          <button id="reset">Reset</button>
        </div>

        <div class="cards-grid" id="cards-grid"></div>

        <div class="victory-message" id="victory-message">
          <h2>🎉 Congratulazioni!</h2>
          <p>Hai completato il gioco!</p>
          <p id="final-stats"></p>
        </div>
      </div>
    `;

    this.shadowRoot.innerHTML = template;
    this.attachEventListeners();
  }

  renderCards() {
    const grid = this.shadowRoot.getElementById('cards-grid');
    grid.innerHTML = '';

    this.cards.forEach(card => {
      const cardElement = document.createElement('div');
      cardElement.className = 'card';
      cardElement.dataset.id = card.id;
      
      cardElement.innerHTML = `
        <div class="card-inner">
          <div class="card-face card-front">?</div>
          <div class="card-face card-back">${card.image}</div>
        </div>
      `;

      cardElement.addEventListener('click', () => this.handleCardClick(card.id));
      grid.appendChild(cardElement);
    });
  }

  attachEventListeners() {
    this.shadowRoot.getElementById('new-game').addEventListener('click', () => this.startNewGame());
    this.shadowRoot.getElementById('reset').addEventListener('click', () => this.resetGame());
  }

  handleCardClick(cardId) {
    const card = this.cards.find(c => c.id === cardId);
    const cardElement = this.shadowRoot.querySelector(`[data-id="${cardId}"]`);

    // Start timer on first click
    if (!this.isGameActive) {
      this.startTimer();
      this.isGameActive = true;
    }

    // Prevent clicking on already flipped or matched cards
    if (card.isFlipped || card.isMatched || this.flippedCards.length >= 2) {
      return;
    }

    // Flip the card
    card.isFlipped = true;
    cardElement.classList.add('flipped');
    this.flippedCards.push(card);

    // Check for match when two cards are flipped
    if (this.flippedCards.length === 2) {
      this.moves++;
      this.updateStats();
      
      setTimeout(() => this.checkMatch(), 800);
    }
  }

  checkMatch() {
    const [card1, card2] = this.flippedCards;
    const card1Element = this.shadowRoot.querySelector(`[data-id="${card1.id}"]`);
    const card2Element = this.shadowRoot.querySelector(`[data-id="${card2.id}"]`);

    if (card1.image === card2.image) {
      // Match found
      card1.isMatched = true;
      card2.isMatched = true;
      card1Element.classList.add('matched');
      card2Element.classList.add('matched');
      this.matchedPairs++;
      this.updateStats();

      // Check for victory
      if (this.matchedPairs === this.cards.length / 2) {
        this.endGame();
      }
    } else {
      // No match - flip back
      card1.isFlipped = false;
      card2.isFlipped = false;
      card1Element.classList.remove('flipped');
      card2Element.classList.remove('flipped');
    }

    this.flippedCards = [];
  }

  startTimer() {
    this.timerInterval = setInterval(() => {
      this.timer++;
      this.updateStats();
    }, 1000);
  }

  updateStats() {
    const minutes = Math.floor(this.timer / 60);
    const seconds = this.timer % 60;
    this.shadowRoot.getElementById('timer').textContent = 
      `${minutes}:${seconds.toString().padStart(2, '0')}`;
    this.shadowRoot.getElementById('moves').textContent = this.moves;
    this.shadowRoot.getElementById('pairs').textContent = 
      `${this.matchedPairs}/${this.cards.length / 2}`;
  }

  endGame() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    this.isGameActive = false;

    const victoryMessage = this.shadowRoot.getElementById('victory-message');
    const finalStats = this.shadowRoot.getElementById('final-stats');
    const minutes = Math.floor(this.timer / 60);
    const seconds = this.timer % 60;
    
    finalStats.textContent = `Mosse: ${this.moves} | Tempo: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    victoryMessage.classList.add('show');
  }

  startNewGame() {
    this.resetGame();
    this.setupGame();
  }

  resetGame() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    
    this.flippedCards = [];
    this.matchedPairs = 0;
    this.moves = 0;
    this.timer = 0;
    this.isGameActive = false;
    
    this.shadowRoot.getElementById('victory-message').classList.remove('show');
    this.updateStats();
  }
}

// Register the custom element
customElements.define('photo-game', PhotoGame);
