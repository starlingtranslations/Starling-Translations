const state = {
  novels: [],
  filtered: [],
  genre: 'ALL',
  query: '',
  slide: 0,
  timer: null
};

const $ = id => document.getElementById(id);

function esc(value = '') {
  return String(value).replace(/[&<>'"]/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[c]));
}

function getGenres(novel) {
  return Array.isArray(novel.genres) ? novel.genres.filter(Boolean) : [];
}

function matches(novel) {
  const q = state.query.trim().toLowerCase();
  const text = `${novel.title || ''} ${novel.author || ''} ${getGenres(novel).join(' ')}`.toLowerCase();
  const genreOk = state.genre === 'ALL' || getGenres(novel).some(g => g.toLowerCase() === state.genre.toLowerCase());
  return genreOk && (!q || text.includes(q));
}

function renderFilters() {
  const allGenres = [...new Set(state.novels.flatMap(getGenres))].sort((a,b)=>a.localeCompare(b));
  $('genreFilters').innerHTML = ['ALL', ...allGenres].map(g =>
    `<button type="button" class="filter ${state.genre.toLowerCase() === g.toLowerCase() ? 'active' : ''}" data-genre="${esc(g)}">${esc(g)}</button>`
  ).join('');
  $('genreFilters').querySelectorAll('.filter').forEach(btn => {
    btn.addEventListener('click', () => {
      state.genre = btn.dataset.genre;
      renderFilters();
      renderGrid();
    });
  });
}

function renderGrid() {
  state.filtered = state.novels.filter(matches);
  const grid = $('novelGrid');
  const empty = $('emptyResults');

  if (!state.filtered.length) {
    grid.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  grid.innerHTML = state.filtered.map((n, i) => {
    const genres = getGenres(n);
    return `
      <article class="novel-card" style="--delay:${i * 65}ms">
        <div class="novel-cover-wrap">
          ${n.cover
            ? `<img class="novel-cover" src="${n.cover}" alt="${esc(n.title)} cover" loading="lazy">`
            : `<div class="novel-cover-placeholder"><span>✦</span></div>`}
          <div class="cover-glow"></div>
          <span class="status-pill">${esc(n.status || 'ONGOING')}</span>
        </div>
        <div class="novel-info">
          <div class="novel-type">${genres.length ? esc(genres[0]) : 'TRANSLATED NOVEL'} <i>✦</i></div>
          <h3>${esc(n.title)}</h3>
          <p class="novel-author">${esc(n.author || 'Original Author')}</p>
          <div class="genre-list">${genres.slice(0,3).map(g=>`<span>${esc(g)}</span>`).join('')}</div>
          <p class="novel-synopsis">${esc(n.synopsis || 'Discover this translated story and enter a new world.')}</p>
          <a class="check-btn" href="${esc(n.patreon_url || '#')}" target="_blank" rel="noopener noreferrer">
            <span>CHECK IT OUT</span><b>↗</b>
          </a>
        </div>
      </article>
    `;
  }).join('');

  requestAnimationFrame(() => {
    grid.querySelectorAll('.novel-card').forEach(card => card.classList.add('show'));
  });
}

function renderSlider() {
  const slider = $('heroSlider');
  const novels = state.novels.filter(n => n.cover);

  if (!novels.length) {
    slider.innerHTML = `<div class="slider-fallback"><span>✦</span><p>Your next story is waiting.</p></div>`;
    $('sliderDots').innerHTML = '';
    $('slideCounter').textContent = '01 / 01';
    return;
  }

  if (state.slide >= novels.length) state.slide = 0;

  slider.innerHTML = novels.map((n, i) => `
    <a class="hero-slide ${i === state.slide ? 'active' : ''}" href="${esc(n.patreon_url || '#')}" target="_blank" rel="noopener noreferrer" aria-label="Open ${esc(n.title)}">
      <img src="${n.cover}" alt="${esc(n.title)} cover">
      <div class="slide-overlay"></div>
      <div class="slide-info">
        <span>${esc(n.status || 'ONGOING')}</span>
        <h3>${esc(n.title)}</h3>
        <p>${esc(n.author || 'Original Author')}</p>
      </div>
    </a>
  `).join('');

  $('sliderDots').innerHTML = novels.map((_,i)=>
    `<button type="button" class="dot ${i===state.slide?'active':''}" data-index="${i}" aria-label="Show story ${i+1}"></button>`
  ).join('');

  $('sliderDots').querySelectorAll('.dot').forEach(dot => {
    dot.addEventListener('click', () => {
      state.slide = Number(dot.dataset.index);
      renderSlider();
      restartSlider();
    });
  });

  $('slideCounter').textContent =
    `${String(state.slide + 1).padStart(2,'0')} / ${String(novels.length).padStart(2,'0')}`;
}

function nextSlide() {
  const count = state.novels.filter(n => n.cover).length;
  if (count < 2) return;
  state.slide = (state.slide + 1) % count;
  renderSlider();
}

function prevSlide() {
  const count = state.novels.filter(n => n.cover).length;
  if (count < 2) return;
  state.slide = (state.slide - 1 + count) % count;
  renderSlider();
}

function restartSlider() {
  clearInterval(state.timer);
  const count = state.novels.filter(n => n.cover).length;
  if (count > 1) state.timer = setInterval(nextSlide, 3800);
}

$('nextSlide').addEventListener('click', () => { nextSlide(); restartSlider(); });
$('prevSlide').addEventListener('click', () => { prevSlide(); restartSlider(); });

$('searchInput').addEventListener('input', e => {
  state.query = e.target.value;
  renderGrid();
});

async function init() {
  try {
    const response = await fetch('/api/novels', { cache: 'no-store' });
    if (!response.ok) throw new Error('Request failed');
    state.novels = await response.json();
    renderSlider();
    renderFilters();
    renderGrid();
    restartSlider();
  } catch (error) {
    $('heroSlider').innerHTML = `<div class="slider-fallback"><span>!</span><p>Unable to open the collection right now.</p></div>`;
    $('novelGrid').innerHTML = `<div class="loading">Please refresh the page to try again.</div>`;
  }
}

init();
