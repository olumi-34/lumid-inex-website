// ── LUMID TRACK — track.js ──────────────────────────────────
// Requires: supabase-config.js loaded before this file.

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function lookupProject(e) {
  if (e) e.preventDefault();

  const idInput = document.getElementById('trackIdInput');
  const btn = document.getElementById('trackLookupBtn');
  const msgEl = document.getElementById('trackMsg');
  const resultEl = document.getElementById('trackResult');

  const projectId = idInput.value.trim().toUpperCase();
  if (!projectId) return;

  msgEl.style.display = 'none';
  resultEl.classList.remove('visible');
  btn.disabled = true;
  btn.textContent = 'Searching…';

  const { data, error } = await supabaseClient
    .from('projects')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_visible', true)
    .single();

  btn.disabled = false;
  btn.textContent = 'Track Project';

  if (error || !data) {
    msgEl.textContent = "We couldn't find a project with that ID. Double-check it and try again, or message us on WhatsApp for help.";
    msgEl.className = 'track-msg error';
    return;
  }

  renderProject(data);
}

function renderProject(p) {
  document.getElementById('trackProjectId').textContent = p.project_id;
  document.getElementById('trackClientName').textContent = p.client_name;
  document.getElementById('trackProjectMeta').innerHTML = [
    p.project_type,
    p.location,
    p.start_date ? `Started ${formatDate(p.start_date)}` : '',
    p.estimated_end ? `Est. completion ${formatDate(p.estimated_end)}` : ''
  ].filter(Boolean).join('<br/>');

  document.getElementById('trackProgressPct').textContent = `${p.completion_pct || 0}%`;
  document.getElementById('trackProgressFill').style.width = `${p.completion_pct || 0}%`;

  const stageEl = document.getElementById('trackCurrentStage');
  if (p.current_stage) {
    stageEl.innerHTML = `<strong>Current stage:</strong> ${p.current_stage}`;
    stageEl.style.display = 'block';
  } else {
    stageEl.style.display = 'none';
  }

  const notesEl = document.getElementById('trackNotes');
  if (p.notes) {
    notesEl.textContent = p.notes;
    notesEl.style.display = 'block';
  } else {
    notesEl.style.display = 'none';
  }

  // Milestones
  const milestonesCard = document.getElementById('trackMilestonesCard');
  const milestonesList = document.getElementById('trackMilestonesList');
  if (p.milestones && Array.isArray(p.milestones) && p.milestones.length) {
    milestonesList.innerHTML = p.milestones.map(m => `
      <div class="milestone-row">
        <div class="milestone-dot ${m.status || 'pending'}"></div>
        <div class="milestone-info">
          <div class="milestone-name">${m.name}</div>
          ${m.date ? `<div class="milestone-date">${formatDate(m.date)}</div>` : ''}
        </div>
        <span class="milestone-status-label ${m.status || 'pending'}">${(m.status || 'pending').replace('_',' ')}</span>
      </div>
    `).join('');
    milestonesCard.style.display = 'block';
  } else {
    milestonesCard.style.display = 'none';
  }

  // Photos
  const photosCard = document.getElementById('trackPhotosCard');
  const photosGrid = document.getElementById('trackPhotosGrid');
  if (p.photos && p.photos.length) {
    photosGrid.innerHTML = p.photos.map(url => `<img src="${url}" alt="Project progress photo" onclick="window.open('${url}', '_blank')"/>`).join('');
    photosCard.style.display = 'block';
  } else {
    photosCard.style.display = 'none';
  }

  document.getElementById('trackResult').classList.add('visible');
  document.getElementById('trackResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── AUTO-LOOKUP FROM URL (?id=LMD-2025-0001) ────────────────
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const idParam = params.get('id');
  if (idParam) {
    document.getElementById('trackIdInput').value = idParam;
    lookupProject();
  }
});
