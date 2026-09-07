let currentHeroIndex = 0;

function showHeroNovel(index) {
  if (!heroNovels.length || !heroCover) return;

  currentHeroIndex =
    (index + heroNovels.length) % heroNovels.length;

  const novel = heroNovels[currentHeroIndex];

  heroCover.classList.add("is-changing");

  setTimeout(() => {
    heroCover.src = novel.cover;

    if (heroFeatured) {
      heroFeatured.style.setProperty(
        "--hero-cover",
        `url("${novel.cover}")`
      );
    }

    if (heroTitle) {
      heroTitle.textContent = novel.title;
    }

    if (heroDescription) {
      heroDescription.textContent = novel.description || "";
    }

    if (heroCover) {
      heroCover.classList.remove("is-changing");
    }
  }, 350);
}

setInterval(() => {
  showHeroNovel(currentHeroIndex + 1);
}, 2000);
