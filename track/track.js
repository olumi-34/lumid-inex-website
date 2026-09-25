// ── LUMID TRACK — track.js ──────────────────────────────────
const SUPABASE_URL      = 'https://njtzfttguugurrkyhshp.supabase.co';
const SUPABASE_ANON_KEY = 'PASTE_YOUR_REAL_ANON_KEY_HERE';
const supabaseClient    = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── NAV ──────────────────────────────────────────────────────
window.addEventListener('scroll', () => {
  const scrollY  = window.scrollY;
  const docH     = document.documentElement.scrollHeight - window.innerHeight;
  const bar      = document.getElementById('scroll-progress');
  const nav      = document.getElementById('nav');
  if (bar) bar.style.width = (docH > 0 ? (scrollY / docH) * 100 : 0) + '%';
  if (nav) nav.classList.toggle('scrolled', scrollY > 80);
}, { passive: true });

function toggleMenu() {
  const menu     = document.getElementById('mobileMenu');
  const btn      = document.getElementById('hamburger');
  const backdrop = document.getElementById('navBackdrop');
  const isOpen   = menu.classList.toggle('open');
  btn.classList.toggle('open', isOpen);
  btn.setAttribute('aria-expanded', isOpen);
  if (backdrop) backdrop.classList.toggle('open', isOpen);
  document.body.style.overflow = isOpen ? 'hidden' : '';
}

// ── PROJECT LOOKUP ────────────────────────────────────────────
async function lookupProject() {
  const input   = document.getElementById('trackIdInput');
  const btn     = document.getElementById('trackBtn');
  const errorEl = document.getElementById('trackError');
  const results = document.getElementById('trackResults');

  const projectId = input.value.trim().toUpperCase();
  if (!projectId) { showError('Please enter your Project ID.'); return; }

  btn.disabled        = true;
  btn.textContent     = 'Searching…';
  errorEl.style.display = 'none';
  results.classList.remove('visible');

  const { data, error } = await supabaseClient
    .from('projects')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_visible', true)
    .single();

  btn.disabled    = false;
  btn.textContent = 'Track Project';

  if (error || !data) {
    showError(
      'We couldn\'t find a project with that ID. ' +
      'Double-check it and try again, or message us on WhatsApp for help.'
    );
    return;
  }

  renderProject(data);
}

function showError(msg) {
  const el = document.getElementById('trackError');
  el.textContent    = msg;
  el.style.display  = 'block';
}

// ── RENDER PROJECT ────────────────────────────────────────────
function renderProject(p) {
  // header
  document.getElementById('resultProjectId').textContent   = p.project_id;
  document.getElementById('resultProjectName').textContent = p.client_name + ' — ' + (p.project_type || 'Project');
  document.getElementById('resultType').textContent        = p.project_type || '—';
  document.getElementById('resultLocation').textContent    = p.location     || '—';
  document.getElementById('resultStart').textContent       = p.start_date   ? formatDate(p.start_date)    : '—';
  document.getElementById('resultEnd').textContent         = p.estimated_end? formatDate(p.estimated_end) : '—';

  // whatsapp
  const waText = encodeURIComponent(
    `Hi Lumid! I'm checking in on my project: ${p.project_id} — ${p.client_name}\n\nCould you give me an update? Thank you!`
  );
  document.getElementById('resultWaBtn').href = `https://wa.me/2349038807214?text=${waText}`;

  // progress
  const pct = p.completion_pct || 0;
  document.getElementById('resultPct').textContent   = pct + '%';
  document.getElementById('resultStage').textContent = p.current_stage || 'Not yet started';
  document.getElementById('resultNotes').textContent = p.notes || 'No notes from the team yet.';

  const updated = p.updated_at || p.created_at;
  document.getElementById('resultUpdated').textContent = updated
    ? 'Last updated: ' + new Date(updated).toLocaleString('en-NG', { dateStyle:'medium', timeStyle:'short' })
    : '';

  // not started
  document.getElementById('notStartedNotice').style.display = pct === 0 ? 'block' : 'none';

  // animate bar
  setTimeout(() => {
    document.getElementById('progressFill').style.width = pct + '%';
  }, 300);

  // milestones
  const milestones = Array.isArray(p.milestones) ? p.milestones : [];
  const mlEl = document.getElementById('milestoneList');
  mlEl.innerHTML = milestones.length === 0
    ? '<p class="milestone-empty">Milestones will appear here as your project progresses.</p>'
    : milestones.map(m => `
        <div class="milestone-item">
          <div class="milestone-dot ${m.status}"></div>
          <div class="milestone-body">
            <div class="milestone-name ${m.status === 'pending' ? 'pending' : ''}">${m.name}</div>
            ${m.date ? `<div class="milestone-date">
              ${m.status === 'done' ? '✓ Completed' : m.status === 'active' ? '🔨 In progress' : '⏳ Upcoming'}
              — ${formatDate(m.date)}
            </div>` : ''}
          </div>
        </div>`).join('');

  // ── FIX: handle both legacy string arrays and new {url, uploaded_at} objects ──
  const rawPhotos = Array.isArray(p.photos) ? p.photos : [];
  const rawVideos = Array.isArray(p.videos) ? p.videos : [];

  const photos = rawPhotos.map(item =>
    typeof item === 'string' ? { url: item, uploaded_at: null } : item
  );
  const videos = rawVideos.map(item =>
    typeof item === 'string' ? { url: item, uploaded_at: null } : item
  );

  // photos grid
  const pgEl = document.getElementById('photosGrid');
  if (photos.length === 0 && videos.length === 0) {
    pgEl.innerHTML = '<p class="photos-empty">No progress photos yet. Our team will upload photos as work progresses.</p>';
  } else {
    // group by date for timeline view
    const allMedia = [
      ...photos.map(p => ({ ...p, mediaType: 'image' })),
      ...videos.map(v => ({ ...v, mediaType: 'video' }))
    ].sort((a, b) => {
      if (!a.uploaded_at) return 1;
      if (!b.uploaded_at) return -1;
      return new Date(b.uploaded_at) - new Date(a.uploaded_at);
    });

    // group by day
    const groups = {};
    allMedia.forEach(item => {
      const day = item.uploaded_at
        ? new Date(item.uploaded_at).toLocaleDateString('en-NG', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
        : 'Earlier updates';
      if (!groups[day]) groups[day] = [];
      groups[day].push(item);
    });

    pgEl.innerHTML = Object.entries(groups).map(([day, items]) => `
      <div style="grid-column:1/-1">
        <div style="font-size:0.7rem;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;
                    color:var(--dim-grey);padding:0.6rem 0;border-bottom:1px solid var(--warm-grey);
                    margin-bottom:0.8rem">${day}</div>
      </div>
      ${items.map(item => item.mediaType === 'image'
        ? `<div class="photo-item" onclick="openPhotoLb('${escUrl(item.url)}')">
             <img src="${item.url}" alt="Project progress photo" loading="lazy"/>
           </div>`
        : `<div class="photo-item video-item" onclick="openVideoLb('${escUrl(item.url)}')">
             <div style="width:100%;height:100%;background:#111;display:flex;flex-direction:column;
                         align-items:center;justify-content:center;gap:6px;color:white">
               <span style="font-size:2rem">▶️</span>
               <span style="font-size:0.68rem;letter-spacing:0.06em;text-transform:uppercase;opacity:0.6">Video</span>
             </div>
           </div>`
      ).join('')}
    `).join('');
  }

  document.getElementById('trackResults').classList.add('visible');
  document.getElementById('trackResults').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── SAFE URL for onclick attributes ──────────────────────────
function escUrl(url) {
  return url.replace(/'/g, '%27').replace(/"/g, '%22');
}

// ── PHOTO LIGHTBOX ────────────────────────────────────────────
function openPhotoLb(src) {
  document.getElementById('lbPhotoImg').src = src;
  document.getElementById('photoLightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}

// ── VIDEO LIGHTBOX ────────────────────────────────────────────
function openVideoLb(src) {
  let lb = document.getElementById('videoLightbox');
  if (!lb) {
    lb = document.createElement('div');
    lb.id = 'videoLightbox';
    lb.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(14,14,14,0.96);z-index:400;align-items:center;justify-content:center';
    lb.innerHTML = `
      <div style="max-width:860px;width:90vw;position:relative">
        <button onclick="closeVideoLb()"
          style="position:absolute;top:-2.8rem;right:0;color:rgba(255,255,255,0.6);font-size:0.8rem;
                 letter-spacing:0.1em;background:none;border:none;cursor:pointer">✕ Close</button>
        <video id="lbVideo" controls style="width:100%;border-radius:4px;max-height:80vh">
          Your browser does not support video.
        </video>
      </div>`;
    lb.onclick = e => { if (e.target === lb) closeVideoLb(); };
    document.body.appendChild(lb);
  }
  document.getElementById('lbVideo').src = src;
  lb.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeVideoLb() {
  const lb = document.getElementById('videoLightbox');
  if (!lb) return;
  lb.style.display = 'none';
  const v = document.getElementById('lbVideo');
  if (v) { v.pause(); v.src = ''; }
  document.body.style.overflow = '';
}

function closePhotoLb() {
  document.getElementById('photoLightbox').classList.remove('open');
  document.body.style.overflow = '';
}
function closeLb(e) {
  if (e.target === document.getElementById('photoLightbox')) closePhotoLb();
}

// ── UTILS ─────────────────────────────────────────────────────
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-NG', { day:'numeric', month:'short', year:'numeric' });
}

// ── ENTER KEY ─────────────────────────────────────────────────
document.getElementById('trackIdInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') lookupProject();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closePhotoLb(); closeVideoLb(); }
});

// ── AUTO-LOOKUP FROM URL PARAM ────────────────────────────────
const urlParams = new URLSearchParams(window.location.search);
const autoId    = urlParams.get('id');
if (autoId) {
  document.getElementById('trackIdInput').value = autoId;
  lookupProject();
}

// ── SCROLL REVEAL ─────────────────────────────────────────────
const io = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }});
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));