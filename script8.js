/* =========================================================
   PAGE 8 — The Question
   Vanilla JS: envelope opening, staged question reveal,
   response handling, optional message, particles, cursor,
   plus Firebase (Anonymous Auth + Firestore) for the explicit
   YES / "Let me think" response and the optional message.

   NOTE: this file is now an ES module. The <script> tag that
   loads it must be:   <script type="module" src="..."></script>
   ========================================================= */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

/* ---------------------------------------------------------
   FIREBASE WEB APP CONFIG  (paste yours here)
   Firebase Console → Project settings → General → Your apps →
   HBDN web app → "SDK setup and configuration" → Config.
   This standard web config is safe to ship in client-side code;
   your Firestore Security Rules are what protect the data.
   NEVER paste service-account keys / Admin SDK credentials here.
   --------------------------------------------------------- */
const firebaseConfig = {
  apiKey: 'AIzaSyCsLERhSOnP97HVZr9-v9qYrfwzMtKZgS4',
  authDomain: 'hbdn-2cbf0.firebaseapp.com',
  projectId: 'hbdn-2cbf0',
  storageBucket: 'hbdn-2cbf0.firebasestorage.app',
  messagingSenderId: '91782401833',
  appId: '1:91782401833:web:1332a905cbde8414437138',
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

(() => {
  'use strict'; 
 
  /* ---------------------------------------------------------
     CONFIG — change her name here
     --------------------------------------------------------- */
  const HER_NAME = 'Neha';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  const SAVE_TIMEOUT_MS = 20000;
  const MESSAGE_MAX_LENGTH = 1000; // keep in sync with firestore.rules + the textarea maxlength

  /* ---------------------------------------------------------
     STATE
     --------------------------------------------------------- */
  const state = {
    questionOpened: false,
    responseChoice: null,   // set only after a response is successfully saved
    responseId: null,       // Firestore document ID of that saved response
    isSavingResponse: false,
    messageSubmitted: false,
    isSavingMessage: false,
  };

  function dispatchPageEvent(name, detail) {
    window.dispatchEvent(new CustomEvent(name, detail ? { detail } : undefined));
  }

  /* ===========================================================
     0. FIREBASE: anonymous auth + explicit saves
     Nothing here runs on page load. An anonymous session is only
     created (or an existing one reused) at the moment she
     explicitly clicks YES / Let me think, or sends a message.
     No analytics, no page-view tracking, no hidden collection.
     =========================================================== */
  let authPromise = null;

  function waitForAuthInit() {
    // Resolves with a persisted anonymous user if one exists, else null.
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        resolve(user);
      });
    });
  }

  function ensureAnonymousAuth() {
    if (!authPromise) {
      authPromise = (async () => {
        const existing = await waitForAuthInit();
        if (existing) return existing;
        const credential = await signInAnonymously(auth);
        return credential.user;
      })().catch((err) => {
        authPromise = null; // allow a retry after a failure
        throw err;
      });
    }
    return authPromise;
  }

  function withTimeout(promise, ms) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        const err = new Error('save-timeout');
        err.code = 'app/save-timeout';
        reject(err);
      }, ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  function friendlySaveError(err, context) {
    // Technical detail goes to the console only (never message contents).
    console.error(`[page8] ${context} failed:`, err && (err.code || err.name));

    const code = err && err.code;
    if (code === 'auth/network-request-failed' || code === 'unavailable' || code === 'app/offline' || code === 'app/save-timeout') {
      return 'The connection seems a little shaky. Please try again. \u2661';
    }
    return 'Something went wrong while saving that. Please try again. \u2661';
  }

  /**
   * Creates exactly one proposalResponses document for an explicit
   * choice and returns its ID (which is also the responseId).
   */
  async function saveProposalResponse(choice) {
    if (!navigator.onLine) {
      const err = new Error('offline');
      err.code = 'app/offline';
      throw err;
    }

    const user = await withTimeout(ensureAnonymousAuth(), SAVE_TIMEOUT_MS);
    const responseRef = doc(collection(db, 'proposalResponses')); // auto-ID, known up front

    await withTimeout(
      setDoc(responseRef, {
        responseId: responseRef.id,
        respondedAt: serverTimestamp(),
        choice,
        visitorUid: user.uid,
      }),
      SAVE_TIMEOUT_MS
    );

    return responseRef.id;
  }

  /**
   * Creates one messages document, linked to the saved response.
   * Only ever called from the explicit "Send this little message" click.
   */
  async function saveMessage(responseId, message) {
    if (!navigator.onLine) {
      const err = new Error('offline');
      err.code = 'app/offline';
      throw err;
    }

    const user = await withTimeout(ensureAnonymousAuth(), SAVE_TIMEOUT_MS);
    const messageRef = doc(collection(db, 'messages'));

    await withTimeout(
      setDoc(messageRef, {
        messageId: messageRef.id,
        submittedAt: serverTimestamp(),
        responseId,
        message,
        visitorUid: user.uid,
      }),
      SAVE_TIMEOUT_MS
    );

    return messageRef.id;
  }

  /* ===========================================================
     1. DECORATIVE PARTICLE FIELD
     =========================================================== */
  let particleField = null;
  let spawnParticle = null;

  function createParticles() {
    particleField = document.getElementById('particleField');
    if (!particleField || prefersReducedMotion) return;

    const SYMBOLS = ['♡', '✦', '✧', '🌸'];
    const TONES = ['tone-rose', 'tone-lav', 'tone-gold', 'tone-sage'];

    spawnParticle = (el) => {
      const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      const tone = TONES[Math.floor(Math.random() * TONES.length)];
      const size = 10 + Math.random() * 13;
      const startX = Math.random() * 100;
      const drift = (Math.random() - 0.5) * 130;
      const spin = (Math.random() - 0.5) * 40;
      const duration = 17 + Math.random() * 13;
      const delay = Math.random() * duration;

      el.textContent = symbol;
      el.className = `particle ${tone}`;
      el.style.left = `${startX}%`;
      el.style.bottom = '-40px';
      el.style.fontSize = `${size}px`;
      el.style.setProperty('--drift', `${drift}px`);
      el.style.setProperty('--spin', `${spin}deg`);
      el.style.animationDuration = `${duration}s`;
      el.style.animationDelay = `-${delay}s`;
    };

    const MAX_PARTICLES = window.innerWidth < 600 ? 9 : 13;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const el = document.createElement('span');
      spawnParticle(el);
      particleField.appendChild(el);
      el.addEventListener('animationiteration', () => spawnParticle(el));
    }
  }

  /** Briefly adds a handful of extra particles for the YES celebration. */
  function boostParticles() {
    if (prefersReducedMotion || !particleField || !spawnParticle) return;
    const extra = 10;
    for (let i = 0; i < extra; i++) {
      const el = document.createElement('span');
      spawnParticle(el);
      particleField.appendChild(el);
      let cycles = 0;
      el.addEventListener('animationiteration', () => {
        cycles++;
        if (cycles >= 1) {
          el.remove();
        } else {
          spawnParticle(el);
        }
      });
    }
  }

  /* ===========================================================
     2. CUSTOM CURSOR
     =========================================================== */
  function setupCustomCursor() {
  const cursor = document.getElementById('customCursor');
  if (!cursor) return;

  if (isTouchDevice) {
    document.body.classList.add('no-custom-cursor');
    cursor.remove();
    return;
  }

  let lastTrailTime = 0;

  function moveCursor(e) {
    cursor.style.left = `${e.clientX}px`;
    cursor.style.top = `${e.clientY}px`;

    const now = performance.now();

    if (
      !prefersReducedMotion &&
      now - lastTrailTime > 160 &&
      Math.random() > 0.65
    ) {
      lastTrailTime = now;
      spawnTrailSparkle(e.clientX, e.clientY);
    }
  }

  function spawnTrailSparkle(x, y) {
    const trail = document.createElement('span');
    trail.className = 'cursor-trail';
    trail.textContent = Math.random() > 0.5 ? '✦' : '✧';

    trail.style.left = `${x}px`;
    trail.style.top = `${y}px`;

    document.body.appendChild(trail);

    setTimeout(() => trail.remove(), 750);
  }

  window.addEventListener('mousemove', moveCursor, { passive: true });

  function bindHoverTargets() {
    const hoverTargets = document.querySelectorAll(
      '.open-it-button, .envelope, .response-button, .message-send-button'
    );

    hoverTargets.forEach((target) => {
      if (target.dataset.cursorBound) return;

      target.dataset.cursorBound = 'true';

      target.addEventListener('mouseenter', () => {
        cursor.classList.add('is-hovering');
      });

      target.addEventListener('mouseleave', () => {
        cursor.classList.remove('is-hovering');
      });
    });
  }

  bindHoverTargets();
  window.__rebindCursorTargets = bindHoverTargets;
}

  /* ===========================================================
     3. SPARKLE / HEART BURST (envelope open + YES celebration)
     =========================================================== */
  function spawnBurst(originEl, options) {
    if (prefersReducedMotion) return;
    const opts = options || {};
    const burst = document.getElementById('sparkleBurst');
    const rect = originEl.getBoundingClientRect();
    const originX = rect.left + rect.width / 2;
    const originY = rect.top + rect.height / 2;
    const symbols = opts.symbols || ['✦', '✧', '♡'];
    const count = opts.count || 12;
    const spread = opts.spread || 90;
    const isCelebration = !!opts.celebration;

    for (let i = 0; i < count; i++) {
      const el = document.createElement('span');
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const distance = spread * 0.6 + Math.random() * spread;
      el.className = isCelebration ? 'burst-sparkle is-celebration' : 'burst-sparkle';
      el.textContent = symbols[Math.floor(Math.random() * symbols.length)];
      el.style.left = `${originX}px`;
      el.style.top = `${originY}px`;
      el.style.setProperty('--bx', `${Math.cos(angle) * distance}px`);
      el.style.setProperty('--by', `${Math.sin(angle) * distance}px`);
      el.style.animationDelay = `${Math.random() * 0.2}s`;
      burst.appendChild(el);
      el.addEventListener('animationend', () => el.remove());
    }
  }

  function createCelebration() {
    const paper = document.getElementById('paper');
    spawnBurst(paper, {
      symbols: ['✦', '✧', '♡', '🌸'],
      count: 26,
      spread: 160,
      celebration: true,
    });
    boostParticles();
  }

  /* ===========================================================
     4. OPENING → ENVELOPE
     =========================================================== */
  function setupOpening() {
    const openItButton = document.getElementById('openItButton');
    const openingBlock = document.getElementById('openingBlock');
    const envelopeWrap = document.getElementById('envelopeWrap');
    let hasOpened = false;

    openItButton.addEventListener('click', () => {
      if (hasOpened) return;
      hasOpened = true;

      openingBlock.classList.add('is-leaving');
      setTimeout(() => {
        openingBlock.hidden = true;
        envelopeWrap.hidden = false;
        void envelopeWrap.offsetWidth;
        envelopeWrap.classList.add('is-visible');
        if (window.__rebindCursorTargets) window.__rebindCursorTargets();
      }, prefersReducedMotion ? 0 : 600);
    });

    setupEnvelope();
  }

  function setupEnvelope() {
    const envelopeButton = document.getElementById('envelopeButton');
    let hasOpened = false;

    const activate = () => {
      if (hasOpened) return;
      hasOpened = true;
      openFinalCard();
    };

    envelopeButton.addEventListener('click', activate);
    envelopeButton.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        activate();
      }
    });
  }

  function openFinalCard() {
    const envelopeWrap = document.getElementById('envelopeWrap');
    const envelopeButton = document.getElementById('envelopeButton');
    const questionBlock = document.getElementById('questionBlock');

    envelopeButton.setAttribute('aria-expanded', 'true');
    envelopeButton.classList.add('is-opening');
    spawnBurst(envelopeButton, { count: 10, spread: 70 });

    dispatchPageEvent('page8QuestionOpened');
    state.questionOpened = true;

    const proceed = () => {
      envelopeWrap.hidden = true;
      questionBlock.hidden = false;
      void questionBlock.offsetWidth;
      questionBlock.focus({ preventScroll: false });
      revealQuestion();
    };

    if (prefersReducedMotion) {
      proceed();
    } else {
      setTimeout(proceed, 750);
    }
  }

  /* ===========================================================
     5. QUESTION REVEAL
     =========================================================== */
  function revealQuestion() {
    const soLine = document.getElementById('questionSo');
    soLine.textContent = `So, ${HER_NAME}...`;

    const units = Array.from(document.getElementById('questionBlock').querySelectorAll('.reveal-unit'));

    if (prefersReducedMotion) {
      units.forEach((unit) => unit.classList.add('is-visible'));
      if (window.__rebindCursorTargets) window.__rebindCursorTargets();
      return;
    }

    const STEP_DELAY = 520;
    units.forEach((unit, i) => {
      setTimeout(() => {
        unit.classList.add('is-visible');
        if (i === units.length - 1 && window.__rebindCursorTargets) {
          window.__rebindCursorTargets();
        }
      }, 250 + i * STEP_DELAY);
    });
  }

  /* ===========================================================
     6. RESPONSE HANDLING
     =========================================================== */
  function showYesState() {
    document.getElementById('responseYesState').hidden = false;
    document.getElementById('responseThinkState').hidden = true;
  }

  function showThinkState() {
    document.getElementById('responseThinkState').hidden = false;
    document.getElementById('responseYesState').hidden = true;
  }

  function revealResponseBlock() {
    const questionBlock = document.getElementById('questionBlock');
    const responseBlock = document.getElementById('responseBlock');

    questionBlock.hidden = true;
    responseBlock.hidden = false;
    responseBlock.focus({ preventScroll: false });
    if (window.__rebindCursorTargets) window.__rebindCursorTargets();
  }

  /* --- busy state for the two answer buttons -------------------
     `aria-disabled` + a guard is used instead of the `disabled`
     attribute: disabling a focused button drops keyboard focus to
     <body> (and can snap the page's scroll). The buttons are only
     "off" while a save is in flight, and are restored on failure. */
  function setResponseButtonsBusy(isBusy) {
    ['yesButton', 'thinkButton'].forEach((id) => {
      const button = document.getElementById(id);
      if (isBusy) button.setAttribute('aria-disabled', 'true');
      else button.removeAttribute('aria-disabled');
    });
  }

  function showResponseError(message) {
    document.getElementById('responseError').textContent = message || '';
  }

  /**
   * Shared path for YES and "Let me think": save first, and only
   * show the success/think UI once Firestore has accepted the write.
   */
  async function submitResponse(choice) {
    // Guards against double-clicks and against answering twice.
    if (state.isSavingResponse || state.responseChoice) return;
    state.isSavingResponse = true;

    showResponseError('');
    setResponseButtonsBusy(true);

    try {
      const responseId = await saveProposalResponse(choice);

      state.responseChoice = choice;
      state.responseId = responseId;

      if (choice === 'yes') {
        showYesState();
        revealResponseBlock();
        createCelebration();
      } else {
        showThinkState();
        revealResponseBlock();
      }

      dispatchPageEvent('page8ProposalResponse', { choice, responseId });
    } catch (err) {
      showResponseError(friendlySaveError(err, 'saveProposalResponse'));
      setResponseButtonsBusy(false);
    } finally {
      state.isSavingResponse = false;
    }
  }

  function handleYesResponse() {
    submitResponse('yes');
  }

  function handleThinkResponse() {
    submitResponse('think');
  }

  function setupResponseButtons() {
    document.getElementById('yesButton').addEventListener('click', handleYesResponse);
    document.getElementById('thinkButton').addEventListener('click', handleThinkResponse);
  }

  /* ===========================================================
     7. OPTIONAL MESSAGE SUBMISSION
     Saved ONLY when she explicitly clicks the send button —
     never while typing, never on blur, never automatically.
     =========================================================== */
  function setupMessageSubmission() {
    const textarea = document.getElementById('messageTextarea');
    const sendButton = document.getElementById('messageSendButton');
    const statusEl = document.getElementById('messageStatus');

    sendButton.addEventListener('click', async () => {
      if (state.messageSubmitted || state.isSavingMessage) return;

      const message = textarea.value.trim();
      if (!message) {
        statusEl.textContent = 'Write something first, or just skip this part. \u2661';
        return;
      }
      if (message.length > MESSAGE_MAX_LENGTH) {
        statusEl.textContent = 'That one\u2019s a little long \u2014 could you trim it a bit? \u2661';
        return;
      }
      if (!state.responseId) {
        // The message box only appears after a saved response, but be safe.
        statusEl.textContent = 'Something went wrong while saving that. Please try again. \u2661';
        return;
      }

      state.isSavingMessage = true;
      sendButton.classList.add('is-sent'); // visual "busy" (pointer-events off), not a real disabled state
      statusEl.textContent = '';

      try {
        const messageId = await saveMessage(state.responseId, message);

        state.messageSubmitted = true;
        textarea.setAttribute('readonly', 'true');
        statusEl.textContent = 'Thank you for sharing that. \u2661';

        dispatchPageEvent('page8MessageSubmitted', { responseId: state.responseId, messageId });
      } catch (err) {
        sendButton.classList.remove('is-sent');
        statusEl.textContent = friendlySaveError(err, 'saveMessage');
      } finally {
        state.isSavingMessage = false;
      }
    });
  }

  /* ===========================================================
     INIT
     =========================================================== */
  function initPage() {
    createParticles();
    setupCustomCursor();
    setupOpening();
    setupResponseButtons();
    setupMessageSubmission();
  }

  document.addEventListener('DOMContentLoaded', initPage);
})();

