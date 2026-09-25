// —— LUMID TRACK — track.js ——
// Requires: supabase-config.js loaded before this file.

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
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
    msgEl.style.display = 'block';
    return;
  }

  renderProject(data);
  // Make the results section visible smoothly
  resultEl.classList.add('visible'); 
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

  // —— 1. RENDERING MILESTONES ——
  const milestonesCard = document.getElementById('trackMilestonesCard');
  const milestonesList = document.getElementById('trackMilestonesList');
  
  if (p.milestones && Array.isArray(p.milestones) && p.milestones.length > 0) {
    milestonesList.innerHTML = p.milestones.map(m => `
      <div class="milestone-item ${m.completed ? 'completed' : ''}">
        <span class="milestone-status">${m.completed ? '✓' : '○'}</span>
        <div class="milestone-text">
          <strong>${m.title}</strong>
          ${m.date ? `<small>\${formatDate(m.date)}</small>` : ''}
        </div>
      </div>
    `).join('');
    milestonesCard.style.display = 'block';
  } else {
    milestonesCard.style.display = 'none';
  }

  // —— 2. RENDERING PROGRESS PHOTOS ——
  const photosCard = document.getElementById('trackPhotosCard');
  const photosGrid = document.getElementById('trackPhotosGrid');
  
  // Assumes photos are stored in your DB column as an array of file paths or public URLs
  if (p.photos && Array.isArray(p.photos) && p.photos.length > 0) {
    photosGrid.innerHTML = p.photos.map(photoPath => {
      let imageUrl = photoPath;

      // If the admin panel saves paths like 'folder/image.jpg' instead of full URLs, 
      // convert them to Supabase public storage links:
      if (!photoPath.startsWith('http://') && !photoPath.startsWith('https://')) {
        const { data } = supabaseClient.storage
          .from('project_photos') // ⚠️ CHANGE THIS to your exact Supabase bucket name
          .getPublicUrl(photoPath);
        imageUrl = data.publicUrl;
      }

      return `
        <div class="track-photo-item">
          <img src="${imageUrl}" alt="Project Progress Photo" loading="lazy" />
        </div>
      `;
    }).join('');
    photosCard.style.display = 'block';
  } else {
    photosCard.style.display = 'none';
  }
}
