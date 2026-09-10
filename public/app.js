function setupMobileMenu() {

  const toggle = document.getElementById('mobileMenuToggle');
  const menu = document.getElementById('mobileMenu');

  if (!toggle || !menu) return;

  const closeMenu = () => {

    menu.classList.remove('open');

    toggle.setAttribute(
      'aria-expanded',
      'false'
    );

    menu.setAttribute(
      'aria-hidden',
      'true'
    );

  };


  toggle.addEventListener('click', () => {

    const open =
      menu.classList.toggle('open');

    toggle.setAttribute(
      'aria-expanded',
      String(open)
    );

    menu.setAttribute(
      'aria-hidden',
      String(!open)
    );

  });


  menu
    .querySelectorAll('a')
    .forEach(link => {

      link.addEventListener(
        'click',
        closeMenu
      );

    });

}


let allNovels = [];

let selectedGenre = 'ALL';

let selectedStatus = 'ALL';

let coverTimer = null;



async function loadNovels() {

  const grid =
    document.getElementById('novelGrid');

  const track =
    document.getElementById('featuredTrack');


  try {

    const res =
      await fetch(
        '/api/novels',
        {
          cache: 'no-store'
        }
      );


    if (!res.ok) {

      throw new Error(
        'Unable to load novels'
      );

    }


    allNovels =
      await res.json();


    buildGenreButtons();

    buildStatusButtons();

    setupSearch();

    showFeaturedCovers();

    renderNovels();


  } catch (error) {

    if (grid) {

      grid.innerHTML = `
        <div class="loading empty-state">

          <div class="empty-star">
            !
          </div>

          <h3>
            The library is resting.
          </h3>

          <p>
            Please refresh the page and try again.
          </p>

        </div>
      `;

    }


    if (track) {

      track.innerHTML = `
        <div class="featured-empty">
          Please refresh to open the collection.
        </div>
      `;

    }

  }

}



/* =========================================
   GENRE FILTER
========================================= */

function buildGenreButtons() {

  const box =
    document.getElementById(
      'genreButtons'
    );


  if (!box) return;


  const genres = [
    ...new Set(

      allNovels

        .flatMap(n =>
          Array.isArray(n.genres)
            ? n.genres
            : []
        )

        .map(g =>
          String(g).trim()
        )

        .filter(Boolean)

    )
  ]
  .sort(
    (a, b) =>
      a.localeCompare(b)
  );


  box.innerHTML = `

    <button
      class="genre-btn active"
      type="button"
      data-genre="ALL"
    >
      ALL
    </button>

    ${genres.map(g => `

      <button
        class="genre-btn"
        type="button"
        data-genre="${esc(g)}"
      >
        ${esc(g)}
      </button>

    `).join('')}

  `;


  box
    .querySelectorAll('.genre-btn')
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          selectedGenre =
            button.dataset.genre;


          box
            .querySelectorAll('.genre-btn')
            .forEach(b =>
              b.classList.remove(
                'active'
              )
            );


          button.classList.add(
            'active'
          );


          renderNovels();

        }
      );

    });

}



/* =========================================
   STATUS FILTER
========================================= */

function buildStatusButtons() {

  const box =
    document.getElementById(
      'statusButtons'
    );


  if (!box) return;


  /*
    These are the status options
    shown in the public filter.

    Coming Soon has been added.
  */

  const preferred = [

    'Ongoing',

    'Coming Soon',

    'Completed',

    'Hiatus'

  ];


  const statuses = [
    ...new Set(

      allNovels

        .map(n =>
          String(
            n.status || ''
          ).trim()
        )

        .filter(Boolean)

    )
  ];


  const ordered = [

    ...preferred,

    ...statuses.filter(
      status =>

        !preferred.some(
          existing =>
            existing.toLowerCase() ===
            status.toLowerCase()
        )

    )

  ];


  box.innerHTML = `

    <button
      class="genre-btn active"
      type="button"
      data-status="ALL"
    >
      ALL
    </button>


    ${ordered.map(status => `

      <button
        class="genre-btn"
        type="button"
        data-status="${esc(status)}"
      >
        ${esc(status)}
      </button>

    `).join('')}

  `;


  box
    .querySelectorAll(
      '.genre-btn'
    )
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          selectedStatus =
            button.dataset.status;


          box
            .querySelectorAll(
              '.genre-btn'
            )
            .forEach(b =>
              b.classList.remove(
                'active'
              )
            );


          button.classList.add(
            'active'
          );


          renderNovels();

        }
      );

    });

}



/* =========================================
   SEARCH
========================================= */

function setupSearch() {

  const input =
    document.getElementById(
      'searchInput'
    );

  const button =
    document.getElementById(
      'searchBtn'
    );


  if (!input || !button) return;


  button.addEventListener(
    'click',
    renderNovels
  );


  input.addEventListener(
    'input',
    renderNovels
  );


  input.addEventListener(
    'keydown',
    event => {

      if (
        event.key === 'Enter'
      ) {

        event.preventDefault();

        renderNovels();

      }

    }
  );

}



/* =========================================
   RENDER NOVELS
========================================= */

function renderNovels() {

  const grid =
    document.getElementById(
      'novelGrid'
    );


  const count =
    document.getElementById(
      'resultCount'
    );


  const input =
    document.getElementById(
      'searchInput'
    );


  if (!grid) return;


  const query =
    input
      ? input.value
          .trim()
          .toLowerCase()
      : '';


  const filtered =
    allNovels.filter(n => {

      const genres =
        Array.isArray(n.genres)
          ? n.genres
          : [];


      const genreMatch =

        selectedGenre === 'ALL' ||

        genres.some(
          g =>
            String(g)
              .toLowerCase() ===
            selectedGenre
              .toLowerCase()
        );


      const searchable = [

        n.title || '',

        n.author || '',

        n.synopsis || '',

        ...genres

      ]
      .join(' ')
      .toLowerCase();


      const statusMatch =

        selectedStatus === 'ALL' ||

        String(
          n.status || ''
        )
        .toLowerCase() ===
        selectedStatus
          .toLowerCase();


      return (

        genreMatch &&

        statusMatch &&

        (
          !query ||
          searchable.includes(query)
        )

      );

    });


  if (count) {

    count.textContent =
      `${filtered.length} ${
        filtered.length === 1
          ? 'NOVEL'
          : 'NOVELS'
      } FOUND`;

  }


  if (!filtered.length) {

    grid.innerHTML = `

      <div class="loading empty-state">

        <div class="empty-star">
          ✦
        </div>

        <h3>
          No novels found.
        </h3>

        <p>
          Try another title, author or genre.
        </p>

      </div>

    `;

    return;

  }


  grid.innerHTML =

    filtered.map(
      (n, index) => {

        const genres =
          Array.isArray(n.genres)
            ? n.genres
            : [];


        return `

        <article
          class="card"
          style="--delay:${index * 70}ms"
        >

          <div class="cover-wrap">

            ${n.badge && ['HOT','NEW'].includes(String(n.badge).toUpperCase()) ? `
              <span class="novel-badge ${String(n.badge).toLowerCase()}">${esc(String(n.badge).toUpperCase())}</span>
            ` : ''}

            ${
              n.cover

                ? `

                  <img
                    class="cover"
                    src="${n.cover}"
                    alt="${esc(n.title)} cover"
                    loading="lazy"
                  >

                `

                : `

                  <div class="placeholder">

                    <span>
                      ✦
                    </span>

                  </div>

                `
            }

            <div class="cover-shine"></div>

          </div>


          <div class="card-body">


            <div class="card-meta">

              <span>
                ${esc(
                  n.status ||
                  'ONGOING'
                )}
              </span>

              <i>
                ✦
              </i>

            </div>


            <h3>
              ${esc(n.title)}
            </h3>


            <div class="author">

              ${esc(
                n.author ||
                'Original Author'
              )}

            </div>


            <div class="tags">

              ${genres.map(
                g => `

                  <span class="tag">
                    ${esc(g)}
                  </span>

                `
              ).join('')}

            </div>


            <p class="desc">

              ${esc(
                n.synopsis ||
                'A translated story waiting to be discovered.'
              )}

            </p>


            ${
              n.synopsis
                ? `
                  <button
                    class="synopsis-toggle"
                    type="button"
                    aria-label="Read full synopsis"
                    data-id="${n.id}"
                  >
                    <span>READ FULL SYNOPSIS</span>
                    <b>↓</b>
                  </button>
                `
                : ''
            }


            <a
              class="check"
              href="${esc(
                n.patreon_url || '#'
              )}"
              target="_blank"
              rel="noopener noreferrer"
            >

              <span>
                CHECK IT OUT
              </span>

              <b>
                ↗
              </b>

            </a>


          </div>

        </article>

        `;

      }
    )
    .join('');


  /* Horizontal full synopsis popup */
  grid.querySelectorAll('.synopsis-toggle').forEach(button => {
    button.addEventListener('click', () => {
      const novel = allNovels.find(n => String(n.id) === String(button.dataset.id));
      if (novel) openSynopsisModal(novel);
    });
  });

  requestAnimationFrame(
    () => {

      grid
        .querySelectorAll(
          '.card'
        )
        .forEach(card =>
          card.classList.add(
            'is-visible'
          )
        );

    }
  );

}



/* =========================================
   FEATURED COVER ANIMATION
========================================= */

function openSynopsisModal(n) {
  const modal = document.getElementById('synopsisModal');
  if (!modal) return;

  const cover = document.getElementById('synopsisModalCover');
  const badge = document.getElementById('synopsisModalBadge');
  const status = document.getElementById('synopsisModalStatus');
  const title = document.getElementById('synopsisModalTitle');
  const author = document.getElementById('synopsisModalAuthor');
  const tags = document.getElementById('synopsisModalTags');
  const synopsis = document.getElementById('synopsisModalText');
  const mainChapters = Number(n.main_chapters || 0);
  const extraChapters = Number(n.extra_chapters || 0);
  const chapterStatus = document.getElementById('synopsisChapterStatus');
  const check = document.getElementById('synopsisModalCheck');

  if (cover) {
    cover.src = n.cover || '';
    cover.alt = `${n.title || 'Novel'} cover`;
    cover.style.display = n.cover ? 'block' : 'none';
  }

  if (badge) {
    const value = String(n.badge || '').toUpperCase();
    badge.textContent = value;
    badge.className = `synopsis-modal-badge ${value ? value.toLowerCase() : ''}`;
    badge.hidden = !value;
  }

  if (status) status.textContent = String(n.status || 'Ongoing').toUpperCase();
  if (title) title.textContent = n.title || '';
  if (author) author.textContent = n.author || 'Original Author';
  if (tags) tags.innerHTML = (Array.isArray(n.genres) ? n.genres : []).map(g => `<span class="tag">${esc(g)}</span>`).join('');
  if (synopsis) synopsis.textContent = n.synopsis || 'A translated story waiting to be discovered.';

  if (chapterStatus) {
    if (mainChapters > 0 || extraChapters > 0) {
      chapterStatus.innerHTML = `
        <div class="chapter-status-title">CHAPTER STATUS</div>
        <div class="chapter-status-list">
          ${mainChapters > 0 ? `<span><b>Main Chapters</b><strong>${mainChapters}</strong></span>` : ''}
          ${extraChapters > 0 ? `<span><b>Extra Chapters</b><strong>${extraChapters}</strong></span>` : ''}
        </div>
      `;
      chapterStatus.classList.remove('coming-soon');
    } else {
      chapterStatus.innerHTML = `
        <div class="chapter-status-title">CHAPTER STATUS</div>
        <div class="chapter-coming">COMING SOON</div>
      `;
      chapterStatus.classList.add('coming-soon');
    }
  }

  if (check) check.href = n.patreon_url || '#';
  modal.hidden = false;
  document.body.classList.add('synopsis-open');
}

function closeSynopsisModal() {
  const modal = document.getElementById('synopsisModal');
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove('synopsis-open');
}

function showFeaturedCovers() {

  const track =
    document.getElementById(
      'featuredTrack'
    );


  if (!track) return;


  if (coverTimer) {

    clearInterval(
      coverTimer
    );

    coverTimer = null;

  }


  const featured =
    allNovels.filter(
      n => n.cover
    );


  if (!featured.length) {

    track.innerHTML = `

      <div
        class="featured-cover no-cover active"
      >

        <span class="no-cover-mark">
          ✦
        </span>

        <span>
          Your next story is waiting here.
        </span>

      </div>

    `;


    track.classList.add(
      'ready'
    );

    return;

  }


  /*
    Randomize featured novels
    every time homepage opens.
  */

  const shuffled =
    [...featured].sort(
      () => Math.random() - 0.5
    );


  track.innerHTML =

    shuffled.map(
      (n, index) => `

        <a
          class="featured-cover${
            index === 0
              ? ' active'
              : ''
          }"

          href="${esc(
            n.patreon_url || '#'
          )}"

          target="_blank"

          rel="noopener noreferrer"

          title="${esc(n.title)}"

          style="--cover-bg:url(${JSON.stringify(
            n.cover
          )})"
        >

          <img
            src="${n.cover}"
            alt="${esc(n.title)} cover"
          >

          <span class="featured-title">

            ${esc(n.title)}

          </span>

        </a>

      `
    )
    .join('');


  const slides =
    [
      ...track.querySelectorAll(
        '.featured-cover'
      )
    ];


  let current = 0;


  /*
    Change cover every 2 seconds.
  */

  if (slides.length > 1) {

    coverTimer =
      setInterval(
        () => {

          slides[current]
            .classList.remove(
              'active'
            );


          current =
            (
              current + 1
            ) %
            slides.length;


          slides[current]
            .classList.add(
              'active'
            );

        },
        2000
      );

  }


  track.classList.add(
    'ready'
  );

}



/* =========================================
   HTML ESCAPE
========================================= */

function esc(value = '') {

  return String(value)
    .replace(
      /[&<>'"]/g,
      character => ({

        '&': '&amp;',

        '<': '&lt;',

        '>': '&gt;',

        "'": '&#39;',

        '"': '&quot;'

      }[character])
    );

}



/* =========================================
   SYNOPSIS MODAL CONTROLS
========================================= */
document.querySelectorAll('[data-synopsis-close]').forEach(el => {
  el.addEventListener('click', closeSynopsisModal);
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeSynopsisModal();
});

/* =========================================
   START WEBSITE
========================================= */

setupMobileMenu();

loadNovels();
