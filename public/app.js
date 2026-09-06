async function loadNovels(){
  const grid=document.getElementById('novelGrid');
  try{
    const res=await fetch('/api/novels',{cache:'no-store'});
    if(!res.ok) throw new Error('Unable to load novels');
    const novels=await res.json();
    if(!novels.length){
      grid.innerHTML='<div class="loading empty-state"><div class="empty-star">✦</div><h3>The library is waiting.</h3><p>New translated stories will appear here soon.</p></div>';
      return;
    }
    grid.innerHTML=novels.map((n,index)=>{
      const genres=Array.isArray(n.genres)?n.genres:[];
      return `<article class="card" style="--delay:${index*70}ms">
        <div class="cover-wrap">
          ${n.cover?`<img class="cover" src="${n.cover}" alt="${esc(n.title)} cover" loading="lazy">`:'<div class="placeholder"><span>✦</span></div>'}
          <div class="cover-shine"></div>
          <div class="cover-badge">STARLING</div>
        </div>
        <div class="card-body">
          <div class="card-meta"><span>${esc(n.status||'ONGOING')}</span><i>✦</i></div>
          <h3>${esc(n.title)}</h3>
          <div class="author">${esc(n.author||'Original Author')}</div>
          <div class="tags">${genres.map(g=>`<span class="tag">${esc(g)}</span>`).join('')}</div>
          <p class="desc">${esc(n.synopsis||'A translated story waiting to be discovered.')}</p>
          <a class="check" href="${esc(n.patreon_url)}" target="_blank" rel="noopener noreferrer"><span>CHECK IT OUT</span><b>↗</b></a>
        </div>
      </article>`;
    }).join('');
    requestAnimationFrame(()=>document.querySelectorAll('.card').forEach(card=>card.classList.add('is-visible')));
  }catch(e){
    grid.innerHTML='<div class="loading empty-state"><div class="empty-star">!</div><h3>The library is resting.</h3><p>Please refresh the page and try again.</p></div>';
  }
}
function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
loadNovels();
