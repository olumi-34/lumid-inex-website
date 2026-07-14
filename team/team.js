// Team page specific — nav scroll
window.addEventListener('scroll', () => {
  const nav = document.getElementById('nav');
  if (nav) nav.classList.toggle('scrolled', window.scrollY > 60);
  const bar = document.getElementById('scroll-progress');
  const docH = document.documentElement.scrollHeight - window.innerHeight;
  if (bar && docH > 0) bar.style.width = (window.scrollY / docH * 100) + '%';
}, { passive: true });

// scroll reveal
const io = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));