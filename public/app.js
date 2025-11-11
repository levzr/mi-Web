document.addEventListener('click', (e) => {
  const q = e.target.closest('[data-copy]');
  if(!q) return;
  navigator.clipboard.writeText(q.dataset.copy);
  q.innerText = 'Copiado ✓';
  setTimeout(()=> q.innerText = q.dataset.label || 'Copiar', 1200);
});
