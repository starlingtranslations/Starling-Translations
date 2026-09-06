let allNovels = [];
let selectedGenre = 'ALL';
let coverTimer = null;

async function loadNovels(){
  const grid = document.getElementById('novelGrid');
  const track = document.getElementById('featuredTrack');

  try{
    const res = await fetch('/api/novels', {cache:'no-store'});
    if(!res.ok) throw new Error('Unable to load novels');

    allNovels = await res.json();

    buildGenreButtons();
    setupSearch();
    showFeaturedCovers();
    renderNovels();
  }catch(error){
    grid.innerHTML = '<div class="loading empty-state"><div class="empty-star">!</div><h3>The library is resting.</h3><p>Please refresh the page and try again.</p></div>';
    track.innerHTML = '<div class="featured-empty">Please refresh to open the collection.</div>';
  }
}

function buildGenreButtons(){
  const box = document.getElementById('genreButtons');

  const genres = [...new Set(
    allNovels
      .flatMap(n => Array.isArray(n.genres) ? n.genres : [])
      .map(g => String(g).trim())
      .filter(Boolean)
  )].sort((a,b) => a.localeCompare(b));

  box.innerHTML = `
    <button class="genre-btn active" type="button" data-genre="ALL">ALL</button>
    ${genres.map(g => `
      <button class="genre-btn" type="button" data-genre="${esc(g)}">${esc(g)}</button>
    `).join('')}
  `;

  box.querySelectorAll('.genre-btn').forEach(button => {
    button.addEventListener('click', () => {
      selectedGenre = button.dataset.genre;
      box.querySelectorAll('.genre-btn').forEach(b => b.classList.remove('active'));
      button.classList.add('active');
      renderNovels();
    });
  });
}

function setupSearch(){
  const input = document.getElementById('searchInput');
  const button = document.getElementById('searchBtn');

  button.addEventListener('click', renderNovels);

  input.addEventListener('input', renderNovels);

  input.addEventListener('keydown', event => {
    if(event.key === 'Enter'){
      event.preventDefault();
      renderNovels();
    }
  });
}

function renderNovels(){
  const grid = document.getElementById('novelGrid');
  const count = document.getElementById('resultCount');
  const input = document.getElementById('searchInput');
  const query = input ? input.value.trim().toLowerCase() : '';

  const filtered = allNovels.filter(n => {
    const genres = Array.isArray(n.genres) ? n.genres : [];

    const genreMatch =
      selectedGenre === 'ALL' ||
      genres.some(g => String(g).toLowerCase() === selectedGenre.toLowerCase());

    const searchable = [
      n.title || '',
      n.author || '',
      n.synopsis || '',
      ...genres
    ].join(' ').toLowerCase();

    return genreMatch && (!query || searchable.includes(query));
  });

  count.textContent = `${filtered.length} ${filtered.length === 1 ? 'NOVEL' : 'NOVELS'} FOUND`;

  if(!filtered.length){
    grid.innerHTML = `
      <div class="loading empty-state">
        <div class="empty-star">✦</div>
        <h3>No novels found.</h3>
        <p>Try another title, author or genre.</p>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map((n,index) => {
    const genres = Array.isArray(n.genres) ? n.genres : [];

    return `<article class="card" style="--delay:${index * 70}ms">
      <div class="cover-wrap">
        ${n.cover
          ? `<img class="cover" src="${n.cover}" alt="${esc(n.title)} cover" loading="lazy">`
          : '<div class="placeholder"><span>✦</span></div>'}
        <div class="cover-shine"></div>
        <div class="cover-badge">STARLING</div>
      </div>

      <div class="card-body">
        <div class="card-meta">
          <span>${esc(n.status || 'ONGOING')}</span>
          <i>✦</i>
        </div>

        <h3>${esc(n.title)}</h3>
        <div class="author">${esc(n.author || 'Original Author')}</div>

        <div class="tags">
          ${genres.map(g => `<span class="tag">${esc(g)}</span>`).join('')}
        </div>

        <p class="desc">${esc(n.synopsis || 'A translated story waiting to be discovered.')}</p>

        <a class="check" href="${esc(n.patreon_url || '#')}" target="_blank" rel="noopener noreferrer">
          <span>CHECK IT OUT</span><b>↗</b>
        </a>
      </div>
    </article>`;
  }).join('');

  requestAnimationFrame(() => {
    grid.querySelectorAll('.card').forEach(card => card.classList.add('is-visible'));
  });
}

function showFeaturedCovers(){
  const track = document.getElementById('featuredTrack');

  if(coverTimer){
    clearInterval(coverTimer);
    coverTimer = null;
  }

  const featured = allNovels.filter(n => n.cover);

  if(!featured.length){
    track.innerHTML = `
      <div class="featured-cover no-cover active">
        <span class="no-cover-mark">✦</span>
        <span>Your next story is waiting here.</span>
      </div>`;
    track.classList.add('ready');
    return;
  }

  // Random order each time the homepage is opened.
  const shuffled = [...featured].sort(() => Math.random() - 0.5);

  track.innerHTML = shuffled.map((n,index) => `
    <a class="featured-cover${index === 0 ? ' active' : ''}"
       href="${esc(n.patreon_url || '#')}"
       target="_blank"
       rel="noopener noreferrer"
       title="${esc(n.title)}">
      <img src="${n.cover}" alt="${esc(n.title)} cover">
      <span>${esc(n.title)}</span>
    </a>
  `).join('');

  const slides = [...track.querySelectorAll('.featured-cover')];
  let current = 0;

  if(slides.length > 1){
    coverTimer = setInterval(() => {
      slides[current].classList.remove('active');
      current = (current + 1) % slides.length;
      slides[current].classList.add('active');
    }, 2000);
  }

  track.classList.add('ready');
}

function esc(value=''){
  return String(value).replace(/[&<>'"]/g, character => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    "'":'&#39;',
    '"':'&quot;'
  }[character]));
}

loadNovels();
