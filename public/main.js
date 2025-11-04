
function qs(sel){return document.querySelector(sel)}
function openDelivery(){qs('#delivery-modal').classList.add('show')}
function closeDelivery(){qs('#delivery-modal').classList.remove('show')}

document.addEventListener('DOMContentLoaded', () => {
  const btnWhen = qs('#btn-when');
  const btnChange = qs('#btn-change-delivery');
  [btnWhen, btnChange].forEach(b => b && b.addEventListener('click', openDelivery));

  const closeBtn = qs('#close-delivery');
  closeBtn && closeBtn.addEventListener('click', closeDelivery);
  qs('#btn-done')?.addEventListener('click', closeDelivery);

  const sched = qs('#scheduler');
  qs('#open-scheduler')?.addEventListener('click', () => {
    sched.hidden = !sched.hidden;
  });

  qs('#btn-save-schedule')?.addEventListener('click', () => {
    const date = qs('#date-input')?.value || 'hoy';
    const slot = qs('#slot-input')?.value || '';
    qs('#delivery-mode').textContent = `Programado • ${date} • ${slot}`;
    alert('Entrega programada');
  });
});

function goSearch(e){
  e.preventDefault();
  const q = (qs('#address').value || '').trim();
  if(!q){ window.location.href='/'; return false; }
  fetch(`/api/search?q=${encodeURIComponent(q)}`)
    .then(r=>r.json())
    .then(list=>{
      if(list.length){ window.location.href=`/restaurant/${list[0].id}` }
      else alert('No se encontraron restaurantes para esa búsqueda');
    });
  return false;
}
