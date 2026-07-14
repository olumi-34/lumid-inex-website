// my javascript for lumid inex

// ── NAV SCROLL ─────────────────────────────────────────────
/*window.addEventListener('scroll', () => {
  document.getElementById('nav').classList.toggle('scrolled', window.scrollY > 40);
}); */

// ── MOBILE MENU ────────────────────────────────────────────
// ── MOBILE MENU ────────────────────────────────────────────
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
// ── HERO BACKGROUND UPLOAD ─────────────────────────────────
function loadHeroBg(input) {
  if (!input.files || !input.files[0]) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const bg  = document.getElementById('heroBg');
    const img = document.getElementById('heroBgImg');
    img.src = e.target.result;
    bg.classList.add('loaded');
  };
  reader.readAsDataURL(input.files[0]);
}

// ── NAV SCROLL + PROGRESS BAR ──────────────────────────────
/*window.addEventListener('scroll', () => {
  const scrollY   = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress  = docHeight > 0 ? (scrollY / docHeight) * 100 : 0;

  // progress bar fill
  document.getElementById('scroll-progress').style.width = progress + '%';

  // nav background — switches when user scrolls past full viewport height
  const heroHeight = window.innerHeight;
  document.getElementById('nav').classList.toggle('scrolled', scrollY >= heroHeight);
}); */


// ── NAV SCROLL + PROGRESS BAR ──────────────────────────────
window.addEventListener('scroll', () => {
  const scrollY    = window.scrollY;
  const docHeight  = document.documentElement.scrollHeight - window.innerHeight;
  const progress   = docHeight > 0 ? (scrollY / docHeight) * 100 : 0;
  const bar        = document.getElementById('scroll-progress');
  const nav        = document.getElementById('nav');

  if (bar) bar.style.width = progress + '%';
  if (nav) nav.classList.toggle('scrolled', scrollY >= window.innerHeight);
}, { passive: true });


// ── HERO SLIDESHOW (videos + images) ───────────────────────
(function () {
  const slides = document.querySelectorAll('.hero-slide');
  if (!slides.length) return;

  let current = 0;
  let timer = null;

  function goToSlide(next) {
    // fade out current
    slides[current].classList.remove('active');

    // pause any playing video on the slide leaving
    const leavingVideo = slides[current].querySelector('video');
    if (leavingVideo) {
      leavingVideo.pause();
    }

    // move index
    current = next % slides.length;

    // fade in next slide
    slides[current].classList.add('active');

    // if next slide is a video, restart and play it
    const enteringVideo = slides[current].querySelector('video');
    if (enteringVideo) {
      enteringVideo.currentTime = 0;
      enteringVideo.play().catch(() => {});
    }
  }

  function getDelay(slideEl) {
    // videos show for their duration (capped at 12s), images show for 4s
    const video = slideEl.querySelector('video');
    if (video && video.duration && !isNaN(video.duration)) {
      return Math.min(video.duration * 1000, 12000);
    }
    return 4000;
  }

  function scheduleNext() {
    clearTimeout(timer);
    const delay = getDelay(slides[current]);
    timer = setTimeout(() => {
      goToSlide(current + 1);
      scheduleNext();
    }, delay);
  }

  // start the first video playing immediately
  const firstVideo = slides[0].querySelector('video');
  if (firstVideo) {
    firstVideo.play().catch(() => {});
  }

  scheduleNext();
})();

// ── GENERIC FILE INPUT TRIGGER ─────────────────────────────
function triggerUpload(inputId) {
  document.getElementById(inputId).click();
}

// ── ABOUT / GENERAL IMAGE SLOTS ────────────────────────────
function loadSlotImg(input, displayId) {
  if (!input.files || !input.files[0]) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const container = document.getElementById(displayId);
    container.innerHTML = '';
    const img = document.createElement('img');
    img.src = e.target.result;
    img.alt = 'Uploaded project photo';
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
    container.appendChild(img);
    container.style.padding = '0';
  };
  reader.readAsDataURL(input.files[0]);
}

// ── PORTFOLIO IMAGE UPLOAD ──────────────────────────────────
function loadPortfolioImg(input, displayId, portfolioItem) {
  if (!input.files || !input.files[0]) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const slot = document.getElementById(displayId);
    // Replace placeholder div with img element inside the slot
    slot.classList.remove('p-placeholder');
    slot.innerHTML = `<img src="${e.target.result}" alt="Project photo" style="width:100%;height:100%;object-fit:cover;display:block;"/>`;
    // Clicking the item now opens lightbox (not the upload)
    portfolioItem.onclick = () => openLightbox(e.target.result, portfolioItem);
  };
  reader.readAsDataURL(input.files[0]);
}

// ── LIGHTBOX ───────────────────────────────────────────────
function openLightbox(srcOrEvent, item) {
  let src, caption;
  if (typeof srcOrEvent === 'string') {
    // Called after upload
    src = srcOrEvent;
    const title = item.querySelector('.p-title');
    const loc   = item.querySelector('.p-loc');
    caption = [title?.textContent, loc?.textContent].filter(Boolean).join(' — ');
  } else {
    // Called from static click (placeholder not yet uploaded)
    const img = srcOrEvent.currentTarget
      ? srcOrEvent.currentTarget.querySelector('img')
      : srcOrEvent.querySelector('img');
    if (!img) return; // no image yet — nothing to show
    src = img.src;
    const t = srcOrEvent.currentTarget
      ? srcOrEvent.currentTarget.querySelector('.p-title')
      : srcOrEvent.querySelector('.p-title');
    const l = srcOrEvent.currentTarget
      ? srcOrEvent.currentTarget.querySelector('.p-loc')
      : srcOrEvent.querySelector('.p-loc');
    caption = [t?.textContent, l?.textContent].filter(Boolean).join(' — ');
  }
  document.getElementById('lbImg').src = src;
  document.getElementById('lbCaption').textContent = caption || '';
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
  document.body.style.overflow = '';
}

// Close lightbox on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeLightbox();
    if (document.getElementById('mobileMenu').classList.contains('open')) toggleMenu();
  }
});

// ── PORTFOLIO FILTER ────────────────────────────────────────
function filterPortfolio(cat, btn) {
  // Update active tab
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');

  // Show/hide items
  document.querySelectorAll('#portfolioGrid .portfolio-item').forEach(item => {
    const itemCat = item.dataset.cat || '';
    const show = cat === 'all' || itemCat === cat;
    item.style.display = show ? '' : 'none';
    // Trigger a small re-flow so hidden items don't leave gaps
    item.style.opacity  = show ? '1' : '0';
    item.style.transform = show ? 'scale(1)' : 'scale(0.97)';
    item.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
  });
}

// ── CONTACT FORM ────────────────────────────────────────────
function submitForm() {
  const fname   = document.getElementById('fname').value.trim();
  const phone   = document.getElementById('phone').value.trim();
  const service = document.getElementById('service').value;

  if (!fname) {
    alert('Please enter your first name.');
    document.getElementById('fname').focus();
    return;
  }
  if (!phone) {
    alert('Please enter your phone number so we can reach you.');
    document.getElementById('phone').focus();
    return;
  }

  // Build a WhatsApp pre-fill message
  const lname   = document.getElementById('lname').value.trim();
  const email   = document.getElementById('email').value.trim();
  const budget  = document.getElementById('budget').value;
  const message = document.getElementById('message').value.trim();

  const waText = encodeURIComponent(
    `Hi Lumid! I'd like to book a consultation.\n\n` +
    `Name: ${fname} ${lname}\n` +
    `Phone: ${phone}\n` +
    (email   ? `Email: ${email}\n`   : '') +
    (service ? `Service: ${service}\n` : '') +
    (budget  ? `Budget: ${budget}\n`  : '') +
    (message ? `\nAbout my space:\n${message}` : '')
  );

  // Show success state
  document.getElementById('formSuccess').style.display = 'block';

  // Open WhatsApp after short delay
  setTimeout(() => {
    window.open(`https://wa.me/2349038807214?text=${waText}`, '_blank');
  }, 600);
}

// ── SCROLL REVEAL ───────────────────────────────────────────
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ── PORTFOLIO ITEM CLICK (delegate for dynamic content) ────
document.getElementById('portfolioGrid').addEventListener('click', (e) => {
  const item = e.target.closest('.portfolio-item');
  if (!item) return;

  // Don't open lightbox if clicking on a placeholder upload trigger
  if (e.target.closest('.p-placeholder')) return;

  const img = item.querySelector('img');
  if (!img) return;

  const title   = item.querySelector('.p-title')?.textContent || '';
  const loc     = item.querySelector('.p-loc')?.textContent   || '';
  const caption = [title, loc].filter(Boolean).join(' — ');

  document.getElementById('lbImg').src = img.src;
  document.getElementById('lbCaption').textContent = caption;
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
});

