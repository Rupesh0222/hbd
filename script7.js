/* =========================================================
   PAGE 7 — The Confession
   Vanilla JS: gentle reveal sequence, particles, custom cursor.
   ========================================================= */

(() => {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  function dispatchPageEvent(name, detail) {
    window.dispatchEvent(new CustomEvent(name, detail ? { detail } : undefined));
  }

  /* ===========================================================
     1. DECORATIVE PARTICLE FIELD
     =========================================================== */
  function createParticles() {
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
  function setupCustomCursor() {
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
      const hoverTargets = document.querySelectorAll('.reveal-button, .continue-button');
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
     3. SUBTLE SPARKLE/HEART EFFECT (on reveal — restrained, not confetti)
     =========================================================== */
  function spawnRevealSparkles(originEl) {
    if (prefersReducedMotion) return;
    const burst = document.getElementById('sparkleBurst');
    const rect = originEl.getBoundingClientRect();
    const originX = rect.left + rect.width / 2;
    const originY = rect.top + rect.height / 2;
    const symbols = ['✦', '✧', '♡'];
    const count = 10;

    for (let i = 0; i < count; i++) {
      const el = document.createElement('span');
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const distance = 50 + Math.random() * 60;
      el.className = 'burst-sparkle';
      el.textContent = symbols[Math.floor(Math.random() * symbols.length)];
      el.style.left = `${originX}px`;
      el.style.top = `${originY}px`;
      el.style.setProperty('--bx', `${Math.cos(angle) * distance}px`);
      el.style.setProperty('--by', `${Math.sin(angle) * distance}px`);
      el.style.animationDelay = `${Math.random() * 0.15}s`;
      burst.appendChild(el);
      el.addEventListener('animationend', () => el.remove());
    }
  }

  /* ===========================================================
     4. REVEAL SEQUENCE
     =========================================================== */
  function showConfessionSections() {
    const confessionBlock = document.getElementById('confessionBlock');
    const units = Array.from(confessionBlock.querySelectorAll('.reveal-unit'));

    if (prefersReducedMotion) {
      units.forEach((unit) => unit.classList.add('is-visible'));
      return;
    }

    const STEP_DELAY = 480;
    units.forEach((unit, i) => {
      setTimeout(() => unit.classList.add('is-visible'), 250 + i * STEP_DELAY);
    });
  }

  function revealConfession() {
    const introBlock = document.getElementById('introBlock');
    const confessionBlock = document.getElementById('confessionBlock');

    introBlock.classList.add('is-leaving');
    document.body.classList.add('confession-open');

    const proceed = () => {
      introBlock.hidden = true;
      confessionBlock.hidden = false;
      void confessionBlock.offsetWidth;
      confessionBlock.focus({ preventScroll: false });
      showConfessionSections();
    };

    if (prefersReducedMotion) {
      proceed();
    } else {
      setTimeout(proceed, 650);
    }

    dispatchPageEvent('page7ConfessionRevealed');
  }

  function setupReveal() {
    const revealButton = document.getElementById('revealButton');
    let hasRevealed = false;

    revealButton.addEventListener('click', () => {
      if (hasRevealed) return;
      hasRevealed = true;

      spawnRevealSparkles(revealButton);
      revealConfession();
    });
  }

  /* ===========================================================
     5. CONTINUE BUTTON
     =========================================================== */
  function setupContinueButton() {
    const continueButton = document.getElementById('continueButton');
    let hasNavigated = false;

    continueButton.addEventListener('click', () => {
      // A boolean guard rather than `button.disabled = true` — disabling
      // a focused button can move focus to <body> and snap the page's
      // scroll position, which looks like the click "did nothing".
      if (hasNavigated) return;
      hasNavigated = true;

      dispatchPageEvent('page7Next');

      // Following the same handoff pattern used between the earlier
      // pages, this also moves on to the next page after a short beat.
      setTimeout(() => {
        window.location.href = 'index8.html';
      }, prefersReducedMotion ? 150 : 500);
    });
  }

  /* ===========================================================
     INIT
     =========================================================== */
  function initPage() {
    createParticles();
    setupCustomCursor();
    setupReveal();
    setupContinueButton();
  }

  document.addEventListener('DOMContentLoaded', initPage);
})();