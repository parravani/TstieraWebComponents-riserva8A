/**
 * @file Gestisce i comandi vocali per l'applicazione.
 * Separare i comandi dal vocabolario generale può migliorare l'accuratezza del riconoscimento.
 */

/**
 * Mappa i comandi vocali agli identificatori di azione interni.
 * Questo permette di supportare più lingue.
 * Il motore di riconoscimento vocale dovrebbe essere configurato per ascoltare queste frasi specifiche.
 */
export const voiceCommands = {
  // Inglese (US)
  'en-US': {
    'clear': 'action_clear',
    'close': 'action_close',
  },
  // Italiano
  'it-IT': {
    'pulisci': 'action_clear', // "Pulisci" è una traduzione adatta per "clear"
    'chiudi': 'action_close',
  }
};