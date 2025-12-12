# TstieraWebComponents-riserva8A

## 🎮 Photo Game Web Component

Un moderno componente web per un gioco di memoria fotografica, completamente responsive e costruito con vanilla JavaScript e CSS Flexbox.

### ✨ Caratteristiche

- **📱 Responsive Design**: Layout completamente responsive che si adatta a mobile, tablet e desktop
- **🎨 Web Component**: Componente riutilizzabile con Shadow DOM per l'incapsulamento
- **⚡ Performance**: Animazioni fluide con CSS transitions
- **🎯 Game Logic Completa**: Timer, conteggio mosse, tracking coppie
- **🔧 Configurabile**: Livelli di difficoltà personalizzabili
- **♿ Accessibile**: Design moderno e user-friendly

### 🚀 Utilizzo

#### Installazione

Includi semplicemente il file JavaScript nel tuo progetto:

```html
<script src="photo-game.js"></script>
```

#### Esempio Base

```html
<photo-game level="medium"></photo-game>
```

#### Attributi Disponibili

- `level`: Imposta la difficoltà del gioco
  - `easy` - 4 coppie di carte (8 carte totali)
  - `medium` - 6 coppie di carte (12 carte totali) [default]
  - `hard` - 8 coppie di carte (16 carte totali)

### 📐 Struttura Responsive

Il componente utilizza CSS Flexbox per garantire un layout responsive perfetto:

- **Desktop (1200px+)**: Griglia a 5 colonne
- **Tablet (768px-1199px)**: Griglia a 4 colonne
- **Mobile Large (480px-767px)**: Griglia a 3 colonne
- **Mobile Small (<480px)**: Griglia a 2 colonne

### 🎨 Implementazione Tecnica

#### Flexbox Layout

Tutti gli elementi principali utilizzano Flexbox:
- Header con statistiche responsive
- Controlli di gioco centrati
- Griglia delle carte con wrapping automatico
- Adattamento dinamico delle dimensioni

#### Shadow DOM

Il componente usa Shadow DOM per:
- Incapsulamento completo degli stili
- Prevenzione di conflitti CSS
- Migliore modularità e riutilizzabilità

#### Gestione Stato

Sistema interno di state management per:
- Tracking delle carte girate
- Rilevamento dei match
- Conteggio mosse e tempo
- Gestione vittoria

### 🎯 Come Giocare

1. Clicca su una carta per girarla
2. Clicca su una seconda carta per tentare un match
3. Se le carte corrispondono, rimangono scoperte
4. Se non corrispondono, si girano di nuovo
5. Completa tutte le coppie per vincere!

### 📦 File del Progetto

```
├── photo-game.js      # Web Component principale
├── index.html         # Demo page con documentazione
└── README.md          # Questo file
```

### 🛠️ Sviluppo

Per testare il componente localmente:

1. Clona il repository
2. Apri `index.html` in un browser moderno
3. Oppure usa un server locale:
   ```bash
   python -m http.server 8000
   # Naviga a http://localhost:8000
   ```

### 🌐 Browser Support

Il componente funziona su tutti i browser moderni che supportano:
- Custom Elements v1
- Shadow DOM v1
- CSS Flexbox
- ES6+ JavaScript

### 📝 Licenza

Questo progetto è open source e disponibile sotto la licenza MIT.