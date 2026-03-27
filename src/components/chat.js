/**
 * Chat Component — Append-only message rendering
 *
 * Owns: chat-history DOM. Never replaces innerHTML.
 * Each message is appended once and stays.
 */

import * as state from '../state.js';

const chatEl = () => document.getElementById('chat-history');

/** Append a SARA message */
export function appendSara(text, options = {}) {
  const el = chatEl();
  if (!el) return null;

  const msg = document.createElement('div');
  msg.className = 'chat-msg chat-msg-sara';
  msg.innerHTML = `
    <div class="chat-msg-label">SARA</div>
    <div class="chat-msg-text">${escapeHtml(text)}</div>
  `;

  if (options.choices) {
    const choices = document.createElement('div');
    choices.className = 'chat-choices';
    for (const choice of options.choices) {
      const btn = document.createElement('button');
      btn.className = choice.primary ? 'btn-primary' : 'btn-secondary';
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
  return msg;
}

/** Append a SARA message word by word */
export async function appendSaraWordByWord(text, interval = 120) {
  const el = chatEl();
  if (!el) return;

  const msg = document.createElement('div');
  msg.className = 'chat-msg chat-msg-sara';
  const label = document.createElement('div');
  label.className = 'chat-msg-label';
  label.textContent = 'SARA';
  const textEl = document.createElement('div');
  textEl.className = 'chat-msg-text';
  msg.appendChild(label);
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
  return msg;
}

/** Append a user message */
export function appendUser(text) {
  const el = chatEl();
  if (!el) return null;

  const msg = document.createElement('div');
  msg.className = 'chat-msg chat-msg-user';
  msg.innerHTML = `
    <div class="chat-msg-label">YOU</div>
    <div class="chat-msg-text">${escapeHtml(text)}</div>
  `;

  el.appendChild(msg);
  scrollToBottom();
  return msg;
}

/** Append a user message word by word (PTT simulation) */
export async function appendUserWordByWord(text, interval = 220) {
  const el = chatEl();
  if (!el) return;

  const msg = document.createElement('div');
  msg.className = 'chat-msg chat-msg-user';
  const label = document.createElement('div');
  label.className = 'chat-msg-label';
  label.textContent = 'YOU';
  const textEl = document.createElement('div');
  textEl.className = 'chat-msg-text';
  msg.appendChild(label);
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
  return msg;
}

/** Append a radio chatter message */
export function appendRadio(unit, text, time) {
  const el = chatEl();
  if (!el) return null;

  const msg = document.createElement('div');
  msg.className = 'chat-msg chat-msg-radio';
  msg.innerHTML = `
    <div class="chat-msg-label">DISPATCH UPDATE · ${time}</div>
    <div class="chat-msg-text">${escapeHtml(text)}</div>
  `;

  el.appendChild(msg);
  scrollToBottom();

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

/** Clear all chat messages */
export function clear() {
  const el = chatEl();
  if (el) el.innerHTML = '';
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
