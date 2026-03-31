/**
 * Chat Component — Append-only message rendering
 *
 * Owns: chat-history DOM. Never replaces innerHTML.
 * Each message is appended once and stays.
 */

import * as state from '../state.js';

const chatEl = () => document.getElementById('chat-history');

// Generation counter — incremented on clear(). Async operations bail if generation changed.
let chatGeneration = 0;
export function getGeneration() { return chatGeneration; }

// Track last message type to suppress repeated labels
let lastMsgType = null;

// Relative timestamp tracking
const timestampEls = [];
let tsInterval = null;

function startTimestampUpdater() {
  if (tsInterval) return;
  tsInterval = setInterval(() => {
    const now = Date.now();
    for (const { el, time } of timestampEls) {
      el.textContent = relativeTime(now - time);
    }
  }, 10000);
}

function relativeTime(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function createTimestamp() {
  const el = document.createElement('span');
  el.className = 'chat-msg-time';
  el.textContent = 'just now';
  const entry = { el, time: Date.now() };
  timestampEls.push(entry);
  startTimestampUpdater();
  return el;
}

/** Append a SARA message */
export function appendSara(text, options = {}) {
  const el = chatEl();
  if (!el) return null;

  const msg = document.createElement('div');
  msg.className = 'chat-msg chat-msg-sara';

  const header = document.createElement('div');
  header.className = 'chat-msg-header';
  if (lastMsgType !== 'sara') {
    const label = document.createElement('span');
    label.className = 'chat-msg-label';
    label.textContent = 'SARA';
    header.appendChild(label);
  }
  header.appendChild(createTimestamp());
  msg.appendChild(header);

  const textEl = document.createElement('div');
  textEl.className = 'chat-msg-text';
  textEl.innerHTML = escapeHtml(text);
  msg.appendChild(textEl);

  if (options.choices) {
    const choices = document.createElement('div');
    choices.className = 'chat-choices';
    for (const choice of options.choices) {
      const btn = document.createElement('button');
      btn.className = choice.className || (choice.primary ? 'btn-primary' : 'btn-secondary');
      btn.textContent = choice.label;
      btn.addEventListener('click', () => {
        choices.remove();
        choice.action();
      });
      choices.appendChild(btn);
    }
    msg.appendChild(choices);
  }

  el.appendChild(msg);
  scrollToBottom();
  lastMsgType = 'sara';
  state.set({ lastSaraMessage: text });
  return msg;
}

/** Append a SARA message word by word */
export async function appendSaraWordByWord(text, interval = 120) {
  const el = chatEl();
  if (!el) return;

  const msg = document.createElement('div');
  msg.className = 'chat-msg chat-msg-sara';

  const header = document.createElement('div');
  header.className = 'chat-msg-header';
  if (lastMsgType !== 'sara') {
    const lbl = document.createElement('span');
    lbl.className = 'chat-msg-label';
    lbl.textContent = 'SARA';
    header.appendChild(lbl);
  }
  header.appendChild(createTimestamp());
  msg.appendChild(header);

  const textEl = document.createElement('div');
  textEl.className = 'chat-msg-text';
  msg.appendChild(textEl);
  el.appendChild(msg);
  scrollToBottom();

  const words = text.split(' ');
  for (let i = 0; i < words.length; i++) {
    textEl.textContent += (i > 0 ? ' ' : '') + words[i];
    if (i % 5 === 4) scrollToBottom();
    await wait(interval);
  }
  scrollToBottom();
  lastMsgType = 'sara';
  state.set({ lastSaraMessage: text });
  return msg;
}

/** Append a deemphasized system note (small, gray, mono) */
export function appendSystem(text) {
  const el = chatEl();
  if (!el) return null;

  const msg = document.createElement('div');
  msg.className = 'chat-msg chat-msg-system';
  msg.innerHTML = `<div class="chat-msg-text">${escapeHtml(text)}</div>`;

  el.appendChild(msg);
  scrollToBottom();
  // System notes don't reset the label suppression
  return msg;
}

/** Append a dispatch/radio message */
export function appendMessage(type, label, text) {
  const el = chatEl();
  if (!el) return null;

  const msg = document.createElement('div');
  msg.className = `chat-msg chat-msg-${type}`;

  const header = document.createElement('div');
  header.className = 'chat-msg-header';
  const lbl = document.createElement('span');
  lbl.className = 'chat-msg-label';
  lbl.textContent = label;
  header.appendChild(lbl);
  header.appendChild(createTimestamp());
  msg.appendChild(header);

  const textEl = document.createElement('div');
  textEl.className = 'chat-msg-text';
  textEl.innerHTML = escapeHtml(text);
  msg.appendChild(textEl);

  el.appendChild(msg);
  scrollToBottom();
  lastMsgType = type;
  return msg;
}

/** Append a user message */
export function appendUser(text) {
  const el = chatEl();
  if (!el) return null;

  const msg = document.createElement('div');
  msg.className = 'chat-msg chat-msg-user';

  const header = document.createElement('div');
  header.className = 'chat-msg-header';
  const lbl = document.createElement('span');
  lbl.className = 'chat-msg-label';
  lbl.textContent = 'YOU';
  header.appendChild(lbl);
  header.appendChild(createTimestamp());
  msg.appendChild(header);

  const textEl = document.createElement('div');
  textEl.className = 'chat-msg-text';
  textEl.innerHTML = escapeHtml(text);
  msg.appendChild(textEl);

  el.appendChild(msg);
  scrollToBottom();
  lastMsgType = 'user';
  return msg;
}

/** Append a user message word by word (PTT simulation) */
export async function appendUserWordByWord(text, interval = 220) {
  const el = chatEl();
  if (!el) return;

  const msg = document.createElement('div');
  msg.className = 'chat-msg chat-msg-user';

  const header = document.createElement('div');
  header.className = 'chat-msg-header';
  const lbl = document.createElement('span');
  lbl.className = 'chat-msg-label';
  lbl.textContent = 'YOU';
  header.appendChild(lbl);
  header.appendChild(createTimestamp());
  msg.appendChild(header);

  const textEl = document.createElement('div');
  textEl.className = 'chat-msg-text';
  msg.appendChild(textEl);
  el.appendChild(msg);
  scrollToBottom();

  const words = text.split(' ');
  for (let i = 0; i < words.length; i++) {
    textEl.textContent += (i > 0 ? ' ' : '') + words[i];
    if (i % 4 === 3) scrollToBottom();
    await wait(interval);
  }
  scrollToBottom();
  lastMsgType = 'user';
  return msg;
}

/** Append a radio chatter message */
export function appendRadio(unit, text, time) {
  const el = chatEl();
  if (!el) return null;

  const msg = document.createElement('div');
  msg.className = 'chat-msg chat-msg-radio';

  const header = document.createElement('div');
  header.className = 'chat-msg-header';
  const lbl = document.createElement('span');
  lbl.className = 'chat-msg-label';
  lbl.textContent = `DISPATCH · ${time}`;
  header.appendChild(lbl);
  header.appendChild(createTimestamp());
  msg.appendChild(header);

  const textEl = document.createElement('div');
  textEl.className = 'chat-msg-text';
  textEl.innerHTML = escapeHtml(text);
  msg.appendChild(textEl);

  el.appendChild(msg);
  scrollToBottom();
  lastMsgType = 'radio';

  // Increment radio count
  state.set({ radioCount: (state.get('radioCount') || 0) + 1 });
  return msg;
}

/** Append a scan line (between user msg and SARA response) */
export async function appendScanLine(duration = 1200) {
  const el = chatEl();
  if (!el) return;

  const line = document.createElement('div');
  line.className = 'scan-line';
  el.appendChild(line);

  // Trigger animation
  await wait(50);
  line.classList.add('active');
  await wait(duration);
  line.classList.remove('active');
  await wait(300);
}

/** Append a SARA message followed by rich HTML content (cards, etc) */
export function appendSaraWithContent(text, html, options = {}) {
  const el = chatEl();
  if (!el) return null;

  const msg = document.createElement('div');
  msg.className = 'chat-msg chat-msg-sara';

  const header = document.createElement('div');
  header.className = 'chat-msg-header';
  if (lastMsgType !== 'sara') {
    const lbl = document.createElement('span');
    lbl.className = 'chat-msg-label';
    lbl.textContent = 'SARA';
    header.appendChild(lbl);
  }
  header.appendChild(createTimestamp());
  msg.appendChild(header);

  const textEl = document.createElement('div');
  textEl.className = 'chat-msg-text';
  textEl.innerHTML = escapeHtml(text);
  msg.appendChild(textEl);

  el.appendChild(msg);
  lastMsgType = 'sara';

  // Append rich content block
  if (html) {
    const content = document.createElement('div');
    content.className = 'chat-content-block';
    content.innerHTML = html;
    el.appendChild(content);
  }

  if (options.choices) {
    const choices = document.createElement('div');
    choices.className = 'chat-choices';
    choices.style.padding = '0 0 8px 0';
    for (const choice of options.choices) {
      const btn = document.createElement('button');
      btn.className = choice.className || (choice.primary ? 'btn-primary' : 'btn-secondary');
      btn.textContent = choice.label;
      btn.addEventListener('click', () => {
        choices.remove();
        choice.action();
      });
      choices.appendChild(btn);
    }
    el.appendChild(choices);
  }

  scrollToBottom();
  state.set({ lastSaraMessage: text });
  return msg;
}

/** Clear all chat messages */
export function clear() {
  chatGeneration++;
  const el = chatEl();
  if (el) el.innerHTML = '';
  lastMsgType = null;
  timestampEls.length = 0;
}

/** Smooth scroll to bottom */
function scrollToBottom() {
  const el = chatEl();
  if (!el) return;
  el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
