/* =========================================================
   GLOBAL BACKGROUND MUSIC — shared by every public page (1–8)

   Why this exists: each page is a separate HTML file, so the
   browser destroys any <audio> element when the next page loads.
   This script re-creates the audio on every page and resumes it
   from exactly where it stopped, so it feels like one continuous
   song. Add it to EVERY page (including page 1) with:

       <script src="music.js"></script>

   and remove any other <audio> / music code from your pages so
   there is only one player.

   Do NOT add this to the admin dashboard.
   ========================================================= */

(() => {
  'use strict';

  if (window.__hbdnMusicLoaded) return; // safe if the tag is ever included twice
  window.__hbdnMusicLoaded = true;

  /* ---------------------------------------------------------
     CONFIG — edit these
     --------------------------------------------------------- */
  const MUSIC_SRC = 'bgm.mp3'; // path relative to your HTML pages
  const TARGET_VOLUME = 0.35;               // 0 – 1
  const FIRST_FADE_MS = 1500;               // fade-in the very first time
  const RESUME_FADE_MS = 400;               // short fade-in after each page change
  const SHOW_TOGGLE = true;                 // small mute button in the corner

  const STORAGE_KEY = 'hbdn_bgm_state_v1';  // sessionStorage: lasts for this tab's visit only

  /* ---------------------------------------------------------
     Saved state (survives page-to-page navigation in the same tab)
     --------------------------------------------------------- */
  function readState() {
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || null;
    } catch (err) {
      return null;
    }
  }

  function writeState(state) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      /* storage unavailable — music still works, it just can't resume */
    }
  }

  const saved = readState();
  let enabled = saved ? saved.enabled !== false : true; // her choice: music on/off
  let hasStartedBefore = !!(saved && saved.wasPlaying);

  // Where the song should be now: where it was, plus the time spent between pages.
  let resumeAt = 0;
  if (saved && typeof saved.time === 'number') {
    resumeAt = saved.time + (saved.wasPlaying ? Math.max(0, (Date.now() - saved.savedAt) / 1000) : 0);
  }

  /* ---------------------------------------------------------
     The one audio element
     --------------------------------------------------------- */
  const audio = new Audio();
  audio.src = MUSIC_SRC;
  audio.loop = true;
  audio.preload = 'auto';
  audio.volume = 0;

  audio.addEventListener('loadedmetadata', () => {
    if (resumeAt > 0 && Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = resumeAt % audio.duration;
    }
  });

  function persist() {
    writeState({
      enabled,
      time: audio.currentTime || 0,
      wasPlaying: !audio.paused,
      savedAt: Date.now(),
    });
  }

  let lastPersist = 0;
  audio.addEventListener('timeupdate', () => {
    const now = Date.now();
    if (now - lastPersist > 1000) {
      lastPersist = now;
      persist();
    }
  });

  window.addEventListener('pagehide', persist);
  window.addEventListener('beforeunload', persist);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persist();
  });

  /* ---------------------------------------------------------
     Gentle volume fades
     --------------------------------------------------------- */
  let fadeTimer = null;

  function fadeTo(target, duration) {
    clearInterval(fadeTimer);
    const stepMs = 30;
    const steps = Math.max(1, Math.round(duration / stepMs));
    const startVolume = audio.volume;
    let step = 0;

    fadeTimer = setInterval(() => {
      step += 1;
      const progress = Math.min(1, step / steps);
      audio.volume = Math.max(0, Math.min(1, startVolume + (target - startVolume) * progress));
      if (progress >= 1) clearInterval(fadeTimer);
    }, stepMs);
  }

  /* ---------------------------------------------------------
     Playing (browsers only allow sound after a user gesture)
     --------------------------------------------------------- */
  async function tryPlay() {
    if (!enabled) return false;
    try {
      await audio.play();
      fadeTo(TARGET_VOLUME, hasStartedBefore ? RESUME_FADE_MS : FIRST_FADE_MS);
      hasStartedBefore = true;
      updateToggle();
      persist();
      announce();
      return true;
    } catch (err) {
      return false; // blocked until the visitor interacts with this page
    }
  }

  const GESTURE_EVENTS = ['pointerdown', 'pointerup', 'keydown', 'touchend', 'click'];

  function waitForGesture() {
    const onGesture = async () => {
      if (!enabled) return;
      const started = await tryPlay();
      if (started) GESTURE_EVENTS.forEach((name) => window.removeEventListener(name, onGesture));
    };
    GESTURE_EVENTS.forEach((name) => window.addEventListener(name, onGesture, { passive: true }));
  }

  async function start() {
    if (!enabled) return;
    const started = await tryPlay();
    if (!started) waitForGesture();
  }

  function pause() {
    enabled = false;
    clearInterval(fadeTimer);
    audio.pause();
    updateToggle();
    persist();
    announce();
  }

  function play() {
    enabled = true;
    updateToggle();
    persist();
    start();
  }

  function toggle() {
    if (enabled && !audio.paused) pause();
    else play();
  }

  function announce() {
    window.dispatchEvent(
      new CustomEvent('bgmStateChanged', { detail: { enabled, playing: !audio.paused } })
    );
  }

  /* ---------------------------------------------------------
     Tiny unobtrusive toggle button (bottom-right corner)
     --------------------------------------------------------- */
  let toggleButton = null;

  function injectToggle() {
    if (!SHOW_TOGGLE) return;

    const style = document.createElement('style');
    style.id = 'hbdn-bgm-style';
    style.textContent = `
      .hbdn-bgm-toggle {
        position: fixed;
        right: 16px;
        bottom: calc(16px + env(safe-area-inset-bottom, 0px));
        z-index: 45; /* above page content, below every modal/lightbox (z-index 50) */
        width: 40px;
        height: 40px;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        border: 1px solid rgba(214, 184, 120, 0.5);
        background: rgba(255, 247, 234, 0.78);
        color: #4A3540;
        box-shadow: 0 8px 18px -8px rgba(74, 53, 64, 0.4);
        -webkit-backdrop-filter: blur(6px);
        backdrop-filter: blur(6px);
        cursor: inherit; /* follows each page's custom-cursor setting */
        -webkit-tap-highlight-color: transparent;
        transition: transform 0.2s ease, background 0.2s ease, opacity 0.2s ease;
      }
      .hbdn-bgm-toggle:hover { transform: translateY(-2px); background: rgba(255, 255, 255, 0.92); }
      .hbdn-bgm-toggle:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(214, 184, 120, 0.6); }
      .hbdn-bgm-toggle svg { width: 18px; height: 18px; }
      .hbdn-bgm-toggle .hbdn-bgm-slash { opacity: 0; }
      .hbdn-bgm-toggle.is-off { opacity: 0.75; }
      .hbdn-bgm-toggle.is-off .hbdn-bgm-slash { opacity: 1; }
      @media (prefers-reduced-motion: reduce) {
        .hbdn-bgm-toggle { transition: none; }
      }
    `;
    document.head.appendChild(style);

    toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    toggleButton.className = 'hbdn-bgm-toggle';
    toggleButton.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 18V6l10-2v12"/>
        <circle cx="6.5" cy="18" r="2.5"/>
        <circle cx="16.5" cy="16" r="2.5"/>
        <path class="hbdn-bgm-slash" d="M4 4l16 16"/>
      </svg>`;
    toggleButton.addEventListener('click', toggle);
    document.body.appendChild(toggleButton);
    updateToggle();
  }

  function updateToggle() {
    if (!toggleButton) return;
    const isOn = enabled && !audio.paused;
    toggleButton.classList.toggle('is-off', !enabled);
    toggleButton.setAttribute('aria-pressed', String(isOn));
    toggleButton.setAttribute('aria-label', enabled ? 'Turn music off' : 'Turn music on');
  }

  /* ---------------------------------------------------------
     Go
     --------------------------------------------------------- */
  function init() {
    injectToggle();
    start();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Small public hook (e.g. for future integration or testing).
  window.hbdnMusic = { play, pause, toggle, isPlaying: () => !audio.paused };
})();
