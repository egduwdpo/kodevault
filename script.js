/* =========================================================
   KodeVault — versi Supabase
   Snippet disimpan di Postgres (Supabase) supaya link share
   bisa dibuka dari device mana pun, bukan cuma browser sendiri.
   Login admin pakai Supabase Auth (email + password beneran).
   Status "sudah bayar" masih simulasi lokal (localStorage) —
   integrasi payment gateway asli belum ada di versi ini.
   ========================================================= */

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const UNLOCKED_KEY = 'kodevault_unlocked_v1';

function getUnlocked(){
  try{ return JSON.parse(localStorage.getItem(UNLOCKED_KEY)) || []; }catch(e){ return []; }
}
function addUnlocked(id){
  const list = getUnlocked();
  if(!list.includes(id)){ list.push(id); localStorage.setItem(UNLOCKED_KEY, JSON.stringify(list)); }
}

/* ---------------- Toast ---------------- */
let toastTimer;
function showToast(msg){
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> el.classList.add('hidden'), 2400);
}

/* ---------------- Auth state ---------------- */
let currentSession = null;

async function refreshSession(){
  const { data } = await supabase.auth.getSession();
  currentSession = data.session;
  return currentSession;
}

function refreshNav(){
  const isAdmin = !!currentSession;
  document.getElementById('nav-admin-only').classList.toggle('hidden', !isAdmin);
  document.getElementById('nav-guest-only').classList.toggle('hidden', isAdmin);
}

supabase.auth.onAuthStateChange((_event, session)=>{
  currentSession = session;
  refreshNav();
});

/* ---------------- Router ---------------- */
const app = document.getElementById('app');

async function route(){
  const hash = location.hash || '#/';
  await refreshSession();
  refreshNav();

  if(hash === '#/login'){
    if(currentSession){ location.hash = '#/admin'; return; }
    return renderLogin();
  }
  if(hash === '#/admin'){
    if(!currentSession){ location.hash = '#/login'; return; }
    return renderAdmin();
  }
  if(hash.startsWith('#/s/')){
    const id = hash.slice(4);
    return renderDetail(id);
  }
  return renderBrowse();
}
window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', route);

/* ---------------- Login screen ---------------- */
function renderLogin(){
  app.innerHTML = '';
  app.appendChild(document.getElementById('tpl-login').content.cloneNode(true));
  const form = document.getElementById('login-form');
  const err = document.getElementById('login-error');
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    err.classList.add('hidden');
    const email = document.getElementById('login-user').value.trim();
    const pass = document.getElementById('login-pass').value;
    const submitBtn = form.querySelector('button[type=submit]');
    submitBtn.disabled = true;
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    submitBtn.disabled = false;
    if(error){
      err.textContent = 'akses ditolak — ' + (error.message || 'email / pass salah');
      err.classList.remove('hidden');
      return;
    }
    showToast('berhasil masuk sebagai admin');
    location.hash = '#/admin';
  });
}

document.addEventListener('click', async (e)=>{
  if(e.target.closest('#btn-logout')){
    await supabase.auth.signOut();
    showToast('sudah keluar');
    location.hash = '#/';
    route();
  }
});

/* ---------------- Admin dashboard ---------------- */
function renderAdmin(){
  app.innerHTML = '';
  app.appendChild(document.getElementById('tpl-admin').content.cloneNode(true));

  const form = document.getElementById('snippet-form');
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const submitBtn = form.querySelector('button[type=submit]');
    submitBtn.disabled = true;

    const payload = {
      title: document.getElementById('f-title').value.trim(),
      language: document.getElementById('f-lang').value,
      description: document.getElementById('f-desc').value.trim(),
      price: Number(document.getElementById('f-price').value) || 0,
      code: document.getElementById('f-code').value
    };

    const { error } = await supabase.from('snippets').insert(payload);
    submitBtn.disabled = false;

    if(error){
      showToast('gagal simpan: ' + error.message);
      return;
    }
    form.reset();
    document.getElementById('f-price').value = 5000;
    showToast('cuplikan diterbitkan');
    renderAdminList();
  });

  renderAdminList();
}

async function renderAdminList(){
  const wrap = document.getElementById('admin-list');
  const countEl = document.getElementById('admin-count');
  if(!wrap) return;
  wrap.innerHTML = '<p class="empty-state" style="padding:20px 0;">memuat...</p>';

  const { data: snippets, error } = await supabase
    .from('snippets')
    .select('*')
    .order('created_at', { ascending: false });

  if(error){
    wrap.innerHTML = `<p class="empty-state" style="padding:20px 0;">gagal memuat: ${escapeHTML(error.message)}</p>`;
    return;
  }

  countEl.textContent = snippets.length;
  wrap.innerHTML = '';

  if(snippets.length === 0){
    wrap.innerHTML = '<p class="empty-state" style="padding:20px 0;">belum ada cuplikan.</p>';
    return;
  }

  snippets.forEach(s=>{
    const item = document.createElement('div');
    item.className = 'admin-item';
    item.innerHTML = `
      <div class="admin-item-main">
        <span class="admin-item-title">${escapeHTML(s.title)}</span>
        <span class="admin-item-meta">${escapeHTML(s.language)} · Rp ${Number(s.price).toLocaleString('id-ID')}</span>
      </div>
      <div class="admin-item-actions">
        <button class="icon-btn" data-view="${s.id}" title="lihat">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M2 12C4 7 8 4.5 12 4.5S20 7 22 12C20 17 16 19.5 12 19.5S4 17 2 12Z" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="1.6"/></svg>
        </button>
        <button class="icon-btn" data-copylink="${s.id}" title="salin tautan">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="6" cy="12" r="2.2" stroke="currentColor" stroke-width="1.5"/><circle cx="18" cy="6" r="2.2" stroke="currentColor" stroke-width="1.5"/><circle cx="18" cy="18" r="2.2" stroke="currentColor" stroke-width="1.5"/><path d="M8 10.8L16 7.2M8 13.2L16 16.8" stroke="currentColor" stroke-width="1.5"/></svg>
        </button>
        <button class="icon-btn danger" data-del="${s.id}" title="hapus">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 7H20" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" stroke-width="1.6"/><path d="M6 7L7 19a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2L18 7" stroke="currentColor" stroke-width="1.6"/></svg>
        </button>
      </div>`;
    wrap.appendChild(item);
  });

  wrap.querySelectorAll('[data-view]').forEach(b=> b.addEventListener('click', ()=>{
    location.hash = '#/s/' + b.dataset.view;
  }));
  wrap.querySelectorAll('[data-copylink]').forEach(b=> b.addEventListener('click', ()=>{
    const url = location.origin + location.pathname + '#/s/' + b.dataset.copylink;
    copyToClipboard(url);
    showToast('tautan disalin');
  }));
  wrap.querySelectorAll('[data-del]').forEach(b=> b.addEventListener('click', async ()=>{
    if(!confirm('Hapus cuplikan ini?')) return;
    const { error } = await supabase.from('snippets').delete().eq('id', b.dataset.del);
    if(error){ showToast('gagal hapus: ' + error.message); return; }
    renderAdminList();
    showToast('cuplikan dihapus');
  }));
}

/* ---------------- Browse (public gallery) ---------------- */
async function renderBrowse(){
  app.innerHTML = '';
  app.appendChild(document.getElementById('tpl-browse').content.cloneNode(true));
  const grid = document.getElementById('browse-grid');
  const empty = document.getElementById('browse-empty');
  grid.innerHTML = '<p class="empty-state">memuat brankas...</p>';

  const { data: snippets, error } = await supabase
    .from('snippets')
    .select('*')
    .order('created_at', { ascending: false });

  grid.innerHTML = '';

  if(error){
    empty.textContent = 'gagal memuat brankas: ' + error.message;
    empty.classList.remove('hidden');
    return;
  }

  if(!snippets || snippets.length === 0){
    empty.classList.remove('hidden');
    return;
  }

  snippets.forEach(s=>{
    const card = document.createElement('a');
    card.href = '#/s/' + s.id;
    card.className = 'card';
    card.innerHTML = `
      <span class="lang-badge">${escapeHTML(s.language)}</span>
      <h3 class="card-title">${escapeHTML(s.title)}</h3>
      <p class="card-desc">${escapeHTML(s.description)}</p>
      <div class="card-foot">
        <span>${timeAgo(s.created_at)}</span>
        <span class="card-price">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="1.8"/></svg>
          Rp ${Number(s.price).toLocaleString('id-ID')}
        </span>
      </div>`;
    grid.appendChild(card);
  });
}

/* ---------------- Detail + paywall ---------------- */
let activeSnippetId = null;
let activeSnippet = null;

async function renderDetail(id){
  app.innerHTML = '<section class="screen"><p class="empty-state">memuat cuplikan...</p></section>';

  const { data: snippet, error } = await supabase
    .from('snippets')
    .select('*')
    .eq('id', id)
    .single();

  app.innerHTML = '';

  if(error || !snippet){
    app.innerHTML = `<section class="screen"><p class="empty-state">Cuplikan tidak ditemukan. Mungkin sudah dihapus admin.</p></section>`;
    return;
  }

  activeSnippetId = id;
  activeSnippet = snippet;
  app.appendChild(document.getElementById('tpl-detail').content.cloneNode(true));

  document.getElementById('d-lang').textContent = snippet.language;
  document.getElementById('d-title').textContent = snippet.title;
  document.getElementById('d-desc').textContent = snippet.description;
  document.getElementById('d-filename').textContent = slugify(snippet.title) + extFor(snippet.language);
  document.getElementById('d-code').textContent = snippet.code;
  document.getElementById('lock-price').textContent = 'Rp ' + Number(snippet.price).toLocaleString('id-ID');
  document.getElementById('pay-amount').textContent = Number(snippet.price).toLocaleString('id-ID');

  const shareUrl = location.origin + location.pathname + '#/s/' + snippet.id;
  document.getElementById('share-url').value = shareUrl;

  const unlocked = getUnlocked().includes(id);
  applyLockState(unlocked);

  document.getElementById('btn-unlock')?.addEventListener('click', openPayModal);
  document.getElementById('btn-share').addEventListener('click', ()=>{
    copyToClipboard(shareUrl);
    showToast('tautan disalin');
  });
  document.getElementById('btn-copy')?.addEventListener('click', ()=>{
    copyToClipboard(snippet.code);
    showToast('kode disalin');
  });
  document.getElementById('btn-download')?.addEventListener('click', ()=>{
    downloadText(slugify(snippet.title) + extFor(snippet.language), snippet.code);
    showToast('file diunduh');
  });
}

function applyLockState(unlocked){
  const codeEl = document.getElementById('d-code');
  const overlay = document.getElementById('lock-overlay');
  const actions = document.getElementById('unlocked-actions');
  if(unlocked){
    codeEl.classList.remove('blurred');
    overlay.classList.add('hidden');
    actions.classList.remove('hidden');
  } else {
    codeEl.classList.add('blurred');
    overlay.classList.remove('hidden');
    actions.classList.add('hidden');
  }
}

/* ---------------- Payment modal (simulasi) ---------------- */
const payModal = document.getElementById('pay-modal');

function openPayModal(){
  payModal.classList.remove('hidden');
}
function closePayModal(){
  payModal.classList.add('hidden');
}
document.getElementById('pay-close').addEventListener('click', closePayModal);
payModal.addEventListener('click', (e)=>{ if(e.target === payModal) closePayModal(); });

document.getElementById('pay-confirm').addEventListener('click', ()=>{
  if(!activeSnippetId) return;
  addUnlocked(activeSnippetId);
  closePayModal();
  applyLockState(true);
  showToast('akses terbuka — selamat menikmati kodenya');
});

/* ---------------- Utils ---------------- */
function escapeHTML(str=''){
  return String(str).replace(/[&<>"']/g, m=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function slugify(str=''){
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || 'snippet';
}

function extFor(lang=''){
  const map = {
    javascript:'.js', typescript:'.ts', python:'.py', php:'.php', java:'.java',
    'c++':'.cpp', 'c#':'.cs', go:'.go', rust:'.rs', kotlin:'.kt', swift:'.swift',
    ruby:'.rb', sql:'.sql', 'html/css':'.html', bash:'.sh'
  };
  return map[lang.toLowerCase()] || '.txt';
}

function timeAgo(tsStr){
  const ts = new Date(tsStr).getTime();
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.floor(diff/60000);
  if(min < 1) return 'baru saja';
  if(min < 60) return `${min} menit lalu`;
  const hr = Math.floor(min/60);
  if(hr < 24) return `${hr} jam lalu`;
  return `${Math.floor(hr/24)} hari lalu`;
}

function copyToClipboard(text){
  if(navigator.clipboard?.writeText){
    navigator.clipboard.writeText(text).catch(()=> fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}
function fallbackCopy(text){
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
}

function downloadText(filename, content){
  const blob = new Blob([content], {type:'text/plain'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}