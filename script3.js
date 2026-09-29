/* =========================================================
   PAGE 3 — Photo Scrapbook
   Vanilla JS: scrapbook rendering, entrance animation,
   accessible lightbox with focus trap, cursor, particles.
   ========================================================= */

(() => {
  'use strict';

  /* ---------------------------------------------------------
     PHOTO DATA — edit paths and notes here.
     `rotation` is the resting tilt (in degrees) for each card.
     --------------------------------------------------------- */
  const photos = [
    {
      src: 'images/photo1.jpg',
      note: 'that smile ♡',
      rotation: -3,
    },
    {
      src: 'images/photo2.jpg',
      note: "okay, this one is unfair.",
      rotation: 2,
    },
    {
      src: 'images/photo3.jpg',
      note: 'pretty without even trying.',
      rotation: -2,
    },
    {
      src: 'images/photo4.jpg',
      note: 'how do you do this?',
      rotation: 4,
    },
    {
      src: 'images/photo5.jpg',
      note: 'one of my favourites.',
      rotation: -4,
    },
    {
      src: 'images/photo6.jpg',
      note: 'just... you.',
      rotation: 3,
    },
  ];

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  const DECOR_CLASSES = ['decor-tape', 'decor-clip', 'decor-star'];

  /* ===========================================================
     1. DECORATIVE PARTICLE FIELD (same recycling approach as
     previous pages — small capped pool, reused in place)
     =========================================================== */
  function initParticleField() {
    const field = document.getElementById('particleField');
    if (!field || prefersReducedMotion) return;

    const SYMBOLS = ['♡', '♥', '✦', '✧', '🌸'];
    const TONES = ['tone-rose', 'tone-lav', 'tone-gold', 'tone-sage'];
    const MAX_PARTICLES = window.innerWidth < 600 ? 10 : 16;

    function spawn(el) {
      const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      const tone = TONES[Math.floor(Math.random() * TONES.length)];
      const size = 11 + Math.random() * 13;
      const startX = Math.random() * 100;
      const drift = (Math.random() - 0.5) * 140;
      const spin = (Math.random() - 0.5) * 45;
      const duration = 16 + Math.random() * 14;
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
      if (!prefersReducedMotion && now - lastTrailTime > 150 && Math.random() > 0.6) {
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

    // Re-scan whenever new interactive elements exist (cards are
    // rendered dynamically, and the "Keep going" button appears later).
    function bindHoverTargets() {
      const hoverTargets = document.querySelectorAll(
        '.polaroid, .keep-going-button, .lightbox-close, .lightbox-nav'
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
     3. SCRAPBOOK RENDERING
     =========================================================== */
  function renderScrapbook() {
    const grid = document.getElementById('scrapbookGrid');
    if (!grid) return;

    photos.forEach((photo, index) => {
      const card = document.createElement('figure');
      card.className = `polaroid photo-pos-${index + 1} ${DECOR_CLASSES[index % DECOR_CLASSES.length]}`;
      card.style.setProperty('--card-rotation', `${photo.rotation}deg`);
      card.tabIndex = 0;
      card.setAttribute('role', 'button');

      card.dataset.index = String(index);

      const decor = document.createElement('span');
      decor.className = 'polaroid-decor';
      decor.setAttribute('aria-hidden', 'true');
      card.appendChild(decor);

      const photoBox = document.createElement('div');
      photoBox.className = 'polaroid-photo';

      const img = document.createElement('img');
      img.src = photo.src;
      img.loading = 'lazy';
      img.addEventListener('error', () => markPhotoBroken(index, photoBox), { once: true });
      photoBox.appendChild(img);
      card.appendChild(photoBox);

      const sparkle = document.createElement('span');
      sparkle.className = 'polaroid-sparkle';
      sparkle.setAttribute('aria-hidden', 'true');
      sparkle.textContent = '✦';
      card.appendChild(sparkle);

      const note = document.createElement('p');
      note.className = 'polaroid-note';
      note.textContent = photo.note;
      card.appendChild(note);

      card.addEventListener('click', () => openLightbox(index));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          openLightbox(index);
        }
      });

      grid.appendChild(card);
    });

    if (window.__rebindCursorTargets) window.__rebindCursorTargets();
    observeEntrance();
  }

  /** Swap a broken photo for a tasteful placeholder, in the card and the data. */
  function markPhotoBroken(index, photoBoxEl) {
    photos[index].hasError = true;
    if (photoBoxEl) {
      photoBoxEl.innerHTML = '';
      photoBoxEl.classList.add('is-placeholder');
      const msg = document.createElement('p');
      msg.textContent = 'your photo goes here ♡';
      photoBoxEl.appendChild(msg);
    }
  }

  /* ===========================================================
     4. ENTRANCE ANIMATION (fade + rise + settle rotation)
     Uses IntersectionObserver so photos below the fold animate
     in as the visitor scrolls to them, rather than all at once.
     =========================================================== */
  function observeEntrance() {
    const cards = document.querySelectorAll('.polaroid');

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      cards.forEach((card) => card.classList.add('is-visible'));
      revealClosing();
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const card = entry.target;
            const delay = Number(card.dataset.index || 0) % 3 * 90;
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
     5. CLOSING SECTION + "Keep going" handoff
     =========================================================== */
  function revealClosing() {
    const closing = document.getElementById('closingSection');
    if (!closing || closing.dataset.revealed) return;
    closing.dataset.revealed = 'true';
    closing.hidden = false;
    requestAnimationFrame(() => closing.classList.add('is-visible'));
    if (window.__rebindCursorTargets) window.__rebindCursorTargets();
  }

  function initClosing() {
    // Reveal once the page (including images) has finished loading,
    // with a small minimum delay so it doesn't feel abrupt.
    let revealed = false;
    const doReveal = () => {
      if (revealed) return;
      revealed = true;
      revealClosing();
    };

    if (document.readyState === 'complete') {
      setTimeout(doReveal, prefersReducedMotion ? 0 : 500);
    } else {
      window.addEventListener('load', () => setTimeout(doReveal, prefersReducedMotion ? 0 : 500));
    }
    // Safety net in case 'load' is delayed by a slow/broken image path
    setTimeout(doReveal, 2500);

    const keepGoingButton = document.getElementById('keepGoingButton');
    let hasNavigated = false;
    keepGoingButton.addEventListener('click', () => {
      // A boolean guard instead of `button.disabled = true` — disabling a
      // focused button moves focus to <body>, which some browsers respond
      // to by snapping the scroll position back to the top of the page.
      // That made it look like the click did nothing / "reset" the page.
      if (hasNavigated) return;
      hasNavigated = true;

      document.dispatchEvent(new CustomEvent('index4Next'));
      setTimeout(() => {
        window.location.href = 'index4.html';
      }, prefersReducedMotion ? 150 : 500);
    });
  }

  /* ===========================================================
     6. LIGHTBOX (accessible modal dialog)
     =========================================================== */
  let currentPhotoIndex = 0;
  let previouslyFocusedElement = null;
  let savedScrollY = 0;

  const lightboxBackdrop = () => document.getElementById('lightboxBackdrop');
  const lightbox = () => document.getElementById('lightbox');
  const lightboxImage = () => document.getElementById('lightboxImage');
  const lightboxPlaceholder = () => document.getElementById('lightboxPlaceholder');
  const lightboxNote = () => document.getElementById('lightboxNote');
  const lightboxCounter = () => document.getElementById('lightboxCounter');
  const lightboxClose = () => document.getElementById('lightboxClose');
  const lightboxPrev = () => document.getElementById('lightboxPrev');
  const lightboxNext = () => document.getElementById('lightboxNext');
  const pageContent = () => document.getElementById('pageContent');
  const scrapbookGrid = () => document.getElementById('scrapbookGrid');

  function normalizeIndex(i) {
    const len = photos.length;
    return ((i % len) + len) % len;
  }

  function getFocusableLightboxElements() {
    const root = lightbox();
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

  function showPhoto(index) {
  currentPhotoIndex = normalizeIndex(index);
  const photo = photos[currentPhotoIndex];
  const img = lightboxImage();
  const placeholder = lightboxPlaceholder();


  lightboxNote().textContent = photo.note || '';
  lightboxCounter().textContent = `${currentPhotoIndex + 1} / ${photos.length}`;

  placeholder.hidden = true;
  img.hidden = false;
  img.src = photo.src;

  document.dispatchEvent(
    new CustomEvent('page3PhotoOpened', {
      detail: { index: currentPhotoIndex }
    })
  );
}

  function handleLightboxKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeLightbox();
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      showPhoto(currentPhotoIndex - 1);
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      showPhoto(currentPhotoIndex + 1);
      return;
    }
    if (event.key === 'Tab') {
      const focusables = getFocusableLightboxElements();
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const isInsideLightbox = lightbox().contains(active);

      if (event.shiftKey) {
        if (active === first || !isInsideLightbox) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !isInsideLightbox) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  function openLightbox(index) {
    previouslyFocusedElement = document.activeElement;
    showPhoto(index);

    const backdrop = lightboxBackdrop();
    backdrop.hidden = false;
    // Force layout so the opening transition actually plays
    void backdrop.offsetWidth;
    backdrop.classList.add('is-open');

    const content = pageContent();
    content.setAttribute('aria-hidden', 'true');
    if ('inert' in content) content.inert = true;

    lockScroll();
    document.addEventListener('keydown', handleLightboxKeydown);
    lightboxClose().focus();
  }

  function closeLightbox() {
    const backdrop = lightboxBackdrop();
    backdrop.classList.remove('is-open');

    document.removeEventListener('keydown', handleLightboxKeydown);

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

    if (previouslyFocusedElement && document.contains(previouslyFocusedElement)) {
      previouslyFocusedElement.focus();
    } else {
      scrapbookGrid().focus();
    }
    previouslyFocusedElement = null;
  }

  function initLightbox() {
    lightboxClose().addEventListener('click', closeLightbox);
    lightboxPrev().addEventListener('click', () => showPhoto(currentPhotoIndex - 1));
    lightboxNext().addEventListener('click', () => showPhoto(currentPhotoIndex + 1));
   

    // Only a click on the backdrop itself (not bubbled from the
    // lightbox content) should close the modal.
    lightboxBackdrop().addEventListener('click', (e) => {
      if (e.target === lightboxBackdrop()) closeLightbox();
    });
  }

  /* ===========================================================
     INIT
     =========================================================== */
  document.addEventListener('DOMContentLoaded', () => {
    initParticleField();
    initCustomCursor();
    renderScrapbook();
    initLightbox();
    initClosing();
  });

  /* Exposed for future integration/testing, mirroring earlier pages */
  window.openScrapbookPhoto = openLightbox;
})();
