const $ = id => document.getElementById(id);
let novels = [];
let activeNovel = null;
let chapters = [];

async function api(url, opts = {}) {
  const response = await fetch(url, { ...opts, credentials: 'same-origin' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) showLogin();
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function showLogin() {
  $('login').hidden = false;
  $('dashboard').hidden = true;
  $('modal').hidden = true;
  $('chapterModal').hidden = true;
}

async function boot() {
  try {
    const status = await api('/api/auth/status');
    if (status.loggedIn) showDash(status.username);
    else showLogin();
  } catch {
    showLogin();
  }
}

$('loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  $('loginError').textContent = '';
  try {
    const result = await api('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: $('username').value.trim(), password: $('password').value })
    });
    showDash(result.username);
  } catch (error) {
    $('loginError').textContent = error.message;
  }
});

async function showDash(username) {
  $('login').hidden = true;
  $('dashboard').hidden = false;
  $('welcome').textContent = username ? `Signed in as ${username}` : '';
  await load();
}

async function load() {
  novels = await api('/api/novels');
  $('list').innerHTML = novels.map(n => `
    <div class="item">
      <div>${n.cover ? `<img src="${n.cover}" alt="">` : '<div class="thumb">✦</div>'}</div>
      <div>
        <h3>${esc(n.title)}</h3>
        <p>${esc(n.author || 'No author')} • ${esc(n.status)} • ${n.genres.map(esc).join(', ')}</p>
        <p class="chapter-summary">${n.chapters?.length || 0} chapter${n.chapters?.length === 1 ? '' : 's'}</p>
      </div>
      <div class="actions">
        <button type="button" class="chapter-btn" onclick="manageChapters(${n.id})">CHAPTERS</button>
        <button type="button" onclick="editNovel(${n.id})">EDIT</button>
        <button type="button" class="del" onclick="deleteNovel(${n.id})">DELETE</button>
      </div>
    </div>
  `).join('') || '<p style="color:#999">No novels yet. Add your first novel.</p>';
}

$('add').onclick = () => openModal();
$('close').onclick = () => $('modal').hidden = true;
$('chapterClose').onclick = closeChapterManager;
$('chapterCancel').onclick = resetChapterForm;

$('logout').onclick = async () => {
  try { await api('/api/auth/logout', { method: 'POST' }); }
  finally {
    showLogin();
    $('username').value = '';
    $('password').value = '';
  }
};

function openModal(n = null) {
  $('modal').hidden = false;
  $('modalTitle').textContent = n ? 'Edit Novel' : 'Add Novel';
  $('novelId').value = n?.id || '';
  $('title').value = n?.title || '';
  $('author').value = n?.author || '';
  $('genres').value = n?.genres?.join(', ') || '';
  $('status').value = n?.status || 'Ongoing';
  $('synopsis').value = n?.synopsis || '';
  $('patreon').value = n?.patreon_url || '';
  $('cover').value = '';
  $('formError').textContent = '';
}
window.editNovel = id => openModal(novels.find(n => n.id === id));

window.deleteNovel = async id => {
  const n = novels.find(x => x.id === id);
  if (!n || !confirm(`Delete “${n.title}”? This also removes its chapter links.`)) return;
  try {
    await api('/api/novels/' + id, { method: 'DELETE' });
    await load();
  } catch (error) {
    alert(error.message);
  }
};

$('novelForm').addEventListener('submit', async event => {
  event.preventDefault();
  $('formError').textContent = '';
  const id = $('novelId').value;
  const file = $('cover').files[0];
  if (file && file.size > 2 * 1024 * 1024) {
    $('formError').textContent = 'Cover image must be 2 MB or smaller.';
    return;
  }
  const formData = new FormData(event.target);
  try {
    await api(id ? '/api/novels/' + id : '/api/novels', {
      method: id ? 'PUT' : 'POST',
      body: formData
    });
    $('modal').hidden = true;
    await load();
  } catch (error) {
    $('formError').textContent = error.message;
  }
});

window.manageChapters = async id => {
  activeNovel = novels.find(n => n.id === id);
  if (!activeNovel) return;
  $('chapterModal').hidden = false;
  $('chapterModalTitle').textContent = activeNovel.title;
  resetChapterForm();
  await loadChapters();
};

async function loadChapters() {
  if (!activeNovel) return;
  try {
    chapters = await api('/api/novels/' + activeNovel.id + '/chapters');
    renderChapters();
  } catch (error) {
    $('chapterList').innerHTML = `<p class="error">${esc(error.message)}</p>`;
  }
}

function renderChapters() {
  $('chapterCount').textContent = `${chapters.length} chapter${chapters.length === 1 ? '' : 's'}`;
  if (!chapters.length) {
    $('chapterList').innerHTML = '<p class="chapter-empty">No chapters added yet. Add the first Patreon chapter above.</p>';
    return;
  }

  $('chapterList').innerHTML = chapters.map(ch => `
    <div class="chapter-row">
      <div class="chapter-info">
        <span class="chapter-number">CHAPTER ${ch.chapter_number}</span>
        <strong>${esc(ch.title)}</strong>
        <small>${esc(ch.patreon_url)}</small>
      </div>
      <div class="chapter-actions">
        <button type="button" onclick="editChapter(${ch.id})">EDIT</button>
        <button type="button" class="del" onclick="deleteChapter(${ch.id})">DELETE</button>
      </div>
    </div>
  `).join('');
}

function resetChapterForm() {
  $('chapterId').value = '';
  $('chapterNumber').value = '';
  $('chapterTitle').value = '';
  $('chapterPatreon').value = '';
  $('chapterFormError').textContent = '';
  $('chapterSave').textContent = 'ADD CHAPTER';
  $('chapterCancel').hidden = true;
}

function closeChapterManager() {
  $('chapterModal').hidden = true;
  activeNovel = null;
  chapters = [];
  resetChapterForm();
}

window.editChapter = id => {
  const ch = chapters.find(x => x.id === id);
  if (!ch) return;
  $('chapterId').value = ch.id;
  $('chapterNumber').value = ch.chapter_number;
  $('chapterTitle').value = ch.title;
  $('chapterPatreon').value = ch.patreon_url;
  $('chapterFormError').textContent = '';
  $('chapterSave').textContent = 'SAVE CHANGES';
  $('chapterCancel').hidden = false;
};

window.deleteChapter = async id => {
  const ch = chapters.find(x => x.id === id);
  if (!ch || !confirm(`Delete Chapter ${ch.chapter_number}?`)) return;
  try {
    await api('/api/chapters/' + id, { method: 'DELETE' });
    await loadChapters();
    await load();
  } catch (error) {
    alert(error.message);
  }
};

$('chapterForm').addEventListener('submit', async event => {
  event.preventDefault();
  $('chapterFormError').textContent = '';
  if (!activeNovel) return;

  const id = $('chapterId').value;
  const payload = {
    chapter_number: $('chapterNumber').value,
    title: $('chapterTitle').value.trim(),
    patreon_url: $('chapterPatreon').value.trim()
  };

  try {
    await api(id ? '/api/chapters/' + id : '/api/novels/' + activeNovel.id + '/chapters', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    resetChapterForm();
    await loadChapters();
    await load();
  } catch (error) {
    $('chapterFormError').textContent = error.message;
  }
});

function esc(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

boot();
