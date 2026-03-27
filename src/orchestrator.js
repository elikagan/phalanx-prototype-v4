/**
 * Demo Orchestrator
 *
 * Sequences the 8 scripted narrative exchanges.
 * Each exchange: user PTT → scan line → SARA response → map actions → radio chatter.
 * Screen transitions happen at specific exchanges.
 */

import * as state from './state.js';
import * as chat from './components/chat.js';
import * as mapCmd from './map-commands.js';
import * as fpv from './components/fpv.js';
import { EXCHANGES } from './scenarios/san-diego-pursuit.js';

let currentExchange = 0;
let isPlaying = false;

/** Get the current exchange index */
export function getIndex() {
  return currentExchange;
}

/** Check if an exchange is currently playing */
export function isActive() {
  return isPlaying;
}

/** Trigger the next exchange (called when user sends a message or auto-triggered) */
export async function next() {
  if (isPlaying || currentExchange >= EXCHANGES.length) return;
  isPlaying = true;

  try {
    const ex = EXCHANGES[currentExchange];

    // 1. User message (if not SARA-initiated)
    if (ex.userText) {
      await chat.appendUserWordByWord(ex.userText, 120);
      await wait(200);
    }

    // 2. Scan line
    await chat.appendScanLine(800);

    // 3. Radio chatter (if present, before SARA response)
    if (ex.radio) {
      chat.appendRadio(ex.radio.unit, ex.radio.text, ex.radio.time);
      await wait(400);
    }

    // 4. SARA response word-by-word
    await chat.appendSaraWordByWord(ex.saraText, 80);
    await wait(300);

    // 5. Execute map actions
    for (const action of ex.mapActions) {
      await mapCmd.execute(action);
    }

    // 6. FPV updates per exchange
    updateFpv(currentExchange);

    // 7. Screen transitions
    if (ex.id === 'ex-5') {
      state.set({ targetStatus: 'detected' });
      await wait(500);
      state.goToScreen(10);
    } else if (ex.id === 'ex-6') {
      state.set({ targetStatus: 'confirmed' });
      state.goToScreen(11);
    } else if (ex.id === 'ex-8') {
      state.goToScreen(12);
    }

    currentExchange++;
  } catch (e) {
    console.error('Orchestrator error at exchange', currentExchange, ':', e);
  } finally {
    isPlaying = false;
  }

  // Auto-trigger SARA-initiated exchanges (ex-3 and ex-7)
  if (currentExchange < EXCHANGES.length) {
    const nextEx = EXCHANGES[currentExchange];
    if (!nextEx.userText) {
      await wait(3000);
      await next();
    } else {
      // Pre-type next user message after a short delay
      setTimeout(() => preTypeNext(), 1500);
    }
  }
}

/** Pre-type the next user message into the textarea (desktop) */
export function preTypeNext() {
  if (currentExchange >= EXCHANGES.length) return;
  const ex = EXCHANGES[currentExchange];
  if (!ex.userText) return; // SARA-initiated, no pre-type

  const textarea = document.getElementById('chat-textarea');
  if (!textarea) return;

  // Type word by word into textarea
  const words = ex.userText.split(' ');
  let i = 0;
  textarea.value = '';

  const interval = setInterval(() => {
    if (i >= words.length) {
      clearInterval(interval);
      return;
    }
    textarea.value += (i > 0 ? ' ' : '') + words[i];
    i++;
  }, 150);
}

/** Update FPV state per exchange */
function updateFpv(index) {
  switch (index) {
    case 1: // Exchange 2: camera pans south
      fpv.setTransform({ scale: 1, translateX: 0, translateY: -5 });
      break;
    case 3: // Exchange 4: zoom in, descend
      fpv.setTransform({ scale: 1.4, translateX: -3, translateY: -8 });
      state.set({ droneAltitude: 60 });
      break;
    case 4: // Exchange 5: target bounding box
      fpv.showTargetBox({ top: '38%', left: '42%', width: '16%', height: '12%', status: 'potential' });
      break;
    case 5: // Exchange 6: zoom tighter, confirmed
      fpv.setTransform({ scale: 1.8, translateX: -5, translateY: -10 });
      fpv.showTargetBox({ top: '35%', left: '40%', width: '20%', height: '15%', status: 'confirmed' });
      break;
    case 6: // Exchange 7: vehicle moves, camera tracks
      fpv.setTransform({ scale: 1.6, translateX: -8, translateY: -12 });
      break;
  }
}

/** Reset orchestrator for new mission */
export function reset() {
  currentExchange = 0;
  isPlaying = false;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
