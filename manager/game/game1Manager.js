﻿// File: Game1Manager.js (VERSIONE FINALE E SEMPLIFICATA)

document.addEventListener('DOMContentLoaded', () => {

    const wordDisplayComponent = document.querySelector('word-display');        //componente del gioco
    const paroleToggleButton = document.getElementById('paroleToggleButton');   //pulsante per accendere il gioco

    let isParoleModeOn = false;
    let lettersData = [];

    if (!wordDisplayComponent || !paroleToggleButton) {
        console.error("Errore critico: Il componente <word-display> o il #paroleToggleButton non sono stati trovati.");
        return;
    }

    // Carica i dati delle lettere all'avvio
    initializeManager();

    async function initializeManager() {
        try {
            const dataPath = window.location.pathname.includes('/games/') ? '../data/' : 'data/';
            const response = await fetch(`${dataPath}letters.json`);      //per caricare colori e suoni
            const data = await response.json();
            lettersData = data.layout.flatMap(row => row.keys);
        } catch (error) {
            console.error("Game1Manager: Errore nel caricare letters.json", error);
        }
        attachEventListeners();
    }

    function attachEventListeners() {
        paroleToggleButton.addEventListener('click', (e) => {
            e.stopPropagation();
            isParoleModeOn = !isParoleModeOn;
            paroleToggleButton.classList.toggle('disabled-effect', !isParoleModeOn);
            if (!isParoleModeOn) {
                wordDisplayComponent.hide();
            } else {
                // Se si attiva, disattiva l'altro gioco
                document.dispatchEvent(new CustomEvent('disable-game2'));
            }
        });

        document.body.addEventListener('keyPress', (event) => {
            if (!isParoleModeOn) return;

            const { char } = event.detail;
            const letterData = lettersData.find(letter => letter.ch === char);

            if (letterData) {
                // L'orchestratore si limita a dare l'ordine!
                wordDisplayComponent.show(letterData);      //comando al gioco di visualizzare la frase della lettera selezionata
            }
        });

        document.body.addEventListener('keyEnter', () => {
            // Nasconde il display quando il mouse entra in un nuovo tasto
            //wordDisplayComponent.hide();
        });

        // Aggiunge un listener per disattivarsi quando l'altro gioco viene attivato
        document.addEventListener('disable-game1', () => {
            if (isParoleModeOn) {
                isParoleModeOn = false;
                paroleToggleButton.classList.add('disabled-effect');
                wordDisplayComponent.hide();
            }
        });
    }

});