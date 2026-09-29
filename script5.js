/* =========================================================
   PAGE 5 — Things I Like About You
   Vanilla JS: scattered note cards, accessible modal with
   focus trap, playful reveal, particles, custom cursor.
   ========================================================= */

(() => {
  'use strict';

  /* ---------------------------------------------------------
     CONTENT — single source of truth for every card. Edit
     title/message/footer freely; `accent` is the small number
     shown on the card and inside the opened note.
     --------------------------------------------------------- */
  const littleThings = [
    {
      id: 1,
      title: 'That smile ♡',
      message: 'There is something about your smile that can completely change the mood of a conversation.',
      footer: 'yes, I noticed.',
      accent: '01',
    },
    {
      id: 2,
      title: 'The way you talk',
      message: 'I like the little way you express things. Somehow even ordinary conversations become more interesting.',
      footer: 'I pay attention, okay?',
      accent: '02',
    },
    {
      id: 3,
      title: 'Your random little reactions',
      message: 'Some of your completely random reactions to my flirtings are honestly impossible not to smile at.',
      footer: 'these are dangerous 😂',
      accent: '03',
    },
    {
      id: 4,
      title: 'How easily you make me smile',
      message: 'Sometimes I realize I am smiling at my screen because of something you said. I blame you for that one.',
      footer: "this one's your fault.",
      accent: '04',
    },
    {
      id: 5,
      title: 'The way our conversations feel',
      message: 'Even when we are talking about absolutely nothing, I somehow end up enjoying the conversation more than I expected.',
      footer: 'I could talk to you for hours.',
      accent: '05',
    },
    {
      id: 6,
      title: '...you.',
      message: 'And then there is the simplest answer. I just genuinely like talking to you, knowing you, flirting with you and having you around.',
      footer: 'and this one was obvious.',
      accent: '06',
    },
  ];

  const CARD_ROTATIONS = [-3, 2, -2, 3, -4, 2];
  const DECOR_CLASSES = ['decor-tape', 'decor-clip', 'decor-flower'];

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  /* ===========================================================
     1. DECORATIVE PARTICLE FIELD
     =========================================================== */
  function createParticles() {
    const field = document.getElementById('particleField');
    if (!field || prefersReducedMotion) return;

    const SYMBOLS = ['♡', '✦', '✧', '🌸'];
    const TONES = ['tone-rose', 'tone-lav', 'tone-gold', 'tone-sage'];
    const MAX_PARTICLES = window.innerWidth < 600 ? 9 : 14;

    function spawn(el) {
      const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      const tone = TONES[Math.floor(Math.random() * TONES.length)];
      const size = 10 + Math.random() * 13;
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
      const hoverTargets = document.querySelectorAll(
        '.note-card, .playful-button, .continue-button, .note-close, .note-nav-button'
      );
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
     3. CARD RENDERING + ENTRANCE ANIMATION
     =========================================================== */
  function renderCards() {
    const grid = document.getElementById('notesGrid');
    if (!grid) return;

    littleThings.forEach((thing, index) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `note-card note-pos-${index + 1} ${DECOR_CLASSES[index % DECOR_CLASSES.length]}`;
      card.style.setProperty('--card-rotation', `${CARD_ROTATIONS[index % CARD_ROTATIONS.length]}deg`);
      card.setAttribute('aria-label', `Open note: ${thing.title}`);
      card.dataset.index = String(index);

      const decor = document.createElement('span');
      decor.className = 'note-card-decor';
      decor.setAttribute('aria-hidden', 'true');
      card.appendChild(decor);

      const number = document.createElement('span');
      number.className = 'note-number';
      number.textContent = thing.accent;
      card.appendChild(number);

      const title = document.createElement('span');
      title.className = 'note-card-title';
      title.textContent = thing.title;
      card.appendChild(title);

      const sparkle = document.createElement('span');
      sparkle.className = 'note-sparkle';
      sparkle.setAttribute('aria-hidden', 'true');
      sparkle.textContent = '✦';
      card.appendChild(sparkle);

      card.addEventListener('click', () => openNote(index));

      grid.appendChild(card);
    });

    if (window.__rebindCursorTargets) window.__rebindCursorTargets();
    observeEntrance();
  }

  function observeEntrance() {
    const cards = document.querySelectorAll('.note-card');

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      cards.forEach((card) => card.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const card = entry.target;
            const delay = Number(card.dataset.index || 0) % 3 * 100;
            setTimeout(() => card.classList.add('is-visible'), delay);
            obs.unobserve(card);
          }
        });
      },
      { threshold: 0.2, rootMargin: '0px 0px -40px 0px' }
    );

    cards.forEach((card) => observer.observe(card));
  }

  /* ===========================================================
     4. NOTE MODAL (accessible dialog)
     =========================================================== */
  let currentCardIndex = 0;
  let previouslyFocusedElement = null;
  let savedScrollY = 0;

  const noteBackdrop = () => document.getElementById('noteBackdrop');
  const noteModal = () => document.getElementById('noteModal');
  const noteAccent = () => document.getElementById('noteAccent');
  const noteTitle = () => document.getElementById('noteTitle');
  const noteMessage = () => document.getElementById('noteMessage');
  const noteFooter = () => document.getElementById('noteFooter');
  const noteCounter = () => document.getElementById('noteCounter');
  const noteClose = () => document.getElementById('noteClose');
  const notePrev = () => document.getElementById('notePrev');
  const noteNext = () => document.getElementById('noteNext');
  const pageContent = () => document.getElementById('pageContent');
  const notesGrid = () => document.getElementById('notesGrid');

  function normalizeIndex(i) {
    const len = littleThings.length;
    return ((i % len) + len) % len;
  }

  function getFocusableModalElements() {
    const root = noteModal();
    if (!root) return [];
    return Array.from(
      root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter((el) => !el.hidden && el.offsetParent !== null && !el.disabled);
  }

  function lockScroll() {
    savedScrollY = window.scrollY;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const body = document.body;
    body.style.position = 'fixed';
    body.style.top = `-${savedScrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
  }

  function unlockScroll() {
    const body = document.body;
    body.style.position = '';
    body.style.top = '';
    body.style.left = '';
    body.style.right = '';
    body.style.width = '';
    body.style.paddingRight = '';
    window.scrollTo(0, savedScrollY);
  }

  function updateModalContent() {
    const thing = littleThings[currentCardIndex];
    noteAccent().textContent = thing.accent;
    noteTitle().textContent = thing.title;
    noteMessage().textContent = thing.message;
    noteFooter().textContent = thing.footer;
    noteCounter().textContent = `${String(currentCardIndex + 1).padStart(2, '0')} / ${String(littleThings.length).padStart(2, '0')}`;
  }

  function showNote(index) {
    currentCardIndex = normalizeIndex(index);
    updateModalContent();
  }

  function handleModalKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeNote();
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      showNote(currentCardIndex - 1);
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      showNote(currentCardIndex + 1);
      return;
    }
    if (event.key === 'Tab') {
      trapModalFocus(event);
    }
  }

  function trapModalFocus(event) {
    const focusables = getFocusableModalElements();
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    const isInsideModal = noteModal().contains(active);

    if (event.shiftKey) {
      if (active === first || !isInsideModal) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last || !isInsideModal) {
      event.preventDefault();
      first.focus();
    }
  }

  function openNote(index) {
    previouslyFocusedElement = document.activeElement;
    showNote(index);

    const backdrop = noteBackdrop();
    backdrop.hidden = false;
    // Force layout so the opening transition actually plays
    void backdrop.offsetWidth;
    backdrop.classList.add('is-open');

    const content = pageContent();
    content.setAttribute('aria-hidden', 'true');
    if ('inert' in content) content.inert = true;

    lockScroll();
    document.addEventListener('keydown', handleModalKeydown);
    noteClose().focus();

    window.dispatchEvent(new CustomEvent('page5CardOpened', { detail: { cardId: currentCardIndex + 1 } }));
  }

  function closeNote() {
    const backdrop = noteBackdrop();
    backdrop.classList.remove('is-open');

    document.removeEventListener('keydown', handleModalKeydown);

    const content = pageContent();
    content.removeAttribute('aria-hidden');
    if ('inert' in content) content.inert = false;

    unlockScroll();

    const finishClose = () => {
      backdrop.hidden = true;
    };
    if (prefersReducedMotion) {
      finishClose();
    } else {
      setTimeout(finishClose, 350);
    }

    window.dispatchEvent(new CustomEvent('page5CardClosed', { detail: { cardId: currentCardIndex + 1 } }));

    if (previouslyFocusedElement && document.contains(previouslyFocusedElement)) {
      previouslyFocusedElement.focus();
    } else {
      notesGrid().focus();
    }
    previouslyFocusedElement = null;
  }

  function setupCardInteractions() {
    noteClose().addEventListener('click', closeNote);
    notePrev().addEventListener('click', () => showNote(currentCardIndex - 1));
    noteNext().addEventListener('click', () => showNote(currentCardIndex + 1));

    // Only a click on the backdrop itself (not bubbled from the modal
    // content) should close the note.
    noteBackdrop().addEventListener('click', (e) => {
      if (e.target === noteBackdrop()) closeNote();
    });
  }

  /* ===========================================================
     5. PLAYFUL "probably not ♡" REVEAL (only once)
     =========================================================== */
  function setupPlayfulButton() {
    const button = document.getElementById('playfulButton');
    const reveal = document.getElementById('playfulReveal');
    let hasRevealed = false;

    button.addEventListener('click', () => {
      if (hasRevealed) return;
      hasRevealed = true;

      reveal.hidden = false;
      requestAnimationFrame(() => reveal.classList.add('is-visible'));
      if (window.__rebindCursorTargets) window.__rebindCursorTargets();
    });
  }

  /* ===========================================================
     6. "Keep going" CONTINUE BUTTON
     =========================================================== */
  function spawnContinueSparkles(originEl) {
    if (prefersReducedMotion) return;
    const burst = document.getElementById('sparkleBurst');
    const rect = originEl.getBoundingClientRect();
    const originX = rect.left + rect.width / 2;
    const originY = rect.top + rect.height / 2;
    const symbols = ['✦', '✧', '♡'];
    const count = 14;

    for (let i = 0; i < count; i++) {
      const el = document.createElement('span');
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const distance = 60 + Math.random() * 70;
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

  function setupContinueButton() {
    const continueButton = document.getElementById('continueButton');
    let hasNavigated = false;

    continueButton.addEventListener('click', () => {
      // A boolean guard rather than `button.disabled = true` — disabling
      // a focused button can move focus to <body> and snap the page's
      // scroll position, which looks like the click "did nothing".
      if (hasNavigated) return;
      hasNavigated = true;

      continueButton.classList.add('is-glowing');
      spawnContinueSparkles(continueButton);
      window.dispatchEvent(new CustomEvent('page5Next'));

      // Following the same handoff pattern used between the earlier
      // pages, this also moves on to the next page after a short beat.
      setTimeout(() => {
        window.location.href = 'index6.html';
      }, prefersReducedMotion ? 150 : 650);
    });
  }

  /* ===========================================================
     INIT
     =========================================================== */
  document.addEventListener('DOMContentLoaded', () => {
    createParticles();
    setupCustomCursor();
    renderCards();
    setupCardInteractions();
    setupPlayfulButton();
    setupContinueButton();
  });

  /* Exposed for future integration/testing, mirroring earlier pages */
  window.openNote = openNote;
  window.closeNote = closeNote;
  window.showNote = showNote;
})();