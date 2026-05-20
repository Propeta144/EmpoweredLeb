/* ═══════════════════════════════════════════════════════
   CALENDAR
═══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── Config ─────────────────────────────────────────
  const API_URL    = 'src/calendar_bookings.php'; // adjust to your path
  const TIME_HOURS  = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  const TIME_LABELS = ['8 AM','9 AM','10 AM','11 AM','12 PM','1 PM','2 PM','3 PM','4 PM','5 PM','6 PM'];

  // Maps slot_id (DB) → hour the slot starts
function getHourFromSlot(slotLabel) {
  if (!slotLabel) return null;

  const match = slotLabel.match(/(\d+):(\d+)\s*(AM|PM)/i);

  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const meridian = match[3].toUpperCase();

  if (meridian === 'PM' && hour !== 12) {
    hour += 12;
  }

  if (meridian === 'AM' && hour === 12) {
    hour = 0;
  }

  return hour;
}

  // ── State ───────────────────────────────────────────
  let anchorDate    = new Date();
  anchorDate.setHours(0, 0, 0, 0);
  let currentView   = 'week';
  // Derive visible statuses from whichever chips start with .active in the HTML.
  // active chip   → status IS shown on the calendar (filled / highlighted)
  // inactive chip → status is HIDDEN from the calendar (hollow / dimmed)
  let activeStatuses = new Set(
    [...document.querySelectorAll('#legend-chips .legend-chip.active')]
      .map(el => el.dataset.status)
  );
  let cachedBookings = [];

  // ── DOM refs ────────────────────────────────────────
  const calBody    = document.getElementById('cal-body');
  const rangeLabel = document.getElementById('cal-range-label');
  const subtitle   = document.getElementById('cal-subtitle');
  const modal      = document.getElementById('cal-modal');

  // ── Helpers ─────────────────────────────────────────
  const fmt        = (d, opts) => d.toLocaleDateString('en-PH', opts);
  const pad        = n => String(n).padStart(2, '0');
  const toISO      = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ');

  function escHtml(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getWeekStart(d) {
    const c   = new Date(d);
    const dow = c.getDay() === 0 ? 7 : c.getDay(); // Mon = 1 … Sun = 7
    c.setDate(c.getDate() - (dow - 1));
    c.setHours(0, 0, 0, 0);
    return c;
  }

function getSlotSpan() {
  return 1;
}

  // ── Data fetching ───────────────────────────────────
  async function fetchBookings() {
    calBody.innerHTML =
      '<div class="cal-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading schedule…</div>';

    const allStatuses = ['pending','waiting','approved','confirmed','awaiting_payment','completed','cancelled'];
    const params = new URLSearchParams({
      view:     currentView,
      date:     toISO(anchorDate),
      statuses: allStatuses.join(','), // fetch all; filter client-side on render
    });

    try {
      const res  = await fetch(`${API_URL}?${params}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'API error');
      cachedBookings = data.bookings;
      renderCalendar();
    } catch (err) {
      calBody.innerHTML =
        `<div class="cal-loading" style="color:#ef4444;">
           <i class="fa-solid fa-triangle-exclamation"></i> ${escHtml(err.message)}
         </div>`;
    }
  }

  // ── Render dispatcher ───────────────────────────────
  function renderCalendar() {
    const visible = cachedBookings.filter(b => activeStatuses.has(b.status));
    currentView === 'month' ? renderMonth(visible) : renderWeekOrDay(visible);
  }

  // ── Week / Day render ───────────────────────────────
  function renderWeekOrDay(bookings) {
    const isDay = currentView === 'day';
    let days    = [];

    if (isDay) {
      days = [new Date(anchorDate)];
      rangeLabel.textContent = fmt(anchorDate, { weekday:'long', month:'long', day:'numeric', year:'numeric' });
      subtitle.textContent   = 'Daily schedule view';
    } else {
      const ws = getWeekStart(anchorDate);
      for (let i = 0; i < 7; i++) {
        const d = new Date(ws);
        d.setDate(ws.getDate() + i);
        days.push(d);
      }
      rangeLabel.textContent =
        `${fmt(days[0], { month:'short', day:'numeric' })} – ${fmt(days[6], { month:'short', day:'numeric', year:'numeric' })}`;
      subtitle.textContent = 'Weekly schedule view';
    }

    const today  = toISO(new Date());
    const byDate = groupByDate(bookings);

    let html = `<div class="cal-grid">
      <div class="cal-time-col">
        <div class="col-head"></div>
        ${TIME_HOURS.map((h, i) => `
          <div class="time-slot"><span class="time-label">${TIME_LABELS[i]}</span></div>
        `).join('')}
      </div>
      <div class="cal-days ${isDay ? 'cal-day-single' : ''}">`;

    days.forEach((d, di) => {
      const iso       = toISO(d);
      const isToday   = iso === today;
      const dayName   = fmt(d, { weekday:'short' }).toUpperCase();
      const dayNum    = d.getDate();
      const isLast    = di === days.length - 1;

      html += `<div class="cal-day-col"${isLast ? ' style="border-right:none;"' : ''}>
        <div class="col-head ${isToday ? 'today' : ''}">
          <div class="col-head-day">${dayName}</div>
          <div class="col-head-date">${dayNum}</div>
        </div>`;

      const dayBookings = byDate[iso] || [];

      TIME_HOURS.forEach(hour => {
      const slotBookings = dayBookings.filter(
        b => getHourFromSlot(b.slot_label) === hour
      );

        html += `<div class="day-slot">`;
        slotBookings.forEach(b => {
          const heightPx = getSlotSpan(b.slot_id) * 70 - 6;
          html += bookingBlock(b, `top:3px;height:${heightPx}px;`);
        });
        html += `</div>`;
      });

      html += `</div>`;
    });

    html += `</div></div>`;
    calBody.innerHTML = html;
    attachBlockClicks();
  }

  function bookingBlock(b, style) {
    const name = escHtml(b.client_name);
    const slot = escHtml(b.slot_label || 'No time set');
    const svc  = escHtml(b.service_name);
    return `<div class="cal-booking cb-${b.status}" style="${style}"
              data-id="${b.booking_id}" title="${name} · ${svc}">
              <div class="cb-name">${name}</div>
              <div class="cb-time">${slot}</div>
              <div class="cb-time">${svc}</div>
            </div>`;
  }

  // ── Month render ────────────────────────────────────
  function renderMonth(bookings) {
    const year     = anchorDate.getFullYear();
    const month    = anchorDate.getMonth();
    const today    = toISO(new Date());
    const firstDay = new Date(year, month, 1);
    const lastDay  = new Date(year, month + 1, 0);

    rangeLabel.textContent = fmt(firstDay, { month:'long', year:'numeric' });
    subtitle.textContent   = 'Monthly schedule view';

    const byDate      = groupByDate(bookings);
    const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Mon-based

    const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    let html  = `<div class="cal-month-grid">
      ${DOW.map(d => `<div class="cal-month-head">${d}</div>`).join('')}`;

    // Leading empty cells
    for (let i = 0; i < startOffset; i++) {
      const d = new Date(firstDay);
      d.setDate(d.getDate() - (startOffset - i));
      html += monthCell(d, toISO(d), byDate, today, true);
    }

    // Current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      html += monthCell(date, toISO(date), byDate, today, false);
    }

    // Trailing empty cells
    const total     = startOffset + lastDay.getDate();
    const remainder = total % 7 === 0 ? 0 : 7 - (total % 7);
    for (let i = 1; i <= remainder; i++) {
      const d = new Date(lastDay);
      d.setDate(lastDay.getDate() + i);
      html += monthCell(d, toISO(d), byDate, today, true);
    }

    html += `</div>`;
    calBody.innerHTML = html;
    attachBlockClicks();
  }

  function monthCell(date, iso, byDate, today, isOther) {
    const isToday  = iso === today;
    const items    = byDate[iso] || [];
    const maxShow  = 3;

    let inner = items.slice(0, maxShow).map(b =>
      `<div class="month-booking cb-${b.status}" data-id="${b.booking_id}">
         ${escHtml(b.client_name)}
       </div>`
    ).join('');

    if (items.length > maxShow) {
      inner += `<div class="month-more">+${items.length - maxShow} more</div>`;
    }

    return `<div class="cal-month-cell ${isOther ? 'other-month' : ''} ${isToday ? 'today-cell' : ''}">
      <div class="month-cell-date">${date.getDate()}</div>
      ${inner}
    </div>`;
  }

  // ── Booking detail modal ────────────────────────────
  function openModal(bookingId) {
    const b = cachedBookings.find(x => x.booking_id === bookingId);
    if (!b) return;

    document.getElementById('modal-service').textContent = b.service_name;
    document.getElementById('modal-date').textContent    =
      `${b.booking_date}${b.slot_label ? ' · ' + b.slot_label : ''}`;
    document.getElementById('modal-client').textContent  = b.client_name;
    document.getElementById('modal-email').textContent   = b.client_email  || '—';
    document.getElementById('modal-phone').textContent   = b.client_phone  || '—';
    document.getElementById('modal-slot').textContent    = b.slot_label    || '—';
    document.getElementById('modal-type').textContent    = b.location_type ? capitalize(b.location_type) : '—';
    document.getElementById('modal-concern').textContent = b.concern_details || '—';

    document.getElementById('modal-status').innerHTML =
      `<span class="status-badge sb-${b.status}">${capitalize(b.status)}</span>`;

    const amountRow = document.getElementById('modal-amount-row');
    if (b.quotation_amount) {
      document.getElementById('modal-amount').textContent =
        `₱${parseFloat(b.quotation_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
      amountRow.style.display = '';
    } else {
      amountRow.style.display = 'none';
    }

    document.getElementById('modal-view-btn').href = `admin.html?booking_id=${b.booking_id}&from=calendar#detail`;
    modal.style.display = 'flex';
  }

  function closeModal() { modal.style.display = 'none'; }

  // ── Attach click handlers to rendered blocks ────────
  function attachBlockClicks() {
    calBody.querySelectorAll('[data-id]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        openModal(parseInt(el.dataset.id, 10));
      });
    });
  }

  // ── Utility ─────────────────────────────────────────
  function groupByDate(bookings) {
    return bookings.reduce((acc, b) => {
      (acc[b.booking_date] = acc[b.booking_date] || []).push(b);
      return acc;
    }, {});
  }

  // ── Event listeners ─────────────────────────────────

  // Navigation arrows
  document.getElementById('cal-prev').addEventListener('click', () => {
    if      (currentView === 'day')   anchorDate.setDate(anchorDate.getDate() - 1);
    else if (currentView === 'week')  anchorDate.setDate(anchorDate.getDate() - 7);
    else  { anchorDate.setDate(1); anchorDate.setMonth(anchorDate.getMonth() - 1); }
    fetchBookings();
  });

  document.getElementById('cal-next').addEventListener('click', () => {
    if      (currentView === 'day')   anchorDate.setDate(anchorDate.getDate() + 1);
    else if (currentView === 'week')  anchorDate.setDate(anchorDate.getDate() + 7);
    else  { anchorDate.setDate(1); anchorDate.setMonth(anchorDate.getMonth() + 1); }
    fetchBookings();
  });

  document.getElementById('cal-today').addEventListener('click', () => {
    anchorDate = new Date();
    anchorDate.setHours(0, 0, 0, 0);
    fetchBookings();
  });

  // View tabs
  document.querySelectorAll('.cal-tab[data-view]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.cal-tab[data-view]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentView = tab.dataset.view;
      fetchBookings();
    });
  });

  // Legend chip toggles (filter by status, no refetch)
  document.getElementById('legend-chips').addEventListener('click', e => {
    const chip = e.target.closest('.legend-chip');
    if (!chip) return;
    const status = chip.dataset.status;
    if (activeStatuses.has(status)) {
      activeStatuses.delete(status);
      chip.classList.remove('active');
    } else {
      activeStatuses.add(status);
      chip.classList.add('active');
    }
    renderCalendar();
  });

  // Modal close
  document.getElementById('cal-modal-close').addEventListener('click', closeModal);
  document.getElementById('cal-modal-cancel').addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  // ── Init ────────────────────────────────────────────
  fetchBookings();

})();