(() => {
  const LS_KEY = 'villani_hours_v2';
  const YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

  const HOLIDAYS = (() => {
    const map = {};
    for (const y of YEARS) {
      map[`${y}-01-01`] = 'Capodanno'; // Scritta più lunga
      map[`${y}-01-06`] = 'Epifania';
      map[`${y}-04-25`] = 'Liberaz.';
      map[`${y}-05-01`] = 'Lavoro';
      map[`${y}-06-02`] = 'Repubb.';
      map[`${y}-08-15`] = 'Ferragosto';
      map[`${y}-11-01`] = 'Ognissanti';
      map[`${y}-12-08`] = 'Immacolata';
      map[`${y}-12-25`] = 'Natale';
      map[`${y}-12-26`] = 'S. Stefano';
      map[`${y}-12-31`] = 'S. Silv.';
    }
    map['2024-03-31'] = 'Pasqua'; map['2024-04-01'] = 'Pasquetta';
    map['2025-04-20'] = 'Pasqua'; map['2025-04-21'] = 'Pasquetta';
    map['2026-04-05'] = 'Pasqua'; map['2026-04-06'] = 'Pasquetta';
    map['2027-03-28'] = 'Pasqua'; map['2027-03-29'] = 'Pasquetta';
    return map;
  })();

  const grid = document.getElementById('calendarGrid');
  const monthLabel = document.getElementById('monthLabel');
  const monthTotal = document.getElementById('monthTotal');
  const prevBtn = document.getElementById('prevMonth');
  const nextBtn = document.getElementById('nextMonth');

  // Modal
  const modal = document.getElementById('hoursModalOverlay');
  const modalTitle = document.getElementById('hoursModalTitle');
  const valEl = document.getElementById('hoursValue');
  const upBtn = document.getElementById('hoursUp');
  const downBtn = document.getElementById('hoursDown');
  const okBtn = document.getElementById('hoursOk');
  const cancelBtn = document.getElementById('hoursCancel');

  let state = {};
  let viewYear, viewMonth;
  let editingDate = null;

  function loadState(){
    try { state = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { state = {}; }
  }
  function saveState(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }
  const ymd = (y,m,d) => `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  const daysInMonth = (y,m) => new Date(y, m+1, 0).getDate();
  const firstDayIdx = (y,m) => (new Date(y,m,1).getDay() + 6) % 7;

  function render(){
    grid.innerHTML = '';
    const date = new Date(viewYear, viewMonth, 1);
    monthLabel.textContent = date.toLocaleString('it-IT', { month:'long', year:'numeric' });
    
    let tot = 0;
    const days = daysInMonth(viewYear, viewMonth);
    for(let d=1; d<=days; d++) tot += (state[ymd(viewYear,viewMonth,d)] || 0);
    monthTotal.textContent = `Totale: ${tot}h`;

    const lead = firstDayIdx(viewYear, viewMonth);

    // Empty start
    for(let i=0; i<lead; i++) {
      const el = document.createElement('div');
      el.className = 'cal-cell empty';
      grid.appendChild(el);
    }

    // Days
    for(let d=1; d<=days; d++){
      const dateStr = ymd(viewYear, viewMonth, d);
      const cell = document.createElement('div');
      cell.className = 'cal-cell';
      
      // Today check: SOLO classe al contenitore
      const t = new Date();
      if(t.getFullYear()===viewYear && t.getMonth()===viewMonth && t.getDate()===d){
        cell.classList.add('cal-today');
      }

      // Top Row (Number)
      const topRow = document.createElement('div');
      topRow.className = 'cal-toprow';
      const daySpan = document.createElement('div');
      daySpan.className = 'cal-day';
      daySpan.textContent = d;
      topRow.appendChild(daySpan);
      cell.appendChild(topRow);

      // Holiday
      if(HOLIDAYS[dateStr]){
        const badge = document.createElement('div');
        badge.className = 'cal-pill holiday';
        badge.textContent = HOLIDAYS[dateStr];
        cell.appendChild(badge);
      }

      // Hours
      const val = state[dateStr];
      if(val !== undefined && val > 0){
        const badge = document.createElement('div');
        badge.className = 'cal-pill hours';
        badge.textContent = val;
        cell.appendChild(badge);
      }

      // Gestione Click
      cell.onclick = () => onDayClick(dateStr);
      grid.appendChild(cell);
    }
  }

  // NUOVA LOGICA CLICK
  function onDayClick(dateStr){
    const val = state[dateStr];
    // Se è vuoto o 0 -> imposta 8 subito e salva
    if(!val || val === 0){
      state[dateStr] = 8;
      saveState();
      render();
    } else {
      // Se c'è già un valore -> apre modale
      openModal(dateStr, val);
    }
  }

  function openModal(dStr, val){
    editingDate = dStr;
    const [y,m,d] = dStr.split('-');
    modalTitle.textContent = `${d}/${m}`;
    valEl.textContent = val;
    modal.classList.remove('hidden');
  }

  function closeModal(){
    modal.classList.add('hidden');
    editingDate = null;
  }

  // Eventi Modale
  upBtn.onclick = () => { valEl.textContent = Number(valEl.textContent)+1; };
  downBtn.onclick = () => { valEl.textContent = Math.max(0, Number(valEl.textContent)-1); };
  
  okBtn.onclick = () => {
    if(!editingDate) return;
    const v = Number(valEl.textContent);
    if(v > 0) state[editingDate] = v;
    else delete state[editingDate];
    saveState();
    render();
    closeModal();
  };
  cancelBtn.onclick = closeModal;
  modal.onclick = (e) => { if(e.target===modal) closeModal(); };

  prevBtn.onclick = () => {
    viewMonth--; 
    if(viewMonth<0){ viewMonth=11; viewYear--; }
    render();
  };
  nextBtn.onclick = () => {
    viewMonth++;
    if(viewMonth>11){ viewMonth=0; viewYear++; }
    render();
  };

  loadState();
  const now = new Date();
  viewYear = now.getFullYear();
  viewMonth = now.getMonth();
  render();
})();