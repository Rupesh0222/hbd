/* =========================================================
   PAGE 6 — A Little Photo Booth
   Vanilla JS: camera access, countdown, capture (filter +
   frame composited into the final image), gallery, and
   Cloudinary + Firestore photo persistence.
   ========================================================= */

(() => {
  'use strict';

  const prefersReducedMotion =
    window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

  const isTouchDevice =
    window.matchMedia(
      '(hover: none) and (pointer: coarse)'
    ).matches;

  /* ---------------------------------------------------------
     SESSION + DATA MODEL
     --------------------------------------------------------- */

  const sessionId =
    (crypto.randomUUID &&
      crypto.randomUUID()) ||
    `session-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`;

  const session = {
    sessionId,
    startedAt: new Date().toISOString(),
    completedAt: null,
    photoCount: 0,
  };

  /*
   * Every photo ever captured this session.
   * Status changes in place; nothing is removed from this
   * array locally.
   */
  const capturedPhotos = [];

  const FILTERS = [
    {
      id: 'original',
      label: 'Original',
      css: 'none',
    },
    {
      id: 'vintage',
      label: 'Vintage',
      css:
        'sepia(0.45) saturate(1.15) contrast(1.05) brightness(1.02)',
    },
    {
      id: 'soft',
      label: 'Soft',
      css:
        'brightness(1.06) contrast(0.94) saturate(0.92)',
    },
    {
      id: 'dreamy',
      label: 'Dreamy',
      css:
        'brightness(1.1) contrast(0.88) saturate(1.15)',
    },
    {
      id: 'bw',
      label: 'B&W',
      css: 'grayscale(1) contrast(1.08)',
    },
  ];

  const FRAMES = [
    {
      id: 'polaroid',
      label: 'Polaroid',
    },
    {
      id: 'filmstrip',
      label: 'Film Strip',
    },
    {
      id: 'lovenote',
      label: 'Love Note',
    },
  ];

  let currentFilter = FILTERS[0].id;
  let currentFrame = FRAMES[0].id;
  let currentFacingMode = 'user';
  let currentStream = null;
  let isCapturing = false;
  let currentPreviewRecord = null;

  /* ===========================================================
     0. CLOUDINARY + FIRESTORE PHOTO BACKEND
     =========================================================== */

  const FIREBASE_CONFIG = {
    apiKey:
      'AIzaSyCsLERhSOnP97HVZr9-v9qYrfwzMtKZgS4',
    authDomain:
      'hbdn-2cbf0.firebaseapp.com',
    projectId:
      'hbdn-2cbf0',
    storageBucket:
      'hbdn-2cbf0.firebasestorage.app',
    messagingSenderId:
      '91782401833',
    appId:
      '1:91782401833:web:1332a905cbde8414437138',
  };

  const CLOUDINARY_CLOUD_NAME =
    'mvpwjk4e';

  const CLOUDINARY_UPLOAD_PRESET =
    'hbd-photo-upload';

  const CLOUDINARY_UPLOAD_URL =
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

  const MAX_UPLOAD_BYTES =
    8 * 1024 * 1024;

  const BACKEND_TIMEOUT_MS =
    30000;

  let firebaseServicesPromise = null;

  async function getFirebaseServices() {
    if (!firebaseServicesPromise) {
      firebaseServicesPromise =
        (async () => {
          const [
            appModule,
            authModule,
            firestoreModule,
          ] = await Promise.all([
            import(
              'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'
            ),
            import(
              'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'
            ),
            import(
              'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'
            ),
          ]);

          const firebaseApp =
            appModule.initializeApp(
              FIREBASE_CONFIG,
              'page6-photo-booth'
            );

          const auth =
            authModule.getAuth(
              firebaseApp
            );

          const db =
            firestoreModule.getFirestore(
              firebaseApp
            );

          return {
            auth,
            db,
            signInAnonymously:
              authModule.signInAnonymously,
            doc:
              firestoreModule.doc,
            setDoc:
              firestoreModule.setDoc,
            updateDoc:
              firestoreModule.updateDoc,
            serverTimestamp:
              firestoreModule.serverTimestamp,
          };
        })().catch((err) => {
          firebaseServicesPromise = null;
          throw err;
        });
    }

    return firebaseServicesPromise;
  }

  async function ensureAnonymousVisitor() {
    const services =
      await getFirebaseServices();

    if (services.auth.currentUser) {
      return {
        ...services,
        user:
          services.auth.currentUser,
      };
    }

    const credential =
      await services.signInAnonymously(
        services.auth
      );

    return {
      ...services,
      user: credential.user,
    };
  }

  function withTimeout(
    promise,
    ms,
    errorCode
  ) {
    let timer;

    const timeout =
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const error =
            new Error(errorCode);

          error.code =
            errorCode;

          reject(error);
        }, ms);
      });

    return Promise.race([
      promise,
      timeout,
    ]).finally(() =>
      clearTimeout(timer)
    );
  }

  async function uploadToCloudinary(
    blob,
    photoId
  ) {
    if (!blob || blob.size <= 0) {
      throw new Error(
        'empty-photo'
      );
    }

    if (
      blob.size >
      MAX_UPLOAD_BYTES
    ) {
      const error =
        new Error(
          'photo-too-large'
        );

      error.code =
        'app/photo-too-large';

      throw error;
    }

    const formData =
      new FormData();

    formData.append(
      'file',
      blob,
      `${photoId}.jpg`
    );

    formData.append(
      'upload_preset',
      CLOUDINARY_UPLOAD_PRESET
    );

    const controller =
      new AbortController();

    const timeoutId =
      setTimeout(
        () =>
          controller.abort(),
        BACKEND_TIMEOUT_MS
      );

    try {
      const response =
        await fetch(
          CLOUDINARY_UPLOAD_URL,
          {
            method: 'POST',
            body: formData,
            signal:
              controller.signal,
          }
        );

      const payload =
        await response
          .json()
          .catch(() => null);

      if (
        !response.ok ||
        !payload?.secure_url ||
        !payload?.public_id
      ) {
        const error =
          new Error(
            'cloudinary-upload-failed'
          );

        error.code =
          'app/cloudinary-upload-failed';

        error.details =
          payload?.error?.message ||
          `HTTP ${response.status}`;

        throw error;
      }

      return payload;
    } catch (err) {
      if (
        err?.name ===
        'AbortError'
      ) {
        const error =
          new Error(
            'cloudinary-timeout'
          );

        error.code =
          'app/cloudinary-timeout';

        throw error;
      }

      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function writePhotoMetadata(
    photoRecord,
    cloudinaryAsset,
    existingServices = null,
    existingUser = null
  ) {
    const services =
      existingServices ||
      await ensureAnonymousVisitor();

    const user =
      existingUser ||
      services.user;

    const photoRef =
      services.doc(
        services.db,
        'photos',
        photoRecord.photoId
      );

    await withTimeout(
      services.setDoc(
        photoRef,
        {
          photoId:
            photoRecord.photoId,

          sessionId:
            photoRecord.sessionId,

          capturedAt:
            services.serverTimestamp(),

          cloudinaryPublicId:
            cloudinaryAsset.public_id,

          imageUrl:
            cloudinaryAsset.secure_url,

          format:
            cloudinaryAsset.format ||
            'jpg',

          bytes:
            Number(
              cloudinaryAsset.bytes
            ) || 0,

          width:
            Number(
              cloudinaryAsset.width
            ) || 0,

          height:
            Number(
              cloudinaryAsset.height
            ) || 0,

          filter:
            photoRecord.filter,

          frame:
            photoRecord.frame,

          status:
            photoRecord.status,

          visitorUid:
            user.uid,
        }
      ),
      BACKEND_TIMEOUT_MS,
      'firestore-photo-save-timeout'
    );

    photoRecord.firestoreSaved =
      true;

    return photoRef;
  }

  async function saveCapturedPhoto(
    photoRecord
  ) {
    const {
      user,
      ...services
    } =
      await ensureAnonymousVisitor();

    const cloudinaryAsset =
      await uploadToCloudinary(
        photoRecord.imageBlob,
        photoRecord.photoId
      );

    photoRecord.cloudinaryPublicId =
      cloudinaryAsset.public_id;

    photoRecord.remoteImageUrl =
      cloudinaryAsset.secure_url;

    try {
      await writePhotoMetadata(
        photoRecord,
        cloudinaryAsset,
        services,
        user
      );
    } catch (
      firestoreError
    ) {
      firestoreError.code =
        firestoreError.code ||
        'app/firestore-photo-save-failed';

      throw firestoreError;
    }

    dispatchPageEvent(
      'page6PhotoUploaded',
      {
        photoId:
          photoRecord.photoId,

        sessionId:
          photoRecord.sessionId,

        imageUrl:
          cloudinaryAsset.secure_url,
      }
    );

    return cloudinaryAsset.secure_url;
  }

  async function retryPhotoMetadata(
    photoRecord
  ) {
    if (
      !photoRecord?.cloudinaryPublicId ||
      !photoRecord?.remoteImageUrl
    ) {
      return false;
    }

    try {
      const {
        user,
        ...services
      } =
        await ensureAnonymousVisitor();

      await writePhotoMetadata(
        photoRecord,
        {
          public_id:
            photoRecord.cloudinaryPublicId,

          secure_url:
            photoRecord.remoteImageUrl,

          format:
            'jpg',

          bytes:
            photoRecord.imageBlob?.size ||
            0,

          width: 0,
          height: 0,
        },
        services,
        user
      );

      return true;
    } catch (err) {
      console.error(
        '[page6] Firestore metadata retry failed:',
        err?.code || err
      );

      return false;
    }
  }

  async function updateRemotePhotoStatus(
    photoRecord,
    status
  ) {
    if (!photoRecord?.photoId) {
      return;
    }

    try {
      const {
        db,
        doc,
        updateDoc,
      } =
        await ensureAnonymousVisitor();

      const photoRef =
        doc(
          db,
          'photos',
          photoRecord.photoId
        );

      await withTimeout(
        updateDoc(
          photoRef,
          {
            status,
          }
        ),
        BACKEND_TIMEOUT_MS,
        'firestore-photo-status-timeout'
      );

      photoRecord.status =
        status;
    } catch (err) {
      console.error(
        '[page6] remote status update failed:',
        err?.code || err
      );
    }
  }

  async function savePhotoSession(
    sessionData
  ) {
    if (
      window.__PHOTO_BOOTH_DEV__
    ) {
      console.log(
        '[page6] session completed:',
        sessionData
      );
    }

    return Promise.resolve();
  }

  function dispatchPageEvent(
    name,
    detail
  ) {
    window.dispatchEvent(
      new CustomEvent(
        name,
        {
          detail,
        }
      )
    );
  }

  /* ===========================================================
     1. DECORATIVE PARTICLE FIELD
     =========================================================== */

  function createParticles() {
    const field =
      document.getElementById(
        'particleField'
      );

    if (
      !field ||
      prefersReducedMotion
    ) {
      return;
    }

    const SYMBOLS = [
      '♡',
      '✦',
      '✧',
      '🌸',
    ];

    const TONES = [
      'tone-rose',
      'tone-lav',
      'tone-gold',
      'tone-sage',
    ];

    const MAX_PARTICLES =
      window.innerWidth < 600
        ? 7
        : 11;

    function spawn(el) {
      const symbol =
        SYMBOLS[
          Math.floor(
            Math.random() *
            SYMBOLS.length
          )
        ];

      const tone =
        TONES[
          Math.floor(
            Math.random() *
            TONES.length
          )
        ];

      const size =
        10 +
        Math.random() *
        12;

      const startX =
        Math.random() *
        100;

      const drift =
        (Math.random() - 0.5) *
        120;

      const spin =
        (Math.random() - 0.5) *
        35;

      const duration =
        19 +
        Math.random() *
        14;

      const delay =
        Math.random() *
        duration;

      el.textContent =
        symbol;

      el.className =
        `particle ${tone}`;

      el.style.left =
        `${startX}%`;

      el.style.bottom =
        '-40px';

      el.style.fontSize =
        `${size}px`;

      el.style.setProperty(
        '--drift',
        `${drift}px`
      );

      el.style.setProperty(
        '--spin',
        `${spin}deg`
      );

      el.style.animationDuration =
        `${duration}s`;

      el.style.animationDelay =
        `-${delay}s`;
    }

    for (
      let i = 0;
      i < MAX_PARTICLES;
      i++
    ) {
      const el =
        document.createElement(
          'span'
        );

      spawn(el);

      field.appendChild(el);

      el.addEventListener(
        'animationiteration',
        () => spawn(el)
      );
    }
  }

  /* ===========================================================
     2. CUSTOM CURSOR
     =========================================================== */

  function setupCustomCursor() {
    const cursor =
      document.getElementById(
        'customCursor'
      );

    if (!cursor) return;

    if (isTouchDevice) {
      document.body.classList.add(
        'no-custom-cursor'
      );

      cursor.remove();

      return;
    }

    let targetX =
      window.innerWidth / 2;

    let targetY =
      window.innerHeight / 2;

    let currentX =
      targetX;

    let currentY =
      targetY;

    let lastTrailTime = 0;

    window.addEventListener(
      'mousemove',
      (e) => {
        targetX =
          e.clientX;

        targetY =
          e.clientY;

        const now =
          performance.now();

        if (
          !prefersReducedMotion &&
          now - lastTrailTime >
            170 &&
          Math.random() > 0.68
        ) {
          lastTrailTime =
            now;

          spawnTrailSparkle(
            e.clientX,
            e.clientY
          );
        }
      }
    );

    function spawnTrailSparkle(
      x,
      y
    ) {
      const trail =
        document.createElement(
          'span'
        );

      trail.className =
        'cursor-trail';

      trail.textContent =
        Math.random() > 0.5
          ? '✦'
          : '✧';

      trail.style.left =
        `${x}px`;

      trail.style.top =
        `${y}px`;

      document.body.appendChild(
        trail
      );

      setTimeout(
        () => trail.remove(),
        750
      );
    }

    function tick() {
      currentX +=
        (targetX - currentX) *
        0.18;

      currentY +=
        (targetY - currentY) *
        0.18;

      cursor.style.transform =
        `translate(${currentX}px, ${currentY}px) translate(-50%, -50%)`;

      requestAnimationFrame(
        tick
      );
    }

    requestAnimationFrame(
      tick
    );

    function bindHoverTargets() {
      const hoverTargets =
        document.querySelectorAll(
          '.open-camera-button, .option-button, .control-button, .capture-button, .preview-action, .gallery-item, .continue-button, .gallery-close, .gallery-action'
        );

      hoverTargets.forEach(
        (target) => {
          if (
            target.dataset
              .cursorBound
          ) {
            return;
          }

          target.dataset.cursorBound =
            'true';

          target.addEventListener(
            'mouseenter',
            () =>
              cursor.classList.add(
                'is-hovering'
              )
          );

          target.addEventListener(
            'mouseleave',
            () =>
              cursor.classList.remove(
                'is-hovering'
              )
          );
        }
      );
    }

    bindHoverTargets();

    window.__rebindCursorTargets =
      bindHoverTargets;
  }

  /* ===========================================================
     3. FILTER / FRAME OPTIONS
     =========================================================== */

  function renderOptions() {
    const filterRow =
      document.getElementById(
        'filterRow'
      );

    const frameRow =
      document.getElementById(
        'frameRow'
      );

    FILTERS.forEach(
      (filter) => {
        const btn =
          document.createElement(
            'button'
          );

        btn.type = 'button';

        btn.className =
          'option-button';

        btn.textContent =
          filter.label;

        btn.dataset.filterId =
          filter.id;

        btn.setAttribute(
          'aria-pressed',
          String(
            filter.id ===
              currentFilter
          )
        );

        btn.addEventListener(
          'click',
          () =>
            applyFilter(
              filter.id
            )
        );

        filterRow.appendChild(
          btn
        );
      }
    );

    FRAMES.forEach(
      (frame) => {
        const btn =
          document.createElement(
            'button'
          );

        btn.type = 'button';

        btn.className =
          'option-button';

        btn.textContent =
          frame.label;

        btn.dataset.frameId =
          frame.id;

        btn.setAttribute(
          'aria-pressed',
          String(
            frame.id ===
              currentFrame
          )
        );

        btn.addEventListener(
          'click',
          () =>
            applyFrame(
              frame.id
            )
        );

        frameRow.appendChild(
          btn
        );
      }
    );
  }

  function applyFilter(id) {
    currentFilter =
      id;

    document
      .querySelectorAll(
        '#filterRow .option-button'
      )
      .forEach((btn) => {
        btn.setAttribute(
          'aria-pressed',
          String(
            btn.dataset
              .filterId ===
              id
          )
        );
      });

    const filter =
      FILTERS.find(
        (f) => f.id === id
      );

    const video =
      document.getElementById(
        'cameraVideo'
      );

    if (
      video &&
      filter
    ) {
      video.style.filter =
        filter.css === 'none'
          ? ''
          : filter.css;
    }
  }

  function applyFrame(id) {
    currentFrame =
      id;

    document
      .querySelectorAll(
        '#frameRow .option-button'
      )
      .forEach((btn) => {
        btn.setAttribute(
          'aria-pressed',
          String(
            btn.dataset
              .frameId ===
              id
          )
        );
      });
  }

  /* ===========================================================
     4. CAMERA LIFECYCLE
     =========================================================== */

  function cameraVideoEl() {
    return document.getElementById(
      'cameraVideo'
    );
  }

  function showCameraError(
    message
  ) {
    const errorEl =
      document.getElementById(
        'cameraError'
      );

    errorEl.textContent =
      message;

    errorEl.hidden =
      false;
  }

  function hideCameraError() {
    const errorEl =
      document.getElementById(
        'cameraError'
      );

    errorEl.hidden =
      true;

    errorEl.textContent =
      '';
  }

  function handleCameraError(
    err
  ) {
    let message =
      "Hmm... I couldn't open the camera. Please check your camera permission and try again. ♡";

    const name =
      err && err.name;

    if (
      name ===
        'NotAllowedError' ||
      name ===
        'PermissionDeniedError'
    ) {
      message =
        "Hmm... I couldn't open the camera. Please check your camera permission and try again. ♡";
    } else if (
      name ===
        'NotFoundError' ||
      name ===
        'DevicesNotFoundError'
    ) {
      message =
        "I couldn't find a camera on this device. ♡";
    } else if (
      name ===
        'NotReadableError' ||
      name ===
        'TrackStartError'
    ) {
      message =
        "Your camera seems to be busy with another app right now. ♡";
    } else if (
      name ===
        'OverconstrainedError' ||
      name ===
        'ConstraintNotSatisfiedError'
    ) {
      message =
        "That camera isn't available right now. ♡";
    } else if (
      name ===
      'SecurityError'
    ) {
      message =
        "Cameras only work on a secure connection, so I couldn't open it here. ♡";
    }

    showCameraError(
      message
    );
  }

  async function startCamera() {
    hideCameraError();

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices
        .getUserMedia
    ) {
      showCameraError(
        "This browser doesn't support camera access here. ♡"
      );

      return;
    }

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            video: {
              facingMode:
                currentFacingMode,
            },
            audio: false,
          }
        );

      currentStream =
        stream;

      const video =
        cameraVideoEl();

      video.srcObject =
        stream;

      await video
        .play()
        .catch(
          () => {}
        );

      document.getElementById(
        'boothClosed'
      ).hidden = true;

      document.getElementById(
        'boothLive'
      ).hidden = false;

      dispatchPageEvent(
        'page6CameraOpened',
        {
          sessionId,
        }
      );
    } catch (err) {
      handleCameraError(
        err
      );
    }
  }

  function stopCamera() {
    if (currentStream) {
      currentStream
        .getTracks()
        .forEach(
          (track) =>
            track.stop()
        );

      currentStream =
        null;
    }

    const video =
      cameraVideoEl();

    if (video) {
      video.srcObject =
        null;
    }

    document.getElementById(
      'boothLive'
    ).hidden = true;

    document.getElementById(
      'boothPreview'
    ).hidden = true;

    document.getElementById(
      'boothClosed'
    ).hidden = false;
  }

  async function flipCamera() {
    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices
        .getUserMedia
    ) {
      return;
    }

    const nextFacingMode =
      currentFacingMode ===
      'user'
        ? 'environment'
        : 'user';

    const previousStream =
      currentStream;

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            video: {
              facingMode:
                nextFacingMode,
            },
            audio: false,
          }
        );

      if (previousStream) {
        previousStream
          .getTracks()
          .forEach(
            (track) =>
              track.stop()
          );
      }

      currentStream =
        stream;

      currentFacingMode =
        nextFacingMode;

      const video =
        cameraVideoEl();

      video.srcObject =
        stream;

      await video
        .play()
        .catch(
          () => {}
        );

      video.classList.toggle(
        'is-rear',
        currentFacingMode ===
          'environment'
      );
    } catch (err) {
      handleCameraError(
        err
      );
    }
  }

  /* ===========================================================
     5. COUNTDOWN + CAPTURE
     =========================================================== */

  function runCountdown() {
    return new Promise(
      (resolve) => {
        const overlay =
          document.getElementById(
            'countdownOverlay'
          );

        const numberEl =
          document.getElementById(
            'countdownNumber'
          );

        const sequence = [
          '3',
          '2',
          '1',
          '♡',
        ];

        const stepDelay =
          prefersReducedMotion
            ? 120
            : 700;

        let i = 0;

        overlay.classList.add(
          'is-active'
        );

        function step() {
          numberEl.textContent =
            sequence[i];

          numberEl.classList.remove(
            'is-visible'
          );

          void numberEl.offsetWidth;

          numberEl.classList.add(
            'is-visible'
          );

          i++;

          if (
            i <
            sequence.length
          ) {
            setTimeout(
              step,
              stepDelay
            );
          } else {
            setTimeout(
              () => {
                overlay.classList.remove(
                  'is-active'
                );

                triggerFlash();

                resolve();
              },
              prefersReducedMotion
                ? 60
                : 480
            );
          }
        }

        step();
      }
    );
  }

  function triggerFlash() {
    const flash =
      document.getElementById(
        'flashOverlay'
      );

    if (
      prefersReducedMotion
    ) {
      return;
    }

    flash.classList.remove(
      'is-flashing'
    );

    void flash.offsetWidth;

    flash.classList.add(
      'is-flashing'
    );
  }

  function drawRawFrame() {
    const video =
      cameraVideoEl();

    const width =
      video.videoWidth ||
      720;

    const height =
      video.videoHeight ||
      960;

    const raw =
      document.createElement(
        'canvas'
      );

    raw.width =
      width;

    raw.height =
      height;

    const ctx =
      raw.getContext(
        '2d'
      );

    const filter =
      FILTERS.find(
        (f) =>
          f.id ===
          currentFilter
      );

    ctx.filter =
      filter &&
      filter.css !==
        'none'
        ? filter.css
        : 'none';

    if (
      currentFacingMode ===
      'user'
    ) {
      ctx.translate(
        width,
        0
      );

      ctx.scale(
        -1,
        1
      );
    }

    ctx.drawImage(
      video,
      0,
      0,
      width,
      height
    );

    return raw;
  }

  function buildPolaroidFrame(
    raw
  ) {
    const side =
      Math.round(
        raw.width * 0.06
      );

    const top =
      side;

    const bottom =
      Math.round(
        raw.width * 0.2
      );

    const canvas =
      document.createElement(
        'canvas'
      );

    canvas.width =
      raw.width +
      side * 2;

    canvas.height =
      raw.height +
      top +
      bottom;

    const ctx =
      canvas.getContext(
        '2d'
      );

    ctx.fillStyle =
      '#fdf6ea';

    ctx.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.drawImage(
      raw,
      side,
      top
    );

    ctx.fillStyle =
      'rgba(216, 167, 177, 0.9)';

    ctx.font =
      `${Math.round(
        raw.width * 0.06
      )}px "Cormorant Garamond", Georgia, serif`;

    ctx.textAlign =
      'center';

    ctx.fillText(
      '♡',
      canvas.width / 2,
      raw.height +
        top +
        bottom * 0.68
    );

    return canvas;
  }

  function buildFilmstripFrame(
    raw
  ) {
    const margin =
      Math.round(
        raw.width * 0.1
      );

    const holeSize =
      Math.round(
        margin * 0.35
      );

    const canvas =
      document.createElement(
        'canvas'
      );

    canvas.width =
      raw.width +
      margin * 2;

    canvas.height =
      raw.height +
      margin * 2;

    const ctx =
      canvas.getContext(
        '2d'
      );

    ctx.fillStyle =
      '#241a1e';

    ctx.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.drawImage(
      raw,
      margin,
      margin
    );

    ctx.fillStyle =
      '#fdf6ea';

    const holeGap =
      holeSize * 2.2;

    for (
      let y = holeGap;
      y <
      canvas.height -
        holeGap / 2;
      y += holeGap
    ) {
      ctx.fillRect(
        margin * 0.32,
        y,
        holeSize,
        holeSize
      );

      ctx.fillRect(
        canvas.width -
          margin * 0.32 -
          holeSize,
        y,
        holeSize,
        holeSize
      );
    }

    return canvas;
  }

  function buildLoveNoteFrame(
    raw
  ) {
    const side =
      Math.round(
        raw.width * 0.08
      );

    const top =
      side;

    const bottom =
      Math.round(
        raw.width * 0.16
      );

    const canvas =
      document.createElement(
        'canvas'
      );

    canvas.width =
      raw.width +
      side * 2;

    canvas.height =
      raw.height +
      top +
      bottom;

    const ctx =
      canvas.getContext(
        '2d'
      );

    ctx.fillStyle =
      '#fff8ec';

    ctx.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.strokeStyle =
      'rgba(214, 184, 120, 0.8)';

    ctx.lineWidth =
      Math.max(
        2,
        Math.round(
          raw.width * 0.006
        )
      );

    ctx.strokeRect(
      ctx.lineWidth * 2,
      ctx.lineWidth * 2,
      canvas.width -
        ctx.lineWidth * 4,
      canvas.height -
        ctx.lineWidth * 4
    );

    ctx.drawImage(
      raw,
      side,
      top
    );

    ctx.fillStyle =
      'rgba(74, 53, 64, 0.75)';

    ctx.font =
      `italic ${Math.round(
        raw.width * 0.045
      )}px "Cormorant Garamond", Georgia, serif`;

    ctx.textAlign =
      'center';

    ctx.fillText(
      'for you ♡',
      canvas.width / 2,
      raw.height +
        top +
        bottom * 0.62
    );

    return canvas;
  }

  function buildFramedCanvas(
    raw
  ) {
    if (
      currentFrame ===
      'polaroid'
    ) {
      return buildPolaroidFrame(
        raw
      );
    }

    if (
      currentFrame ===
      'filmstrip'
    ) {
      return buildFilmstripFrame(
        raw
      );
    }

    if (
      currentFrame ===
      'lovenote'
    ) {
      return buildLoveNoteFrame(
        raw
      );
    }

    return raw;
  }

  function canvasToBlob(
    canvas
  ) {
    return new Promise(
      (resolve) => {
        canvas.toBlob(
          (blob) =>
            resolve(blob),
          'image/jpeg',
          0.92
        );
      }
    );
  }

  function createPhotoRecord(
    blob,
    imageUrl
  ) {
    const photoId =
      (crypto.randomUUID &&
        crypto.randomUUID()) ||
      `photo-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;

    return {
      photoId,

      sessionId,

      capturedAt:
        new Date().toISOString(),

      imageBlob:
        blob,

      imageUrl,

      caption: '',

      filter:
        currentFilter,

      frame:
        currentFrame,

      status:
        'captured',

      firestoreSaved:
        false,

      cloudinaryPublicId:
        '',

      remoteImageUrl:
        '',
    };
  }

  async function capturePhoto() {
    if (
      isCapturing ||
      !currentStream
    ) {
      return;
    }

    isCapturing =
      true;

    document
      .getElementById(
        'captureButton'
      )
      .classList.add(
        'is-busy'
      );

    try {
      await runCountdown();

      const raw =
        drawRawFrame();

      const framed =
        buildFramedCanvas(
          raw
        );

      const blob =
        await canvasToBlob(
          framed
        );

      if (!blob) {
        return;
      }

      const imageUrl =
        URL.createObjectURL(
          blob
        );

      const photoRecord =
        createPhotoRecord(
          blob,
          imageUrl
        );

      capturedPhotos.push(
        photoRecord
      );

      session.photoCount =
        capturedPhotos.length;

      dispatchPageEvent(
        'page6PhotoCaptured',
        photoRecord
      );

      try {
        await saveCapturedPhoto(
          photoRecord
        );
      } catch (
        saveErr
      ) {
        console.error(
          '[page6] initial photo save failed:',
          saveErr?.code ||
            saveErr
        );

        showPreviewStatus(
          "I couldn't save this one right now. You can still download it.",
          true
        );
      }

      showCapturedPreview(
        photoRecord
      );
    } finally {
      isCapturing =
        false;

      document
        .getElementById(
          'captureButton'
        )
        .classList.remove(
          'is-busy'
        );
    }
  }

  /* ===========================================================
     6. PREVIEW
     =========================================================== */

  function showPreviewStatus(
    message,
    isRetryable
  ) {
    const statusEl =
      document.getElementById(
        'previewStatus'
      );

    statusEl.textContent =
      message || '';

    statusEl.dataset.retryable =
      isRetryable
        ? 'true'
        : 'false';
  }

  function showCapturedPreview(
    photoRecord
  ) {
    currentPreviewRecord =
      photoRecord;

    document.getElementById(
      'previewImage'
    ).src =
      photoRecord.imageUrl;

    showPreviewStatus(
      ''
    );

    document.getElementById(
      'boothLive'
    ).hidden = true;

    document.getElementById(
      'boothPreview'
    ).hidden = false;
  }

  function returnToLiveCamera() {
    document.getElementById(
      'boothPreview'
    ).hidden = true;

    document.getElementById(
      'boothLive'
    ).hidden = false;
  }

  async function keepPhoto() {
    if (
      !currentPreviewRecord
    ) {
      return;
    }

    const record =
      currentPreviewRecord;

    record.status =
      'kept';

    if (
      !record.firestoreSaved
    ) {
      await retryPhotoMetadata(
        record
      );
    }

    if (
      record.firestoreSaved
    ) {
      await updateRemotePhotoStatus(
        record,
        'kept'
      );
    }

    dispatchPageEvent(
      'page6PhotoKept',
      {
        photoId:
          record.photoId,
        sessionId,
      }
    );

    currentPreviewRecord =
      null;

    renderGallery();

    returnToLiveCamera();
  }

  async function retakePhoto() {
    if (
      !currentPreviewRecord
    ) {
      return;
    }

    const record =
      currentPreviewRecord;

    record.status =
      'retaken';

    if (
      !record.firestoreSaved
    ) {
      await retryPhotoMetadata(
        record
      );
    }

    if (
      record.firestoreSaved
    ) {
      await updateRemotePhotoStatus(
        record,
        'retaken'
      );
    }

    dispatchPageEvent(
      'page6PhotoRetaken',
      {
        photoId:
          record.photoId,
        sessionId,
      }
    );

    currentPreviewRecord =
      null;

    returnToLiveCamera();
  }

  function downloadPhoto(
    record
  ) {
    if (!record) return;

    const link =
      document.createElement(
        'a'
      );

    link.href =
      record.imageUrl;

    link.download =
      `photo-booth-${record.photoId}.jpg`;

    document.body.appendChild(
      link
    );

    link.click();

    link.remove();
  }

  /* ===========================================================
     7. GALLERY
     =========================================================== */

  function renderGallery() {
    const section =
      document.getElementById(
        'gallerySection'
      );

    const grid =
      document.getElementById(
        'galleryGrid'
      );

    grid.innerHTML =
      '';

    const kept =
      capturedPhotos.filter(
        (p) =>
          p.status ===
          'kept'
      );

    if (
      kept.length === 0
    ) {
      section.hidden =
        true;

      return;
    }

    section.hidden =
      false;

    kept.forEach(
      (record) => {
        const item =
          document.createElement(
            'button'
          );

        item.type =
          'button';

        item.className =
          'gallery-item';

        item.setAttribute(
          'aria-label',
          `View photo captured ${new Date(
            record.capturedAt
          ).toLocaleString()}`
        );

        const img =
          document.createElement(
            'img'
          );

        img.src =
          record.imageUrl;

        img.alt =
          '';

        item.appendChild(
          img
        );

        item.addEventListener(
          'click',
          () =>
            openPhotoPreview(
              record
            )
        );

        grid.appendChild(
          item
        );
      }
    );

    if (
      window.__rebindCursorTargets
    ) {
      window.__rebindCursorTargets();
    }
  }

  /* ===========================================================
     8. GALLERY MODAL
     =========================================================== */

  let galleryPreviouslyFocused =
    null;

  let gallerySavedScrollY =
    0;

  let galleryActiveRecord =
    null;

  const galleryBackdrop =
    () =>
      document.getElementById(
        'galleryBackdrop'
      );

  const galleryModal =
    () =>
      document.getElementById(
        'galleryModal'
      );

  const galleryModalImage =
    () =>
      document.getElementById(
        'galleryModalImage'
      );

  const galleryModalActions =
    () =>
      document.getElementById(
        'galleryModalActions'
      );

  const galleryConfirm =
    () =>
      document.getElementById(
        'galleryConfirm'
      );

  const galleryClose =
    () =>
      document.getElementById(
        'galleryClose'
      );

  const pageContent =
    () =>
      document.getElementById(
        'pageContent'
      );

  function getFocusableGalleryElements() {
    const root =
      galleryModal();

    if (!root) {
      return [];
    }

    return Array.from(
      root.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter(
      (el) =>
        !el.hidden &&
        el.offsetParent !==
          null &&
        !el.disabled
    );
  }

  function lockScroll() {
    gallerySavedScrollY =
      window.scrollY;

    const scrollbarWidth =
      window.innerWidth -
      document.documentElement
        .clientWidth;

    const body =
      document.body;

    body.style.position =
      'fixed';

    body.style.top =
      `-${gallerySavedScrollY}px`;

    body.style.left =
      '0';

    body.style.right =
      '0';

    body.style.width =
      '100%';

    if (
      scrollbarWidth > 0
    ) {
      body.style.paddingRight =
        `${scrollbarWidth}px`;
    }
  }

  function unlockScroll() {
    const body =
      document.body;

    body.style.position =
      '';

    body.style.top =
      '';

    body.style.left =
      '';

    body.style.right =
      '';

    body.style.width =
      '';

    body.style.paddingRight =
      '';

    window.scrollTo(
      0,
      gallerySavedScrollY
    );
  }

  function handleGalleryKeydown(
    event
  ) {
    if (
      event.key ===
      'Escape'
    ) {
      event.preventDefault();

      closePhotoPreview();

      return;
    }

    if (
      event.key ===
      'Tab'
    ) {
      const focusables =
        getFocusableGalleryElements();

      if (
        focusables.length ===
        0
      ) {
        return;
      }

      const first =
        focusables[0];

      const last =
        focusables[
          focusables.length - 1
        ];

      const active =
        document.activeElement;

      const isInside =
        galleryModal().contains(
          active
        );

      if (
        event.shiftKey
      ) {
        if (
          active === first ||
          !isInside
        ) {
          event.preventDefault();

          last.focus();
        }
      } else if (
        active === last ||
        !isInside
      ) {
        event.preventDefault();

        first.focus();
      }
    }
  }

  function openPhotoPreview(
    record
  ) {
    galleryActiveRecord =
      record;

    galleryPreviouslyFocused =
      document.activeElement;

    galleryModalImage().src =
      record.imageUrl;

    galleryModalActions().hidden =
      false;

    galleryConfirm().hidden =
      true;

    const backdrop =
      galleryBackdrop();

    backdrop.hidden =
      false;

    void backdrop.offsetWidth;

    backdrop.classList.add(
      'is-open'
    );

    const content =
      pageContent();

    content.setAttribute(
      'aria-hidden',
      'true'
    );

    if (
      'inert' in content
    ) {
      content.inert =
        true;
    }

    lockScroll();

    document.addEventListener(
      'keydown',
      handleGalleryKeydown
    );

    galleryClose().focus();
  }

  function closePhotoPreview() {
    const backdrop =
      galleryBackdrop();

    backdrop.classList.remove(
      'is-open'
    );

    document.removeEventListener(
      'keydown',
      handleGalleryKeydown
    );

    const content =
      pageContent();

    content.removeAttribute(
      'aria-hidden'
    );

    if (
      'inert' in content
    ) {
      content.inert =
        false;
    }

    unlockScroll();

    const finishClose =
      () => {
        backdrop.hidden =
          true;
      };

    if (
      prefersReducedMotion
    ) {
      finishClose();
    } else {
      setTimeout(
        finishClose,
        350
      );
    }

    if (
      galleryPreviouslyFocused &&
      document.contains(
        galleryPreviouslyFocused
      )
    ) {
      galleryPreviouslyFocused.focus();
    } else {
      document
        .getElementById(
          'galleryGrid'
        )
        .focus();
    }

    galleryPreviouslyFocused =
      null;

    galleryActiveRecord =
      null;
  }

  function deleteLocalPhoto(
    record
  ) {
    if (!record) return;

    record.status =
      'removed_from_session';

    dispatchPageEvent(
      'page6PhotoRemovedFromSession',
      {
        photoId:
          record.photoId,
        sessionId,
      }
    );

    renderGallery();

    closePhotoPreview();
  }

  function setupGalleryModal() {
    galleryClose().addEventListener(
      'click',
      closePhotoPreview
    );

    galleryBackdrop().addEventListener(
      'click',
      (e) => {
        if (
          e.target ===
          galleryBackdrop()
        ) {
          closePhotoPreview();
        }
      }
    );

    document
      .getElementById(
        'galleryDownload'
      )
      .addEventListener(
        'click',
        () => {
          downloadPhoto(
            galleryActiveRecord
          );
        }
      );

    document
      .getElementById(
        'galleryRemove'
      )
      .addEventListener(
        'click',
        () => {
          galleryModalActions().hidden =
            true;

          galleryConfirm().hidden =
            false;

          document
            .getElementById(
              'galleryKeepIt'
            )
            .focus();
        }
      );

    document
      .getElementById(
        'galleryKeepIt'
      )
      .addEventListener(
        'click',
        () => {
          galleryConfirm().hidden =
            true;

          galleryModalActions().hidden =
            false;

          galleryClose().focus();
        }
      );

    document
      .getElementById(
        'galleryConfirmRemove'
      )
      .addEventListener(
        'click',
        () => {
          deleteLocalPhoto(
            galleryActiveRecord
          );
        }
      );
  }

  /* ===========================================================
     9. WIRING UP THE BOOTH CONTROLS
     =========================================================== */

  function setupBoothControls() {
    document
      .getElementById(
        'openCameraButton'
      )
      .addEventListener(
        'click',
        startCamera
      );

    document
      .getElementById(
        'closeCameraButton'
      )
      .addEventListener(
        'click',
        stopCamera
      );

    document
      .getElementById(
        'flipButton'
      )
      .addEventListener(
        'click',
        flipCamera
      );

    document
      .getElementById(
        'captureButton'
      )
      .addEventListener(
        'click',
        capturePhoto
      );

    document
      .getElementById(
        'keepButton'
      )
      .addEventListener(
        'click',
        keepPhoto
      );

    document
      .getElementById(
        'retakeButton'
      )
      .addEventListener(
        'click',
        retakePhoto
      );

    document
      .getElementById(
        'downloadPreviewButton'
      )
      .addEventListener(
        'click',
        () => {
          downloadPhoto(
            currentPreviewRecord
          );
        }
      );
  }

  /* ===========================================================
     10. CONTINUE BUTTON
     =========================================================== */

  function setupContinueButton() {
    const continueButton =
      document.getElementById(
        'continueButton'
      );

    let hasNavigated =
      false;

    continueButton.addEventListener(
      'click',
      () => {
        if (
          hasNavigated
        ) {
          return;
        }

        hasNavigated =
          true;

        session.completedAt =
          new Date().toISOString();

        void savePhotoSession(
          session
        );

        stopCamera();

        dispatchPageEvent(
          'page6Next',
          {
            sessionId,
            photoCount:
              session.photoCount,
          }
        );

        setTimeout(
          () => {
            window.location.href =
              'index7.html';
          },
          prefersReducedMotion
            ? 150
            : 500
        );
      }
    );
  }

  /* ===========================================================
     CLEANUP
     =========================================================== */

  window.addEventListener(
    'beforeunload',
    () => {
      stopCamera();
    }
  );

  /* ===========================================================
     INIT
     =========================================================== */

  function initPage() {
    createParticles();
    setupCustomCursor();
    renderOptions();
    setupBoothControls();
    setupGalleryModal();
    setupContinueButton();
  }

  document.addEventListener(
    'DOMContentLoaded',
    initPage
  );

  window.openPhotoPreview =
    openPhotoPreview;

  window.closePhotoPreview =
    closePhotoPreview;
})();