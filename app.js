(() => {
  const LS_KEY = 'villani_hours_v2';
  const YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

  const HOLIDAYS = (() => {
    const map = {};
    for (const y of YEARS) {
      map[`${y}-01-01`] = 'Capodanno';
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

  // Long press timing
  const LONG_PRESS_MS = 600;

  function showModal(date, initial = 8){
    editingDate = date;
    modal.classList.remove('hidden');
    valEl.textContent = String(initial);
  }
  function hideModal(){
    editingDate = null;
    modal.classList.add('hidden');
  }

  upBtn?.addEventListener('click', () => {
    const v = Math.min(24, Number(valEl.textContent) + 1);
    valEl.textContent = String(v);
  });
  downBtn?.addEventListener('click', () => {
    const v = Math.max(0, Number(valEl.textContent) - 1);
    valEl.textContent = String(v);
  });
  okBtn?.addEventListener('click', () => {
    if (!editingDate) return hideModal();
    const v = Number(valEl.textContent);
    if (Number.isFinite(v) && v > 0) {
      state[editingDate] = v;
    } else {
      delete state[editingDate];
    }
    saveState();
    hideModal();
    render();
  });
  cancelBtn?.addEventListener('click', () => {
    hideModal();
  });

  function handleClick(date) {
    const val = state[date];
    if (typeof val === 'number') {
      // edit existing numeric hours
      showModal(date, val);
    } else {
      // empty or special -> set 8 hours
      state[date] = 8;
      saveState();
      render();
    }
  }

  function handleLongPressCycle(date) {
    const current = state[date];
    // cycle: undefined -> 'ferie' -> 'permes' -> undefined
    if (current === undefined) {
      state[date] = 'ferie';
    } else if (current === 'ferie') {
      state[date] = 'permes';
    } else {
      // if numeric or 'permes' -> clear
      delete state[date];
    }
    saveState();
    render();
  }

  function createCell(elDate, dayNum, isEmpty=false) {
    const cell = document.createElement('div');
    cell.className = 'cal-cell';
    if (isEmpty) cell.classList.add('empty');

    cell.dataset.date = elDate;

    const top = document.createElement('div');
    top.className = 'cell-daynum';
    top.textContent = dayNum ? String(dayNum) : '';
    const content = document.createElement('div');
    content.className = 'cell-content';

    const dateLabel = document.createElement('div');
    dateLabel.className = 'cell-label';
    dateLabel.appendChild(top);
    dateLabel.appendChild(content);
    cell.appendChild(dateLabel);

    const val = state[elDate];

    if (val === 'ferie') {
      content.textContent = 'Ferie';
      cell.classList.add('vacation');
    } else if (val === 'permes') {
      content.textContent = 'Permes.';
      cell.classList.add('perm');
    } else if (typeof val === 'number') {
      content.textContent = `${val} h`;
      cell.classList.add('hours');
    } else {
      content.textContent = '';
    }

    // pointer-based longpress handling (works for mouse/touch)
    let pressTimer = null;
    let longPressed = false;

    const startPress = (ev) => {
      ev.preventDefault?.();
      longPressed = false;
      pressTimer = setTimeout(() => {
        longPressed = true;
        handleLongPressCycle(elDate);
      }, LONG_PRESS_MS);
    };
    const cancelPress = (ev) => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
      if (!longPressed) {
        handleClick(elDate);
      }
    };

    // support pointer events if available
    cell.addEventListener('pointerdown', startPress);
    cell.addEventListener('pointerup', cancelPress);
    cell.addEventListener('pointercancel', cancelPress);
    // also fallback for touch/mouse (in case pointer not supported)
    cell.addEventListener('touchstart', startPress);
    cell.addEventListener('touchend', cancelPress);
    cell.addEventListener('mousedown', startPress);
    cell.addEventListener('mouseup', cancelPress);

    // prevent context menu on long press
    cell.addEventListener('contextmenu', (e) => e.preventDefault());

    return cell;
  }

  function render(){
    grid.innerHTML = '';
    const date = new Date(viewYear, viewMonth, 1);
    monthLabel.textContent = date.toLocaleString('it-IT', { month:'long', year:'numeric' });

    let tot = 0;
    const days = daysInMonth(viewYear, viewMonth);
    const startOffset = firstDayIdx(viewYear, viewMonth);

    // leading empty cells
    for (let i=0;i<startOffset;i++){
      const d = document.createElement('div');
      d.className = 'cal-cell empty';
      grid.appendChild(d);
    }

    for (let d=1; d<=days; d++){
      const key = ymd(viewYear, viewMonth, d);
      const cell = createCell(key, d, false);
      const v = state[key];
      if (typeof v === 'number') tot += v;
      // holiday label, today marker etc. (keep possible existing decorations)
      if (HOLIDAYS[key]) {
        const badge = document.createElement('div');
        badge.className = 'holiday-badge';
        badge.textContent = HOLIDAYS[key];
        cell.appendChild(badge);
      }
      grid.appendChild(cell);
    }

    monthTotal.textContent = `${tot} h`;
  }

  function gotoMonth(y,m){
    viewYear = y; viewMonth = m;
    render();
  }

  prevBtn?.addEventListener('click', () => {
    if (viewMonth === 0) { viewMonth = 11; viewYear -= 1; }
    else viewMonth -= 1;
    render();
  });
  nextBtn?.addEventListener('click', () => {
    if (viewMonth === 11) { viewMonth = 0; viewYear += 1; }
    else viewMonth += 1;
    render();
  });

  // init
  loadState();
  const now = new Date();
  viewYear = now.getFullYear();
  viewMonth = now.getMonth();
  render();

})();
