/* =============================================================
   admin_dashboard.js  —  EMPOWERED Admin Dashboard Logic
   ============================================================= */

document.addEventListener('DOMContentLoaded', () => {
    setDashboardDate();
    loadDashboardStats();
    loadUpcomingAppointments();
});

// ── Date greeting ──────────────────────────────────────────
function setDashboardDate() {
    const el = document.getElementById('dash-subtitle');
    if (!el) return;
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric'
    });
    el.textContent = `Here's what's happening with EMPOWERED today — ${dateStr}`;
}

// ── Formatting helpers ─────────────────────────────────────
function formatPeso(val) {
    if (val >= 1_000_000) return '₱' + (val / 1_000_000).toFixed(1) + 'M';
    if (val >= 1_000)     return '₱' + (val / 1_000).toFixed(1) + 'K';
    return '₱' + val.toFixed(0);
}

function pctChange(current, previous) {
    if (!previous || previous === 0) return null;
    return Math.round(((current - previous) / previous) * 100);
}

function applyTrend(elId, pct, invert = false) {
    const el = document.getElementById(elId);
    if (!el || pct === null) return;
    const isUp = invert ? pct < 0 : pct >= 0;
    el.textContent = (isUp ? '↑ ' : '↓ ') + Math.abs(pct) + '%';
    el.className   = 'stat-trend ' + (isUp ? 'trend-up' : 'trend-down');
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

// ── Main stats loader ──────────────────────────────────────
async function loadDashboardStats() {
    try {
        const res  = await fetch('src/get_dashboard_stats.php');
        const data = await res.json();
        if (!data.success) { console.error('Dashboard stats failed'); return; }

        populateKPIs(data);
        renderBookingsChart(data.bookingsPerMonth, data.thisWeek, data.lastWeek);
        renderRevenueChart(data.revenuePerMonth, data.monthlyRevenue, data.lastMonthRevenue);
        renderDonut(data.statusMap);
        renderMostRequested(data.mostRequested);
    } catch (err) {
        console.error('Dashboard stats error:', err);
    }
}

// ── KPI population ─────────────────────────────────────────
function populateKPIs(d) {
    // Row 1
    setText('dash-today-total', d.today.total);
    setText('dash-today-sub',   `${d.today.confirmed} confirmed, ${d.today.pending} pending`);

    setText('dash-week-total', d.thisWeek);
    setText('dash-week-sub',   `vs ${d.lastWeek} last week`);
    applyTrend('dash-week-trend', pctChange(d.thisWeek, d.lastWeek));

    setText('dash-pending-total', d.pending);
    setText('dash-waiting-total', d.waiting);

    setText('dash-confirmed-total', d.confirmedThisWeek);

    // Row 2
    setText('dash-completed-total', d.completed);
    setText('dash-cancelled-total', d.cancelled);

    setText('dash-clients-total', d.totalClients);
    setText('dash-clients-sub',   `${d.activeClients} active this month`);

    setText('dash-revenue-total', formatPeso(d.totalRevenue));

    setText('dash-monthly-revenue-total', formatPeso(d.monthlyRevenue));
    setText('dash-monthly-revenue-sub',   new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }));

    // Monthly revenue MoM badge
    const momPct = pctChange(d.monthlyRevenue, d.lastMonthRevenue);
    const momEl  = document.getElementById('dash-mom-badge');
    if (momEl && momPct !== null) {
        const isUp  = momPct >= 0;
        momEl.textContent  = (isUp ? '↑ ' : '↓ ') + Math.abs(momPct) + '% MoM';
        momEl.style.color  = isUp ? 'var(--success)' : 'var(--danger)';
        momEl.style.background = isUp ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.1)';
    }

    // Revenue card subtitle
    setText('dash-revenue-month-earned',
        `₱${d.monthlyRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} earned this month`
    );
}

// ── Bar chart builder ──────────────────────────────────────
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MAX_BAR_H    = 130;

function buildBars(containerId, valuesObj, secondary = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // valuesObj is { "1": n, "2": n, ... "12": n }
    const values     = Array.from({ length: 12 }, (_, i) => valuesObj[i + 1] ?? 0);
    const currentMon = new Date().getMonth(); // 0-indexed
    const maxVal     = Math.max(...values, 1);

    container.innerHTML = values.map((val, i) => {
        const isFuture = i > currentMon;
        const h        = Math.max(Math.round((val / maxVal) * MAX_BAR_H), 3);
        return `
        <div class="bar-col">
            <div class="${secondary ? 'bar secondary' : 'bar'}"
                 style="height:${h}px;${isFuture ? 'opacity:.2;' : ''}"></div>
            <div class="bar-label">${MONTH_LABELS[i]}</div>
        </div>`;
    }).join('');
}

function renderBookingsChart(perMonth, thisWeek, lastWeek) {
    buildBars('dash-bookings-chart', perMonth, false);

    const currentMon   = new Date().getMonth() + 1; // 1-indexed
    const thisMonTotal = perMonth[currentMon]       ?? 0;
    const lastMonTotal = perMonth[currentMon - 1]   ?? 0;
    const pct          = pctChange(thisMonTotal, lastMonTotal);

    setText('dash-bookings-footer-left',  `Total: ${thisMonTotal} bookings this month`);

    const footerRight = document.getElementById('dash-bookings-footer-right');
    if (footerRight && pct !== null) {
        const isUp = pct >= 0;
        footerRight.textContent = `${isUp ? '↑' : '↓'} ${Math.abs(pct)}% vs last month`;
        footerRight.style.color = isUp ? 'var(--success)' : 'var(--danger)';
    }
}

function renderRevenueChart(perMonth, monthlyRevenue, lastMonthRevenue) {
    buildBars('dash-revenue-chart', perMonth, true);
}

// ── Donut chart ────────────────────────────────────────────
// SVG circle: r=48 → C = 2π×48 ≈ 301.593
const DONUT_C = 301.593;

function renderDonut(statusMap) {
    const completed = (statusMap['completed']  ?? 0);
    const confirmed = (statusMap['confirmed']  ?? 0) + (statusMap['approved'] ?? 0);
    const pending   = (statusMap['pending']    ?? 0) + (statusMap['waiting']  ?? 0);
    const cancelled = (statusMap['cancelled']  ?? 0);
    const total     = completed + confirmed + pending + cancelled;

    if (!total) return;

    function seg(v) { return (v / total) * DONUT_C; }

    const cSeg  = seg(completed);
    const cfSeg = seg(confirmed);
    const pSeg  = seg(pending);
    const canSeg = seg(cancelled);

    // Offsets accumulate (segments sit end-to-end around circle)
    setDonutSegment('donut-completed',  cSeg,  0);
    setDonutSegment('donut-confirmed',  cfSeg, cSeg);
    setDonutSegment('donut-pending',    pSeg,  cSeg + cfSeg);
    setDonutSegment('donut-cancelled',  canSeg, cSeg + cfSeg + pSeg);

    // Center total
    setText('donut-total-text', total);

    // Legend %
    const pct = v => total ? Math.round((v / total) * 100) : 0;
    setText('donut-pct-completed', pct(completed) + '%');
    setText('donut-pct-confirmed', pct(confirmed) + '%');
    setText('donut-pct-pending',   pct(pending)   + '%');
    setText('donut-pct-cancelled', pct(cancelled) + '%');
}

function setDonutSegment(id, dashLen, offset) {
    const el = document.getElementById(id);
    if (!el) return;
    el.setAttribute('stroke-dasharray',  `${dashLen.toFixed(2)} ${(DONUT_C - dashLen).toFixed(2)}`);
    el.setAttribute('stroke-dashoffset', `-${offset.toFixed(2)}`);
}

// ── Most Requested Services ────────────────────────────────
const SERVICE_COLORS = [
    'var(--primary)',
    'var(--success)',
    'var(--purple)',
    'var(--warning)',
];

function renderMostRequested(services) {
    const container = document.getElementById('dash-most-requested');
    if (!container || !services.length) return;

    const grandTotal = services.reduce((sum, s) => sum + parseInt(s.total), 0) || 1;

    container.innerHTML = services.map((s, i) => {
        const pct   = Math.round((parseInt(s.total) / grandTotal) * 100);
        const color = SERVICE_COLORS[i] ?? 'var(--primary)';
        return `
        <div>
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px;">
                <span style="font-weight:600;">${s.service_name}</span>
                <span style="color:${color};font-weight:700;">${pct}%</span>
            </div>
            <div style="height:7px;background:var(--border);border-radius:999px;">
                <div style="height:100%;width:${pct}%;background:${color};border-radius:999px;transition:width .5s ease;"></div>
            </div>
        </div>`;
    }).join('');
}

// ── Upcoming Appointments ──────────────────────────────────
async function loadUpcomingAppointments() {
    try {
        const res  = await fetch('src/get_upcoming_appointments.php');
        const data = await res.json();
        if (!data.success) { console.error('Upcoming appointments failed'); return; }
        renderUpcomingAppointments(data.appointments);
    } catch (err) {
        console.error('Upcoming appointments error:', err);
    }
}

const AVATAR_COLORS = ['', 'av-green', 'av-purple', 'av-orange', 'av-teal'];

function getModeClass(locationType) {
    const l = (locationType ?? '').toLowerCase();
    if (l.includes('online')) return 'badge-online';
    if (l.includes('home'))   return 'badge-home';
    return 'badge-walkin';
}

function getModeIcon(locationType) {
    const l = (locationType ?? '').toLowerCase();
    if (l.includes('online')) return 'fa-solid fa-video';
    if (l.includes('home'))   return 'fa-solid fa-house';
    return 'fa-solid fa-shop';
}

function formatApptDate(dateStr) {
    // dateStr is "YYYY-MM-DD"; append T00:00 to avoid UTC offset drift
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function renderUpcomingAppointments(appointments) {
    const container = document.getElementById('dash-upcoming-list');
    if (!container) return;

    if (!appointments.length) {
        container.innerHTML = `
        <div style="text-align:center;color:var(--text-muted);padding:28px 0;font-size:13px;">
            No upcoming confirmed appointments.
        </div>`;
        return;
    }

    container.innerHTML = appointments.map((appt, i) => {
        const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length];
        const modeClass   = getModeClass(appt.location_type);
        const modeIcon    = getModeIcon(appt.location_type);
        const modeLabel   = appt.location_type || 'Walk In';
        const slotLabel   = appt.slot_label   || 'TBD';
        const apptDate    = formatApptDate(appt.booking_date);

        return `
        <div class="appt-item"
             style="cursor:pointer;"
             onclick="window.location.href='admin.html?booking_id=${appt.booking_id}#detail'">
            <div class="avatar av-md ${avatarColor}">${appt.initials}</div>
            <div class="appt-info">
                <div class="appt-name">${appt.client_name}</div>
                <div class="appt-service">${appt.service_name}</div>
                <div class="appt-meta">
                    <span class="badge ${modeClass}">
                        <i class="${modeIcon}" style="font-size:9px;margin-right:2px;"></i>${modeLabel}
                    </span>
                    <span class="appt-time">
                        <i class="fa-regular fa-clock"></i> ${slotLabel}
                    </span>
                </div>
            </div>
            <div class="appt-right">
                <div class="appt-date">${apptDate}</div>
                <div><span class="badge badge-confirmed" style="font-size:10px;margin-top:4px;">Confirmed</span></div>
                <div class="appt-arrow"><i class="fa-solid fa-chevron-right"></i></div>
            </div>
        </div>`;
    }).join('');
}