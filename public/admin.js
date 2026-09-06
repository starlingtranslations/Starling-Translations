const $ = id => document.getElementById(id);
let novels = [];

async function api(url, opts = {}) {
  const response = await fetch(url, {
    ...opts,
    credentials: 'same-origin'
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      showLogin();
    }
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

function showLogin() {
  $('login').hidden = false;
  $('dashboard').hidden = true;
  $('modal').hidden = true;
}

async function boot() {
  try {
    const status = await api('/api/auth/status');
    if (status.loggedIn) {
      showDash(status.username);
    } else {
      showLogin();
    }
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
      body: JSON.stringify({
        username: $('username').value.trim(),
        password: $('password').value
      })
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

  $('list').innerHTML =
    novels.map(n => `
      <div class="item">
        <div>${n.cover ? `<img src="${n.cover}" alt="">` : '<div class="thumb">✦</div>'}</div>
        <div>
          <h3>${esc(n.title)}</h3>
          <p>${esc(n.author || 'No author')} • ${esc(n.status)} • ${n.genres.map(esc).join(', ')}</p>
        </div>
        <div class="actions">
          <button type="button" onclick="editNovel(${n.id})">EDIT</button>
          <button type="button" class="del" onclick="deleteNovel(${n.id})">DELETE</button>
        </div>
      </div>
    `).join('') || '<p style="color:#999">No novels yet. Add your first novel.</p>';
}

$('add').onclick = () => openModal();
$('close').onclick = () => $('modal').hidden = true;

$('logout').onclick = async () => {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } finally {
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
  if (!n || !confirm(`Delete “${n.title}”?`)) return;

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

function esc(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));
}

boot();
