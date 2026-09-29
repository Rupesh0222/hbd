/* =========================================================
   PAGE 4 — The Letter
   Vanilla JS: envelope opening, paragraph-by-paragraph letter
   reveal, custom cursor, particles.
   ========================================================= */

(() => {
  'use strict';

  /* ---------------------------------------------------------
     CONFIG — the main things you'll want to edit.
     --------------------------------------------------------- */
  const HER_NAME = 'Neha';
  const YOUR_NAME = 'Rupesh';
  const LETTER_DATE = '3 October 2026';

  const LETTER_CONTENT = [
    "I don't know exactly how to start this, so I'll just start.",
    "Happy birthday Neha. I wanted to write something instead of sending the usual message everyone sends, because you deserve a little more thought than a text.",
    "Talking to you has slowly become one of my favourite parts of most days, and I don't think you realise how easily you do that.",
    "You have this way of making an ordinary conversation feel lighter, and an ordinary day feel a little nicer, without really trying to.",
    "I like your humour, I like how you think about things, and honestly, I just like talking to you more than I probably let on.",
    "I'm not saying all of this to make things complicated. I just wanted you to know it, plainly, for once.",
    "There's a little more I want to say, but not all at once. Some things deserve their own moment.",
  ];

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  /* ===========================================================
     0. NAME / DATE INJECTION
     =========================================================== */
  function injectConfig() {
    const introName = document.getElementById('herNameIntro');
    if (introName) introName.textContent = HER_NAME;

    const dateEl = document.getElementById('letterDate');
    if (dateEl) dateEl.textContent = LETTER_DATE;

    const greetingEl = document.getElementById('letterGreeting');
    if (greetingEl) greetingEl.textContent = `Dear ${HER_NAME},`;

    const signatureEl = document.getElementById('letterSignature');
    if (signatureEl) signatureEl.textContent = `${YOUR_NAME} ♡`;
  }

  /* ===========================================================
     1. DECORATIVE PARTICLE FIELD (small recycled pool, same
     approach as previous pages — kept extra light on this page)
     =========================================================== */
  function initParticleField() {
    const field = document.getElementById('particleField');
    if (!field || prefersReducedMotion) return;

    const SYMBOLS = ['♡', '✦', '✧', '🌸'];
    const TONES = ['tone-rose', 'tone-lav', 'tone-gold', 'tone-sage'];
    const MAX_PARTICLES = window.innerWidth < 600 ? 8 : 12;

    function spawn(el) {
      const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      const tone = TONES[Math.floor(Math.random() * TONES.length)];
      const size = 10 + Math.random() * 12;
      const startX = Math.random() * 100;
      const drift = (Math.random() - 0.5) * 130;
      const spin = (Math.random() - 0.5) * 40;
      const duration = 18 + Math.random() * 14;
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
    }

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const el = document.createElement('span');
      spawn(el);
      field.appendChild(el);
      el.addEventListener('animationiteration', () => spawn(el));
    }
  }

  /* ===========================================================
     2. CUSTOM CURSOR
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

      const now = performance.now();
      if (!prefersReducedMotion && now - lastTrailTime > 160 && Math.random() > 0.65) {
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
      currentX += (targetX - currentX) * 0.18;
      currentY += (targetY - currentY) * 0.18;
      cursor.style.transform = `translate(${currentX}px, ${currentY}px) translate(-50%, -50%)`;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    function bindHoverTargets() {
      const hoverTargets = document.querySelectorAll('.envelope, .continue-button');
      hoverTargets.forEach((target) => {
        if (target.dataset.cursorBound) return;
        target.dataset.cursorBound = 'true';
        target.addEventListener('mouseenter', () => cursor.classList.add('is-hovering'));
        target.addEventListener('mouseleave', () => cursor.classList.remove('is-hovering'));
      });
    }
    bindHoverTargets();
    window.__rebindCursorTargets = bindHoverTargets;
  }

  /* ===========================================================
     3. LETTER CREATION (renders LETTER_CONTENT into the DOM)
     =========================================================== */
  function createLetter() {
    const body = document.getElementById('letterBody');
    if (!body) return;

    LETTER_CONTENT.forEach((paragraph) => {
      const p = document.createElement('p');
      p.className = 'letter-paragraph';
      p.textContent = paragraph;
      body.appendChild(p);
    });
  }

  /* ===========================================================
     4. ENVELOPE OPENING
     =========================================================== */
  function openEnvelope() {
    const envelopeButton = document.getElementById('envelopeButton');
    const introScene = document.getElementById('introScene');

    envelopeButton.setAttribute('aria-expanded', 'true');
    envelopeButton.classList.add('is-opening');

    document.dispatchEvent(new CustomEvent('page4LetterOpened'));

    const proceedToLetter = () => {
      introScene.classList.add('is-leaving');
      body_setLetterOpen();
      revealLetter();

      // The intro scene fades out via CSS, but simply being invisible
      // (opacity/visibility) still reserves its layout space next to
      // the letter in the flex `.stage` — which was squeezing the
      // letter into a narrow column and causing horizontal overflow
      // on narrow screens. Removing it from flow once the fade
      // finishes fixes that.
      setTimeout(() => {
        introScene.hidden = true;
      }, prefersReducedMotion ? 0 : 750);
    };

    // The `hasOpened` guard in initEnvelope() already prevents this from
    // running twice, so there's no need to disable the button (and no
    // risk of the focus-loss/scroll-jump issue that caused on Page 3).
    if (prefersReducedMotion) {
      proceedToLetter();
    } else {
      setTimeout(proceedToLetter, 750);
    }
  }

  function body_setLetterOpen() {
    document.body.classList.add('letter-open');
  }

  function initEnvelope() {
    const envelopeButton = document.getElementById('envelopeButton');
    let hasOpened = false;

    const activate = () => {
      if (hasOpened) return;
      hasOpened = true;
      openEnvelope();
    };

    envelopeButton.addEventListener('click', activate);
    envelopeButton.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        activate();
      }
    });
  }

  /* ===========================================================
     5. LETTER REVEAL (paragraph-by-paragraph, not a typewriter)
     =========================================================== */
  function revealLetter() {
    const letterScene = document.getElementById('letterScene');
    const letterPaper = document.getElementById('letterPaper');

    letterScene.hidden = false;
    // Force layout so the entrance transition actually plays
    void letterScene.offsetWidth;
    letterScene.classList.add('is-visible');

    // Move focus to the letter itself once it's visible, without
    // trapping focus or blocking normal page scrolling.
    setTimeout(() => letterPaper.focus({ preventScroll: false }), prefersReducedMotion ? 0 : 350);

    const units = [
      document.getElementById('letterDate'),
      document.getElementById('letterGreeting'),
      ...document.querySelectorAll('.letter-paragraph'),
      document.getElementById('letterSignoff'),
      document.getElementById('letterSignature'),
    ];

    if (prefersReducedMotion) {
      units.forEach((unit) => unit && unit.classList.add('is-visible'));
      showNextButton();
      return;
    }

    const STEP_DELAY = 420;
    units.forEach((unit, i) => {
      if (!unit) return;
      setTimeout(() => unit.classList.add('is-visible'), 300 + i * STEP_DELAY);
    });

    const totalRevealTime = 300 + units.length * STEP_DELAY;
    setTimeout(showNextButton, totalRevealTime + 300);
  }

  /* ===========================================================
     6. "Continue" BUTTON
     =========================================================== */
  function showNextButton() {
    const closing = document.getElementById('letterClosing');
    if (!closing || closing.dataset.revealed) return;
    closing.dataset.revealed = 'true';
    closing.hidden = false;
    requestAnimationFrame(() => closing.classList.add('is-visible'));
    if (window.__rebindCursorTargets) window.__rebindCursorTargets();
  }

  function initContinueButton() {
    const continueButton = document.getElementById('continueButton');
    let hasNavigated = false;

    continueButton.addEventListener('click', () => {
      // A boolean guard rather than `button.disabled = true` — disabling
      // a focused button can move focus to <body> and snap the page's
      // scroll position, which looks like the click "did nothing".
      if (hasNavigated) return;
      hasNavigated = true;

      document.dispatchEvent(new CustomEvent('page4Next'));
      setTimeout(() => {
        window.location.href = 'index5.html';
      }, prefersReducedMotion ? 150 : 500);
    });
  }

  /* ===========================================================
     INIT
     =========================================================== */
  document.addEventListener('DOMContentLoaded', () => {
    injectConfig();
    initParticleField();
    initCustomCursor();
    createLetter();
    initEnvelope();
    initContinueButton();
  });

  /* Exposed for future integration/testing, mirroring earlier pages */
  window.openEnvelope = openEnvelope;
  window.revealLetter = revealLetter;
  window.showNextButton = showNextButton;
})();