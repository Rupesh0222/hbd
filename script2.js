/* =========================================================
   PAGE 2 — Birthday Reveal
   Vanilla JS: entrance sequence, envelope, cursor, particles
   ========================================================= */

(() => {
  'use strict';

  /* ---------------------------------------------------------
     CONFIG — change her name here
     --------------------------------------------------------- */
  const HER_NAME = 'Neha(Cutie pie)';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  /* ===========================================================
     0. NAME INJECTION
     =========================================================== */
  function injectName() {
    const nameEl = document.getElementById('herName');
    if (nameEl) nameEl.textContent = HER_NAME;
  }

  /* ===========================================================
     1. DECORATIVE PARTICLE FIELD
     Same recycling approach as Page 1: a small capped pool of
     hearts / petals / sparkles that drift up and get reused.
     =========================================================== */
  function initParticleField() {
    const field = document.getElementById('particleField');
    if (!field || prefersReducedMotion) return;

    const SYMBOLS = ['♡', '♥', '✦', '✧', '🌸', '✨'];
    const TONES = ['tone-rose', 'tone-lav', 'tone-gold', 'tone-sage'];
    const MAX_PARTICLES = window.innerWidth < 600 ? 12 : 18;

    function spawn(el) {
      const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      const tone = TONES[Math.floor(Math.random() * TONES.length)];
      const size = 11 + Math.random() * 14;
      const startX = Math.random() * 100;
      const drift = (Math.random() - 0.5) * 150;
      const spin = (Math.random() - 0.5) * 50;
      const duration = 15 + Math.random() * 13;
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
     2. CUSTOM CURSOR (same concept as Page 1, kept modular so a
     later shared shell can lift this into one common script)
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
      currentX += (targetX - currentX) * 0.18;
      currentY += (targetY - currentY) * 0.18;
      cursor.style.transform = `translate(${currentX}px, ${currentY}px) translate(-50%, -50%)`;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    // Re-scan hover targets whenever new interactive elements appear
    // (the "There's more..." button only exists in the DOM once shown)
    function bindHoverTargets() {
      const hoverTargets = document.querySelectorAll('.envelope, .next-button, button, a');
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
     3. ENTRANCE SEQUENCE
     "pssst... ♡" -> "Today is a little special." -> main card,
     then the reveal lines and typewriter cue.
     =========================================================== */
  function initEntranceSequence() {
    const introSequence = document.getElementById('introSequence');
    const whisperLine = document.getElementById('whisperLine');
    const todayLine = document.getElementById('todayLine');
    const card = document.getElementById('birthdayCard');
    const headline = document.getElementById('headline');
    const line1 = document.getElementById('line1');
    const line2 = document.getElementById('line2');
    const typewriterLine = document.getElementById('typewriterLine');
    const envelopeStage = document.getElementById('envelopeStage');

    function runTypewriter(el, text, speed = 38) {
      return new Promise((resolve) => {
        el.textContent = '';
        el.classList.add('is-typing');
        let i = 0;
        const step = () => {
          if (i <= text.length) {
            el.textContent = text.slice(0, i);
            i++;
            setTimeout(step, speed);
          } else {
            el.classList.remove('is-typing');
            resolve();
          }
        };
        step();
      });
    }

    async function play() {
      if (prefersReducedMotion) {
        // Skip straight to the fully revealed state
        introSequence.classList.add('is-done');
        card.classList.add('is-revealed');
        headline.classList.add('is-visible');
        line1.classList.add('is-visible');
        line2.classList.add('is-visible');
        typewriterLine.textContent = 'I made you something.';
        envelopeStage.classList.add('is-visible');
        return;
      }

      // Step 1: whisper
      whisperLine.classList.add('is-visible');
      await wait(1600);
      whisperLine.classList.remove('is-visible');
      whisperLine.classList.add('is-leaving');
      await wait(700);

      // Step 2: "today is a little special"
      todayLine.classList.add('is-visible');
      await wait(1900);
      todayLine.classList.remove('is-visible');
      todayLine.classList.add('is-leaving');
      await wait(700);

      introSequence.classList.add('is-done');

      // Step 3: main card + headline
      card.classList.add('is-revealed');
      await wait(300);
      headline.classList.add('is-visible');
      await wait(500);

      // Step 4: supporting lines, staggered
      line1.classList.add('is-visible');
      await wait(450);
      line2.classList.add('is-visible');
      await wait(550);

      // Step 5: typewriter reveal of the final cue line
      await runTypewriter(typewriterLine, 'I made you something.');
      await wait(400);

      // Step 6: envelope appears
      envelopeStage.classList.add('is-visible');
    }

    function wait(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    play();
  }

  /* ===========================================================
     4. ENVELOPE INTERACTION
     =========================================================== */
  function initEnvelope() {
    const envelopeStage = document.getElementById('envelopeStage');
    const envelopeButton = document.getElementById('envelopeButton');
    const letterNote = document.getElementById('letterNote');
    const nextButton = document.getElementById('nextButton');
    const sparkleBurst = document.getElementById('sparkleBurst');

    let isOpen = false;

    function spawnSparkleBurst() {
      if (prefersReducedMotion) return;
      const symbols = ['✦', '✧', '♡', '🌸'];
      const count = 14;

      for (let i = 0; i < count; i++) {
        const el = document.createElement('span');
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
        const distance = 80 + Math.random() * 80;
        el.className = 'burst-sparkle';
        el.textContent = symbols[Math.floor(Math.random() * symbols.length)];
        el.style.setProperty('--bx', `${Math.cos(angle) * distance}px`);
        el.style.setProperty('--by', `${Math.sin(angle) * distance - 40}px`);
        el.style.animationDelay = `${Math.random() * 0.2}s`;
        sparkleBurst.appendChild(el);
        el.addEventListener('animationend', () => el.remove());
      }
    }

    function openEnvelope() {
      if (isOpen) return;
      isOpen = true;

      envelopeStage.classList.add('is-open');
      envelopeButton.setAttribute('aria-expanded', 'true');
      letterNote.setAttribute('aria-hidden', 'false');
      spawnSparkleBurst();

      document.dispatchEvent(new CustomEvent('page2EnvelopeOpened'));

      // Reveal the "There's more..." button shortly after the letter settles
      setTimeout(() => {
        nextButton.hidden = false;
        // Force layout so the transition below actually animates in
        requestAnimationFrame(() => {
          nextButton.classList.add('is-visible');
          if (window.__rebindCursorTargets) window.__rebindCursorTargets();
        });
      }, prefersReducedMotion ? 50 : 900);
    }

    envelopeButton.addEventListener('click', openEnvelope);
    envelopeButton.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        openEnvelope();
      }
    });

    nextButton.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('index2Next'));
      nextButton.disabled = true; // avoid double-clicks while we navigate
      setTimeout(() => {
        window.location.href = 'index3.html';
      }, prefersReducedMotion ? 150 : 500);
    });

    /* ---- Public hook for future integration/testing ---- */
    window.openBirthdayLetter = openEnvelope;
  }

  /* ===========================================================
     5. OPTIONAL HANDOFF FROM PAGE 1
     Page 2 always plays its own entrance on load and works fully
     standalone. If a "pinCorrect" event ever arrives on this same
     document (e.g. a future single-shell integration), it simply
     confirms the entrance is running rather than restarting it.
     =========================================================== */
  function initHandoffListener() {
    document.addEventListener('pinCorrect', () => {
      // Entrance already runs unconditionally on load; nothing to do
      // here yet, but the listener exists so future integration has
      // a place to hook additional cross-page behavior if needed.
    });
  }

  /* ===========================================================
     INIT
     =========================================================== */
  document.addEventListener('DOMContentLoaded', () => {
    injectName();
    initParticleField();
    initCustomCursor();
    initEnvelope();
    initHandoffListener();
    initEntranceSequence();
  });
})();