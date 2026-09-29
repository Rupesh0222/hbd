/* =========================================================
   ADMIN DASHBOARD — Page 6 photos + Page 8 responses/messages
   Firebase Authentication (email/password) + Cloud Firestore.

   Cloudinary stores the actual photo files.
   Firestore stores photo metadata and the Cloudinary delivery URL.

   SECURITY:
   - Admin UI checks the custom `admin: true` claim.
   - Firestore Rules enforce admin reads server-side.
   - User-submitted text is rendered with textContent.
   - No Cloudinary API secret is present in this file.
   ========================================================= */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCsLERhSOnP97HVZr9-v9qYrfwzMtKZgS4',
  authDomain: 'hbdn-2cbf0.firebaseapp.com',
  projectId: 'hbdn-2cbf0',
  storageBucket: 'hbdn-2cbf0.firebasestorage.app',
  messagingSenderId: '91782401833',
  appId: '1:91782401833:web:1332a905cbde8414437138',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const state = {
  responses: [],
  messages: [],
  photos: [],
  responsesLoaded: false,
  messagesLoaded: false,
  photosLoaded: false,
};

const listeners = [];
let authCheckCounter = 0;

function friendlyAuthError(err) {
  console.error('[admin] sign-in failed:', err && err.code);
  const code = err && err.code;

  if (code === 'auth/network-request-failed') {
    return 'Network error. Please check your connection and try again.';
  }

  if (code === 'auth/too-many-requests') {
    return 'Too many attempts. Please wait a moment and try again.';
  }

  return 'Invalid email or password.';
}

function friendlyFirestoreError(err, context) {
  console.error(`[admin] Firestore (${context}):`, err && err.code);

  if (err && err.code === 'permission-denied') {
    return 'You don’t have permission to view this.';
  }

  return 'Something went wrong loading this. Please try again.';
}

async function checkAdminAuthorization(user) {
  if (!user) return false;

  try {
    const tokenResult = await user.getIdTokenResult(true);
    return tokenResult.claims.admin === true;
  } catch (err) {
    console.error('[admin] could not read auth claims:', err && err.code);
    return false;
  }
}

function setLoginMessage(message) {
  document.getElementById('loginMessage').textContent = message || '';
}

function setLoginBusy(isBusy, label) {
  const button = document.getElementById('loginButton');

  button.classList.toggle('is-loading', isBusy);

  const labelEl = button.querySelector('.login-button-label');

  if (labelEl) {
    labelEl.textContent = isBusy ? label : 'Sign In';
  }

  button.disabled = isBusy;
}

function checkAuth() {
  onAuthStateChanged(auth, async (user) => {
    const checkId = ++authCheckCounter;

    if (!user) {
      cleanupListeners();
      setLoginBusy(false, 'Sign In');
      showLogin();
      return;
    }

    setLoginBusy(true, 'Checking admin access...');

    const isAdmin = await checkAdminAuthorization(user);

    if (checkId !== authCheckCounter) return;

    if (!isAdmin) {
      cleanupListeners();
      setLoginBusy(false, 'Sign In');
      setLoginMessage('You are not authorized to access this dashboard.');

      await signOut(auth);
      return;
    }

    setLoginBusy(false, 'Sign In');
    showDashboard(user);
  });
}

async function handleLogin(event) {
  event.preventDefault();

  const email = document.getElementById('emailInput').value.trim();
  const password = document.getElementById('passwordInput').value;

  setLoginMessage('');

  if (!email || !password) {
    setLoginMessage('Please enter your email and password.');
    return;
  }

  setLoginBusy(true, 'Signing in...');

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    setLoginBusy(false, 'Sign In');
    setLoginMessage(friendlyAuthError(err));
  }
}

async function handleLogout() {
  cleanupListeners();

  try {
    await signOut(auth);
  } catch (err) {
    console.error('[admin] sign-out failed:', err && err.code);
  }
}

function showLogin() {
  document.getElementById('dashboardScreen').hidden = true;
  document.getElementById('loginScreen').hidden = false;
  document.getElementById('passwordInput').value = '';
}

function showDashboard(user) {
  document.getElementById('loginScreen').hidden = true;
  document.getElementById('dashboardScreen').hidden = false;

  document.getElementById('adminEmailLabel').textContent =
    user.email || '';

  activateSection('overview');

  subscribeToResponses();
  subscribeToMessages();
  subscribeToPhotos();
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function activateSection(sectionKey) {
  document.querySelectorAll('.sidebar-link').forEach((link) => {
    const isActive = link.dataset.section === sectionKey;

    link.classList.toggle('is-active', isActive);

    if (isActive) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });

  document.querySelectorAll('.dash-section').forEach((section) => {
    section.hidden =
      section.id !== `section${capitalize(sectionKey)}`;
  });
}

function closeMobileSidebar() {
  document.getElementById('dashSidebar').classList.remove('is-open');

  document
    .getElementById('navToggle')
    .setAttribute('aria-expanded', 'false');
}

function setupNavigation() {
  document.querySelectorAll('.sidebar-link').forEach((link) => {
    link.addEventListener('click', () => {
      activateSection(link.dataset.section);
      closeMobileSidebar();
    });
  });

  document.getElementById('navToggle').addEventListener('click', () => {
    const sidebar = document.getElementById('dashSidebar');

    const isOpen = sidebar.classList.toggle('is-open');

    document
      .getElementById('navToggle')
      .setAttribute('aria-expanded', String(isOpen));
  });
}

function subscribeToResponses() {
  const statusEl = document.getElementById('responsesStatus');

  statusEl.textContent = 'Loading responses...';

  const responsesQuery = query(
    collection(db, 'proposalResponses'),
    orderBy('respondedAt', 'desc')
  );

  listeners.push(
    onSnapshot(
      responsesQuery,
      (snapshot) => {
        state.responses = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        state.responsesLoaded = true;

        statusEl.textContent =
          state.responses.length === 0
            ? 'No responses yet.'
            : '';

        renderResponses();
        renderOverview();
      },
      (err) => {
        statusEl.textContent =
          friendlyFirestoreError(
            err,
            'proposalResponses'
          );
      }
    )
  );
}

function subscribeToMessages() {
  const statusEl = document.getElementById('messagesStatus');

  statusEl.textContent = 'Loading messages...';

  const messagesQuery = query(
    collection(db, 'messages'),
    orderBy('submittedAt', 'desc')
  );

  listeners.push(
    onSnapshot(
      messagesQuery,
      (snapshot) => {
        state.messages = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        state.messagesLoaded = true;

        statusEl.textContent =
          state.messages.length === 0
            ? 'No messages have been submitted.'
            : '';

        renderMessages();
        renderResponses();
        renderOverview();
      },
      (err) => {
        statusEl.textContent =
          friendlyFirestoreError(
            err,
            'messages'
          );
      }
    )
  );
}

function subscribeToPhotos() {
  const statusEl = document.getElementById('photosStatus');

  statusEl.textContent = 'Loading photos...';

  const photosQuery = query(
    collection(db, 'photos'),
    orderBy('capturedAt', 'desc')
  );

  listeners.push(
    onSnapshot(
      photosQuery,
      (snapshot) => {
        state.photos = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        state.photosLoaded = true;

        statusEl.textContent =
          state.photos.length === 0
            ? 'No photo-booth captures yet.'
            : `${state.photos.length} capture${
                state.photos.length === 1 ? '' : 's'
              }.`;

        renderPhotos();
        renderOverview();
      },
      (err) => {
        statusEl.textContent =
          friendlyFirestoreError(
            err,
            'photos'
          );
      }
    )
  );
}

function cleanupListeners() {
  while (listeners.length) {
    const unsubscribe = listeners.pop();

    try {
      unsubscribe();
    } catch {
      // already detached
    }
  }

  state.responses = [];
  state.messages = [];
  state.photos = [];

  state.responsesLoaded = false;
  state.messagesLoaded = false;
  state.photosLoaded = false;

  document.getElementById('responseList').textContent = '';
  document.getElementById('messageList').textContent = '';
  document.getElementById('photoGrid').textContent = '';

  [
    'summaryTotal',
    'summaryYes',
    'summaryThink',
    'summaryMessages',
    'summaryPhotos',
  ].forEach((id) => {
    document.getElementById(id).textContent = '–';
  });

  [
    'responsesStatus',
    'messagesStatus',
    'photosStatus',
    'overviewStatus',
  ].forEach((id) => {
    document.getElementById(id).textContent = '';
  });
}

function formatDate(value) {
  if (!value) return '–';

  try {
    const date =
      typeof value.toDate === 'function'
        ? value.toDate()
        : new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '–';
    }

    return date.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return '–';
  }
}

function renderOverview() {
  const yes = state.responses.filter(
    (r) => r.choice === 'yes'
  ).length;

  const think = state.responses.filter(
    (r) => r.choice === 'think'
  ).length;

  if (state.responsesLoaded) {
    document.getElementById('summaryTotal').textContent =
      String(state.responses.length);

    document.getElementById('summaryYes').textContent =
      String(yes);

    document.getElementById('summaryThink').textContent =
      String(think);
  }

  if (state.messagesLoaded) {
    document.getElementById('summaryMessages').textContent =
      String(state.messages.length);
  }

  if (state.photosLoaded) {
    document.getElementById('summaryPhotos').textContent =
      String(state.photos.length);
  }

  document.getElementById('overviewStatus').textContent =
    state.responsesLoaded &&
    state.messagesLoaded &&
    state.photosLoaded
      ? 'Live data is connected.'
      : 'Loading live data...';
}

function renderResponses() {
  const list = document.getElementById('responseList');

  list.textContent = '';

  state.responses.forEach((response) => {
    const responseId =
      response.responseId || response.id;

    const card = document.createElement('article');

    card.className = 'response-card';

    const choice = document.createElement('p');

    choice.className = 'response-choice';

    choice.textContent =
      response.choice === 'yes'
        ? 'YES'
        : response.choice === 'think'
          ? 'THINK'
          : String(response.choice || '–');

    card.appendChild(choice);

    const meta = document.createElement('p');

    meta.className = 'response-meta';

    meta.textContent =
      `${formatDate(response.respondedAt)} · Response ID: ${responseId}`;

    card.appendChild(meta);

    const hasMessage = state.messages.some(
      (m) => m.responseId === responseId
    );

    if (hasMessage) {
      const indicator = document.createElement('p');

      indicator.className = 'response-meta';

      indicator.textContent =
        '✉ Message attached (see Messages)';

      card.appendChild(indicator);
    }

    list.appendChild(card);
  });
}

function renderMessages() {
  const list = document.getElementById('messageList');

  list.textContent = '';

  state.messages.forEach((message) => {
    const card = document.createElement('article');

    card.className = 'response-card';

    const meta = document.createElement('p');

    meta.className = 'response-meta';

    meta.textContent =
      `Submitted: ${formatDate(message.submittedAt)}`;

    card.appendChild(meta);

    const ids = document.createElement('p');

    ids.className = 'response-meta';

    ids.textContent =
      `Message ID: ${
        message.messageId || message.id
      } · Response ID: ${
        message.responseId || '–'
      }`;

    card.appendChild(ids);

    const text = document.createElement('p');

    text.className = 'response-message';

    text.textContent = message.message || '';

    card.appendChild(text);

    list.appendChild(card);
  });
}

function renderPhotos() {
  const grid = document.getElementById('photoGrid');

  grid.textContent = '';

  state.photos.forEach((photo) => {
    const card = document.createElement('article');

    card.className = 'photo-card';

    const imageLink = document.createElement('a');

    imageLink.href = photo.imageUrl;
    imageLink.target = '_blank';
    imageLink.rel = 'noopener noreferrer';
    imageLink.className = 'photo-link';

    const image = document.createElement('img');

    image.src = photo.imageUrl;

    image.alt =
      `Photo-booth capture from ${formatDate(
        photo.capturedAt
      )}`;

    image.loading = 'lazy';
    image.decoding = 'async';

    imageLink.appendChild(image);
    card.appendChild(imageLink);

    const body = document.createElement('div');

    body.className = 'photo-card-body';

    const status = document.createElement('span');

    status.className = 'photo-status';

    status.textContent =
      photo.status || 'captured';

    body.appendChild(status);

    const meta = document.createElement('p');

    meta.className = 'response-meta';

    meta.textContent =
      `${formatDate(photo.capturedAt)} · ${
        photo.filter || 'original'
      } · ${photo.frame || 'frame'}`;

    body.appendChild(meta);

    const ids = document.createElement('p');

    ids.className = 'response-meta';

    ids.textContent =
      `Photo ID: ${
        photo.photoId || photo.id
      } · Session: ${
        photo.sessionId || '–'
      }`;

    body.appendChild(ids);

    card.appendChild(body);

    grid.appendChild(card);
  });
}

function initPage() {
  document
    .getElementById('loginForm')
    .addEventListener('submit', handleLogin);

  document
    .getElementById('signOutButton')
    .addEventListener('click', handleLogout);

  setupNavigation();
  checkAuth();
}

document.addEventListener(
  'DOMContentLoaded',
  initPage
);