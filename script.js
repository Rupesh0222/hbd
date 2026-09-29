/* =========================================================
   PAGE 1 — Secret Entrance
   Vanilla JS: particles, custom cursor, PIN keypad, music prep
   ========================================================= */

(() => {
  'use strict';

  /* ---------------------------------------------------------
     CONFIG — change the secret code here
     --------------------------------------------------------- */
  const CORRECT_PIN = '0310';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  /* ===========================================================
     1. DECORATIVE PARTICLE FIELD
     Generates a small, recycled set of hearts / petals / sparkles
     that drift upward behind the card. Capped count + reuse keeps
     the DOM light instead of growing forever.
     =========================================================== */
  function initParticleField() {
    const field = document.getElementById('particleField');
    if (!field || prefersReducedMotion) return;

    const SYMBOLS = ['♡', '♥', '✦', '✧', '🌹', '🌸', '✨'];
    const TONES = ['tone-rose', 'tone-lav', 'tone-gold', 'tone-sage'];
    const MAX_PARTICLES = window.innerWidth < 600 ? 14 : 22;

    const pool = [];

    function spawn(el) {
      const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      const tone = TONES[Math.floor(Math.random() * TONES.length)];
      const size = 12 + Math.random() * 16;
      const startX = Math.random() * 100;
      const drift = (Math.random() - 0.5) * 160;
      const spin = (Math.random() - 0.5) * 60;
      const duration = 14 + Math.random() * 12;
      const delay = Math.random() * duration;

      el.textContent = symbol;
      el.className = `particle ${tone}`;
      el.style.left = `${startX}%`;
      el.style.bottom = '-40px';
      el.style.fontSize = `${size}px`;
      el.style.setProperty('--drift', `${drift}px`);
      el.style.setProperty('--spin', `${spin}deg`);
      el.style.animationDuration = `${duration}s`;
      el.style.animationDelay = `-${delay}s`; // stagger so they don't all start together
    }

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const el = document.createElement('span');
      spawn(el);
      field.appendChild(el);
      pool.push(el);

      // Recycle each particle once its animation loop completes,
      // giving it a fresh random path instead of piling up new nodes.
      el.addEventListener('animationiteration', () => spawn(el));
    }
  }

  /* ===========================================================
     2. CUSTOM CURSOR
     Smoothly-following heart cursor with an occasional sparkle
     trail. Disabled entirely on touch devices.
     =========================================================== */
  function initCustomCursor() {
    const cursor = document.getElementById('customCursor');
    if (!cursor) return;

    if (isTouchDevice) {
      document.body.classList.add('no-custom-cursor');
      cursor.remove();
      return;
    }

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;
    let lastTrailTime = 0;

    window.addEventListener('mousemove', (e) => {
      targetX = e.clientX;
      targetY = e.clientY;

      // Occasional sparkle trail, throttled so it stays subtle
      const now = performance.now();
      if (!prefersReducedMotion && now - lastTrailTime > 140 && Math.random() > 0.55) {
        lastTrailTime = now;
        spawnTrailSparkle(e.clientX, e.clientY);
      }
    });

    function spawnTrailSparkle(x, y) {
      const trail = document.createElement('span');
      trail.className = 'cursor-trail';
      trail.textContent = Math.random() > 0.5 ? '✦' : '✧';
      trail.style.left = `${x}px`;
      trail.style.top = `${y}px`;
      document.body.appendChild(trail);
      setTimeout(() => trail.remove(), 750);
    }

    function tick() {
      // Smooth easing toward the real cursor position rather than snapping
      currentX += (targetX - currentX) * 0.18;
      currentY += (targetY - currentY) * 0.18;
      cursor.style.transform = `translate(${currentX}px, ${currentY}px) translate(-50%, -50%)`;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    // Scale up / glow whenever hovering an interactive element
    const hoverTargets = document.querySelectorAll('.key, button, a, .pin-hidden-input');
    hoverTargets.forEach((target) => {
      target.addEventListener('mouseenter', () => cursor.classList.add('is-hovering'));
      target.addEventListener('mouseleave', () => cursor.classList.remove('is-hovering'));
    });
  }

  /* ===========================================================
     3. PIN ENTRY LOGIC
     =========================================================== */
  function initPinEntry() {
    const card = document.getElementById('mainCard');
    const dots = Array.from(document.querySelectorAll('.dot'));
    const hiddenInput = document.getElementById('pinHiddenInput');
    const keypad = document.getElementById('keypad');
    const pinMessage = document.getElementById('pinMessage');
    const successText = document.getElementById('successText');

    let enteredPin = '';
    let isLocked = false; // prevents input while success/error animations play

    function renderDots() {
      dots.forEach((dot, i) => {
        dot.classList.toggle('is-filled', i < enteredPin.length);
      });
    }

    function setMessage(text) {
      pinMessage.textContent = text || '\u00A0';
    }

    function addDigit(digit) {
      if (isLocked || enteredPin.length >= 4) return;
      enteredPin += digit;
      renderDots();
      setMessage('');

      if (enteredPin.length === 4) {
        // Small pause so the last dot's glow is visible before we judge the code
        setTimeout(evaluatePin, 220);
      }
    }

    function removeDigit() {
      if (isLocked || enteredPin.length === 0) return;
      enteredPin = enteredPin.slice(0, -1);
      renderDots();
      setMessage('');
    }

    function evaluatePin() {
      if (enteredPin === CORRECT_PIN) {
        handleSuccess();
      } else {
        handleError();
      }
    }

    function handleError() {
      isLocked = true;
      card.classList.add('is-error');
      setMessage("Hmm... that's not it, try again \uD83E\uDD2D");

      setTimeout(() => {
        card.classList.remove('is-error');
        enteredPin = '';
        renderDots();
        isLocked = false;
      }, prefersReducedMotion ? 50 : 550);
    }

    function handleSuccess() {
      isLocked = true;
      card.classList.add('is-success');
      setMessage('');
      successText.classList.add('is-visible');
      spawnSparkleBurst();

      // Give the visitor a moment to read "Welcome, you ♡" before
      // signalling the rest of the experience to continue.
      setTimeout(() => {
        document.dispatchEvent(new CustomEvent('pinCorrect'));
      }, prefersReducedMotion ? 300 : 1400);
    }

    function spawnSparkleBurst() {
      if (prefersReducedMotion) return;
      const burst = document.getElementById('sparkleBurst');
      const symbols = ['✦', '✧', '♡', '✨'];
      const count = 16;

      for (let i = 0; i < count; i++) {
        const el = document.createElement('span');
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
        const distance = 90 + Math.random() * 90;
        el.className = 'burst-sparkle';
        el.textContent = symbols[Math.floor(Math.random() * symbols.length)];
        el.style.setProperty('--bx', `${Math.cos(angle) * distance}px`);
        el.style.setProperty('--by', `${Math.sin(angle) * distance}px`);
        el.style.animationDelay = `${Math.random() * 0.2}s`;
        burst.appendChild(el);
        el.addEventListener('animationend', () => el.remove());
      }
    }

    /* ---- Keypad clicks / taps ---- */
    keypad.addEventListener('click', (e) => {
      const button = e.target.closest('.key');
      if (!button) return;

      button.classList.add('is-pressed');
      setTimeout(() => button.classList.remove('is-pressed'), 160);

      if (button.dataset.digit !== undefined) {
        addDigit(button.dataset.digit);
      } else if (button.dataset.action === 'backspace') {
        removeDigit();
      } else if (button.dataset.action === 'enter') {
        if (enteredPin.length === 4) evaluatePin();
      }

      // Keep focus on the hidden input so a physical keyboard keeps working
      hiddenInput.focus({ preventScroll: true });
    });

    /* ---- Physical keyboard support ---- */
    hiddenInput.addEventListener('keydown', (e) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        addDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        removeDigit();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (enteredPin.length === 4) evaluatePin();
      }
    });

    // Keep the hidden input focused on load and after any stray blur,
    // so keyboard users don't have to hunt for a focus target.
    hiddenInput.focus({ preventScroll: true });
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.key')) hiddenInput.focus({ preventScroll: true });
    });

    /* ---- Public reset function for future page integrations ---- */
    window.resetPin = function resetPin() {
      enteredPin = '';
      isLocked = false;
      renderDots();
      setMessage('');
      successText.classList.remove('is-visible');
      card.classList.remove('is-success', 'is-error');
      const burst = document.getElementById('sparkleBurst');
      if (burst) burst.innerHTML = '';
    };
  }

  /* ===========================================================
     4. MUSIC ARCHITECTURE (prepared, not started)
     No autoplay — browsers block it, and it would feel jarring.
     We simply prepare a global controller and wait for the
     visitor's first interaction so a future <audio> element can
     be started without any further wiring.
     =========================================================== */
  function initMusicArchitecture() {
    window.loveNoteMusic = {
      _audioEl: null,
      _hasUnlocked: false,

      /** Call once an <audio id="bgm"> element exists in the DOM. */
      registerAudioElement(audioEl) {
        this._audioEl = audioEl;
        if (this._hasUnlocked) this._tryPlay();
      },

      _tryPlay() {
        if (!this._audioEl) return;
        this._audioEl.volume = 0.35;
        this._audioEl.play().catch(() => {
          /* Autoplay still blocked — will retry on next interaction */
        });
      },

      _unlock() {
        this._hasUnlocked = true;
        this._tryPlay();
      },
    };

    const unlockOnce = () => {
      window.loveNoteMusic._unlock();
      window.removeEventListener('pointerdown', unlockOnce);
      window.removeEventListener('keydown', unlockOnce);
    };
    window.addEventListener('pointerdown', unlockOnce, { once: true });
    window.addEventListener('keydown', unlockOnce, { once: true });

    // When the real MP3 is ready, integration looks like:
      const bgm = document.getElementById('bgm');
      window.loveNoteMusic.registerAudioElement(bgm);
  }

  /* ===========================================================
     5. NEXT-PAGE HANDOFF
     Listens for the "pinCorrect" event and moves on to Page 2.
     Kept separate from the PIN logic itself so Page 1 still works
     standalone even before index2.html exists — if the file isn't
     there yet, this will just 404 instead of silently doing nothing,
     which makes it obvious what's missing.
     =========================================================== */
  function initNextPageHandoff() {
    document.addEventListener('pinCorrect', () => {
      setTimeout(() => {
        window.location.href = 'index2.html';
      }, prefersReducedMotion ? 300 : 1400);
    });
  }

  /* ===========================================================
     INIT
     =========================================================== */
  document.addEventListener('DOMContentLoaded', () => {
    initParticleField();
    initCustomCursor();
    initPinEntry();
    initMusicArchitecture();
    initNextPageHandoff();
  });
})();