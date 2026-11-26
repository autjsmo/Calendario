(() => {
  const LS_KEY = 'villani_hours_v2';
  const ENTRY_TYPES = { HOURS: 'hours', FERIE: 'ferie', PERMESSO: 'permesso' };

  // Calcolo dinamico di Pasqua e Pasquetta (algoritmo di Butcher-Meeus) per qualsiasi anno
  function getEasterDates(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=Marzo, 4=Aprile
    const day = ((h + l - 7 * m + 114) % 31) + 1;

    const easter = new Date(year, month - 1, day);
    const pasquetta = new Date(year, month - 1, day + 1);
    const fmt = (dt) =>
      `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    return { pasqua: fmt(easter), pasquetta: fmt(pasquetta) };
  }

  const holidayCache = {};
  function getHolidayName(dateStr) {
    const year = Number(dateStr.slice(0, 4));
    if (!holidayCache[year]) {
      const map = {
        [`${year}-01-01`]: 'Capodanno',
        [`${year}-01-06`]: 'Epifania',
        [`${year}-04-25`]: 'Liberazione',
        [`${year}-05-01`]: 'Festa Lavoro',
        [`${year}-06-02`]: 'Repubblica',
        [`${year}-08-15`]: 'Ferragosto',
        [`${year}-11-01`]: 'Ognissanti',
        [`${year}-12-08`]: 'Immacolata',
        [`${year}-12-25`]: 'Natale',
        [`${year}-12-26`]: 'S. Stefano',
        [`${year}-12-31`]: 'S. Silvestro'
      };
      const { pasqua, pasquetta } = getEasterDates(year);
      map[pasqua] = 'Pasqua';
      map[pasquetta] = 'Pasquetta';
      holidayCache[year] = map;
    }
    return holidayCache[year][dateStr] || null;
  }

  const grid = document.getElementById('calendarGrid');
  const monthLabel = document.getElementById('monthLabel');
  const monthTotal = document.getElementById('monthTotal');
  const monthDays = document.getElementById('monthDays');
  const monthFerie = document.getElementById('monthFerie');
  const monthPermessi = document.getElementById('monthPermessi');
  const prevBtn = document.getElementById('prevMonth');
  const nextBtn = document.getElementById('nextMonth');
  const todayBtn = document.getElementById('todayBtn');
  const toastEl = document.getElementById('toast');

  // Modal
  const modal = document.getElementById('hoursModalOverlay');
  const modalTitle = document.getElementById('hoursModalTitle');
  const valEl = document.getElementById('hoursValue');
  const upBtn = document.getElementById('hoursUp');
  const downBtn = document.getElementById('hoursDown');
  const okBtn = document.getElementById('hoursOk');
  const cancelBtn = document.getElementById('hoursCancel');
  const deleteBtn = document.getElementById('hoursDelete');
  const hoursControlsWrap = document.getElementById('hoursControlsWrap');
  const quickPresets = document.getElementById('quickPresets');

  // Tipologia
  const typeRadios = document.getElementById('entryTypeGroup');
  const typeInputs = {
    [ENTRY_TYPES.HOURS]: document.getElementById('typeHours'),
    [ENTRY_TYPES.FERIE]: document.getElementById('typeFerie'),
    [ENTRY_TYPES.PERMESSO]: document.getElementById('typePermesso')
  };
  const hasTypeUI = !!typeRadios;

  let state = {};
  let viewYear, viewMonth;
  let editingDate = null;
  let toastTimer = null;

  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('show');
    }, 1800);
  }

  function loadState() {
    try {
      state = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    } catch {
      state = {};
    }
  }

  function saveState() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch (err) {
      console.error('Errore salvataggio:', err);
    }
  }

  const ymd = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const firstDayIdx = (y, m) => (new Date(y, m, 1).getDay() + 6) % 7;

  function normalizeEntry(raw) {
    if (raw === undefined || raw === null) return null;
    if (typeof raw === 'number') return { kind: ENTRY_TYPES.HOURS, value: raw };
    if (typeof raw === 'object') {
      if (raw.kind === ENTRY_TYPES.HOURS) return { kind: ENTRY_TYPES.HOURS, value: Number(raw.value) || 0 };
      if (raw.kind === ENTRY_TYPES.FERIE) return { kind: ENTRY_TYPES.FERIE, value: 0 };
      if (raw.kind === ENTRY_TYPES.PERMESSO) return { kind: ENTRY_TYPES.PERMESSO, value: 0 };
    }
    return null;
  }

  function setEntry(dateStr, entry) {
    if (entry) state[dateStr] = entry;
    else delete state[dateStr];
    saveState();
  }

  function render(animateGrid = false) {
    grid.innerHTML = '';
    const date = new Date(viewYear, viewMonth, 1);
    monthLabel.textContent = date.toLocaleString('it-IT', { month: 'long', year: 'numeric' });

    const now = new Date();
    const isCurrentMonth = now.getFullYear() === viewYear && now.getMonth() === viewMonth;
    if (todayBtn) {
      todayBtn.classList.toggle('hidden', isCurrentMonth);
    }

    let totHours = 0;
    let workDays = 0;
    let ferieDays = 0;
    let permessiDays = 0;

    const days = daysInMonth(viewYear, viewMonth);
    for (let d = 1; d <= days; d++) {
      const e = normalizeEntry(state[ymd(viewYear, viewMonth, d)]);
      if (!e) continue;
      if (e.kind === ENTRY_TYPES.HOURS && e.value > 0) {
        totHours += e.value;
        workDays++;
      } else if (e.kind === ENTRY_TYPES.FERIE) {
        ferieDays++;
      } else if (e.kind === ENTRY_TYPES.PERMESSO) {
        permessiDays++;
      }
    }

    monthTotal.textContent = `${totHours}h`;
    if (monthDays) monthDays.textContent = String(workDays);
    if (monthFerie) monthFerie.textContent = String(ferieDays);
    if (monthPermessi) monthPermessi.textContent = String(permessiDays);

    const lead = firstDayIdx(viewYear, viewMonth);
    for (let i = 0; i < lead; i++) {
      const el = document.createElement('div');
      el.className = 'cal-cell empty';
      grid.appendChild(el);
    }

    for (let d = 1; d <= days; d++) {
      const dateStr = ymd(viewYear, viewMonth, d);
      const cell = document.createElement('div');
      cell.className = 'cal-cell';

      const dayOfWeek = (lead + d - 1) % 7; // 0=Lun ... 5=Sab, 6=Dom
      if (dayOfWeek >= 5) {
        cell.classList.add('weekend');
      }

      if (animateGrid) {
        cell.style.animationDelay = `${Math.min(d * 8, 180)}ms`;
      } else {
        cell.style.animation = 'none';
      }

      if (isCurrentMonth && now.getDate() === d) {
        cell.classList.add('cal-today');
      }

      const topRow = document.createElement('div');
      topRow.className = 'cal-toprow';
      const daySpan = document.createElement('div');
      daySpan.className = 'cal-day';
      daySpan.textContent = d;
      topRow.appendChild(daySpan);
      cell.appendChild(topRow);

      const holidayName = getHolidayName(dateStr);
      if (holidayName) {
        cell.classList.add('is-holiday');
        const badge = document.createElement('div');
        badge.className = 'cal-pill holiday';
        badge.textContent = holidayName;
        cell.appendChild(badge);
      }

      const entry = normalizeEntry(state[dateStr]);
      if (entry) {
        const badge = document.createElement('div');
        badge.classList.add('cal-pill');
        switch (entry.kind) {
          case ENTRY_TYPES.HOURS:
            badge.classList.add('hours');
            badge.textContent = `${entry.value}h`;
            break;
          case ENTRY_TYPES.FERIE:
            badge.classList.add('ferie');
            badge.textContent = 'Ferie';
            break;
          case ENTRY_TYPES.PERMESSO:
            badge.classList.add('permesso');
            badge.textContent = 'Permesso';
            break;
        }
        cell.appendChild(badge);
      }

      attachDayHandlers(cell, dateStr);
      grid.appendChild(cell);
    }
  }

  function onDayClick(dateStr) {
    const entry = normalizeEntry(state[dateStr]);
    if (!entry) {
      setEntry(dateStr, { kind: ENTRY_TYPES.HOURS, value: 8 });
      navigator.vibrate?.(15);
      render(false);
    } else {
      openModal(dateStr, entry);
    }
  }

  // Pressione prolungata: azzera la cella
  function onDayLongPress(dateStr) {
    if (!state[dateStr]) return;
    setEntry(dateStr, null);
    navigator.vibrate?.(35);
    render(false);
    showToast('Giorno azzerato');
  }

  // Gestione pointer sicura anche durante lo scroll mobile
  function attachDayHandlers(cell, dateStr) {
    let timer = null;
    let longDone = false;
    let startX = 0;
    let startY = 0;
    let moved = false;

    const clearTimer = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      cell.classList.remove('pressing');
    };

    const start = (e) => {
      if (e.button && e.button !== 0) return;
      longDone = false;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      if (state[dateStr]) {
        cell.classList.add('pressing');
      }
      timer = setTimeout(() => {
        longDone = true;
        cell.classList.remove('pressing');
        onDayLongPress(dateStr);
      }, 500);
    };

    const move = (e) => {
      if (!timer) return;
      if (Math.abs(e.clientX - startX) > 10 || Math.abs(e.clientY - startY) > 10) {
        moved = true;
        clearTimer();
      }
    };

    const end = () => {
      const wasActive = !!timer || longDone;
      clearTimer();
      if (wasActive && !longDone && !moved) {
        onDayClick(dateStr);
      }
    };

    cell.addEventListener('pointerdown', start);
    cell.addEventListener('pointermove', move);
    cell.addEventListener('pointerup', end);
    cell.addEventListener('pointerleave', clearTimer);
    cell.addEventListener('pointercancel', clearTimer);
    cell.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function syncPresetsUI() {
    if (!quickPresets) return;
    const currentVal = Number(valEl.textContent);
    const kind = getSelectedKind();
    for (const btn of quickPresets.querySelectorAll('.preset-btn')) {
      const h = Number(btn.dataset.hours);
      btn.classList.toggle('active', kind === ENTRY_TYPES.HOURS && h === currentVal);
    }
  }

  function openModal(dStr, entry) {
    editingDate = dStr;
    const [y, m, d] = dStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    modalTitle.textContent = dt.toLocaleDateString('it-IT', {
      weekday: 'short',
      day: 'numeric',
      month: 'long'
    });

    if (hasTypeUI) {
      const kind = entry?.kind || ENTRY_TYPES.HOURS;
      if (typeInputs[kind]) typeInputs[kind].checked = true;
      syncChipsUI();

      if (kind === ENTRY_TYPES.HOURS) {
        valEl.textContent = entry?.value ?? 8;
        enableHours(true);
      } else {
        valEl.textContent = 0;
        enableHours(false);
      }
    } else {
      valEl.textContent = entry?.value ?? 8;
      enableHours(true);
    }

    syncPresetsUI();
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    editingDate = null;
  }

  function enableHours(enabled) {
    valEl.classList.toggle('disabled', !enabled);
    hoursControlsWrap?.classList.toggle('disabled-wrap', !enabled);
    if (upBtn) upBtn.disabled = !enabled;
    if (downBtn) downBtn.disabled = !enabled;
  }

  function getSelectedKind() {
    if (!hasTypeUI) return ENTRY_TYPES.HOURS;
    if (typeInputs[ENTRY_TYPES.FERIE]?.checked) return ENTRY_TYPES.FERIE;
    if (typeInputs[ENTRY_TYPES.PERMESSO]?.checked) return ENTRY_TYPES.PERMESSO;
    return ENTRY_TYPES.HOURS;
  }

  function syncChipsUI() {
    if (!hasTypeUI) return;
    for (const lab of typeRadios.querySelectorAll('.type-chip')) {
      const input = lab.querySelector('input');
      lab.classList.toggle('active', input?.checked);
    }
  }

  upBtn?.addEventListener('click', () => {
    valEl.textContent = Math.min(24, Number(valEl.textContent) + 1);
    syncPresetsUI();
  });

  downBtn?.addEventListener('click', () => {
    valEl.textContent = Math.max(0, Number(valEl.textContent) - 1);
    syncPresetsUI();
  });

  quickPresets?.addEventListener('click', (e) => {
    const btn = e.target.closest('.preset-btn');
    if (!btn) return;
    valEl.textContent = btn.dataset.hours;
    syncPresetsUI();
  });

  if (hasTypeUI) {
    typeRadios.addEventListener('change', () => {
      syncChipsUI();
      const kind = getSelectedKind();
      if (kind === ENTRY_TYPES.HOURS) {
        enableHours(true);
        if (Number(valEl.textContent) === 0) valEl.textContent = 8;
      } else {
        enableHours(false);
        valEl.textContent = 0;
      }
      syncPresetsUI();
    });
  }

  okBtn?.addEventListener('click', () => {
    if (!editingDate) return;
    const kind = getSelectedKind();
    if (kind === ENTRY_TYPES.HOURS) {
      const v = Number(valEl.textContent);
      if (v > 0) setEntry(editingDate, { kind: ENTRY_TYPES.HOURS, value: v });
      else setEntry(editingDate, null);
    } else if (kind === ENTRY_TYPES.FERIE) {
      setEntry(editingDate, { kind: ENTRY_TYPES.FERIE, value: 0 });
    } else {
      setEntry(editingDate, { kind: ENTRY_TYPES.PERMESSO, value: 0 });
    }
    render(false);
    closeModal();
  });

  deleteBtn?.addEventListener('click', () => {
    if (!editingDate) return;
    setEntry(editingDate, null);
    render(false);
    closeModal();
    showToast('Giorno azzerato');
  });

  cancelBtn?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeModal();
    }
  });

  prevBtn.onclick = () => {
    viewMonth--;
    if (viewMonth < 0) {
      viewMonth = 11;
      viewYear--;
    }
    render(true);
  };

  nextBtn.onclick = () => {
    viewMonth++;
    if (viewMonth > 11) {
      viewMonth = 0;
      viewYear++;
    }
    render(true);
  };

  todayBtn?.addEventListener('click', () => {
    const t = new Date();
    viewYear = t.getFullYear();
    viewMonth = t.getMonth();
    render(true);
  });

  loadState();
  const now = new Date();
  viewYear = now.getFullYear();
  viewMonth = now.getMonth();
  render(true);
})();
