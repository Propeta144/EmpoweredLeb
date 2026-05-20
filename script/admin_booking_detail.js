/* ═══════════════════════════════════════════════════════
   ADMIN BOOKING DETAIL  —  scripts/admin_booking_detail.js
═══════════════════════════════════════════════════════ */
let adminBooking = null;

document.addEventListener("DOMContentLoaded", () => {
    loadAdminBookingDetail();
    setupAdminImageViewer();
    setupBackButton();
});

// ─────────────────────────────────────────────────────────────────
// BACK BUTTON — returns to whichever page the user came from
// Supported values of ?from=  :  "calendar" | "bookings" (default)
// ─────────────────────────────────────────────────────────────────
function setupBackButton() {
    const params = new URLSearchParams(window.location.search);
    const from   = params.get("from") ?? "bookings";

    const backBtn = document.querySelector(".page-header .btn-ghost");
    if (!backBtn) return;

    // Map the "from" value to the section id and the nav element to activate
    const destinations = {
        calendar: { section: "calendar", navSelector: "[onclick*=\"'calendar'\"]" },
        bookings: { section: "bookings", navSelector: "[onclick*=\"'bookings'\"]" },
    };

    const dest = destinations[from] ?? destinations.bookings;

    // Replace the hardcoded onclick with a dynamic one
    backBtn.removeAttribute("onclick");
    backBtn.addEventListener("click", () => {
        const navEl = document.querySelector(dest.navSelector);
        if (typeof switchPage === "function") {
            switchPage(dest.section, navEl);
        } else {
            // Fallback: just update the hash
            window.location.hash = dest.section;
        }
    });
}

// ─────────────────────────────────────────────────────────────────
// LOAD DETAIL
// ─────────────────────────────────────────────────────────────────
async function loadAdminBookingDetail() {
    const params    = new URLSearchParams(window.location.search);
    const bookingId = params.get("booking_id");
    if (!bookingId) return;

    const res  = await fetch(`src/get_admin_booking_detail.php?booking_id=${bookingId}`);
    const data = await res.json();

    adminBooking = data.booking;

    renderAdminDetail();
    renderQuickActions();
    renderQuotation();
    renderAdminNotes();
    renderFiles(data.files);
    renderAdminStatusTracker(adminBooking, data.history || []);
}

// ─────────────────────────────────────────────────────────────────
// STATUS PROGRESS TRACKER
// ─────────────────────────────────────────────────────────────────
function renderAdminStatusTracker(booking, history) {
    const steps = [
        { key: "pending",          label: "Submitted",        icon: "fa-solid fa-file-lines"     },
        { key: "waiting",          label: "Quote Sent",       icon: "fa-solid fa-file-invoice"   },
        { key: "confirmed",        label: "Confirmed",        icon: "fa-solid fa-circle-check"   },
        { key: "awaiting_payment", label: "Awaiting Payment", icon: "fa-solid fa-credit-card"    },
        { key: "completed",        label: "Completed",        icon: "fa-solid fa-flag-checkered" },
    ];

    const statusOrder = ["pending","waiting","confirmed","awaiting_payment","completed"];
    const status      = booking.status;

    const timestamps = { pending: booking.created_at };
    history.forEach(h => {
        if (!timestamps[h.new_status]) timestamps[h.new_status] = h.changed_at;
        if (h.new_status === "approved" && !timestamps["confirmed"])
            timestamps["confirmed"] = h.changed_at;
    });

    const normStatus   = status === "approved" ? "confirmed" : status;
    const currentIndex = statusOrder.indexOf(normStatus);
    const isCancelled  = status === "cancelled";

    let html = `<div class="admin-tracker">`;

    if (isCancelled) {
        const cancelledAt = history.filter(h => h.new_status === "cancelled").pop();
        const lastValid   = history
            .filter(h => h.new_status !== "cancelled")
            .map(h => h.new_status === "approved" ? "confirmed" : h.new_status);
        const lastIndex   = Math.max(...lastValid.map(s => statusOrder.indexOf(s)), 0);

        steps.forEach((step, i) => {
            html += adminTrackerStep(step, i <= lastIndex ? "done" : "upcoming", timestamps[step.key]);
        });

        html += `
        <div class="admin-tracker-step cancelled">
            <div class="admin-tracker-dot"><i class="fa-solid fa-ban"></i></div>
            <div class="admin-tracker-info">
                <div class="admin-tracker-label">Cancelled</div>
                ${cancelledAt ? `<div class="admin-tracker-time">${formatDateTime(cancelledAt.changed_at)}</div>` : ""}
            </div>
        </div>`;
    } else {
        steps.forEach((step, i) => {
            let state = "upcoming";
            if (i < currentIndex)  state = "done";
            if (i === currentIndex) state = "current";
            html += adminTrackerStep(step, state, timestamps[step.key]);
        });
    }

    html += `</div>`;

    const uploadedCard = document.querySelector(".uploaded-files-wrap")?.closest(".card");
    if (uploadedCard) {
        const wrap = document.createElement("div");
        wrap.className = "card";
        wrap.style.marginBottom = "18px";
        wrap.innerHTML = `
            <div class="card-header">
                <div class="card-title">
                    <i class="fa-solid fa-timeline" style="color:var(--primary);margin-right:6px;"></i>
                    Request Progress
                </div>
            </div>
            <div class="card-body" style="padding:20px 24px;">${html}</div>
        `;
        uploadedCard.after(wrap);
    }
}

function adminTrackerStep(step, state, timestamp) {
    return `
    <div class="admin-tracker-step ${state}">
        <div class="admin-tracker-dot"><i class="${step.icon}"></i></div>
        <div class="admin-tracker-info">
            <div class="admin-tracker-label">${step.label}</div>
            ${timestamp
                ? `<div class="admin-tracker-time">${formatDateTime(timestamp)}</div>`
                : (state === "upcoming" ? `<div class="admin-tracker-time">Pending</div>` : "")}
        </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────
// RENDER MAIN DETAIL
// ─────────────────────────────────────────────────────────────────
function renderAdminDetail() {
    if (!adminBooking) return;


    const badge = document.getElementById("detail-status-badge");
    const statusLabels = {
        pending:          "Pending",
        waiting:          "Waiting for Customer Acceptance",
        confirmed:        "Confirmed",
        approved:         "Confirmed",
        awaiting_payment: "Awaiting Payment",
        completed:        "Completed",
        cancelled:        "Cancelled",
    };
    badge.innerText = statusLabels[adminBooking.status] ?? capitalize(adminBooking.status);
    badge.className = `badge badge-${adminBooking.status === "approved" ? "confirmed" : adminBooking.status}`;

    const initials = `${adminBooking.first_name?.[0] ?? ""}${adminBooking.last_name?.[0] ?? ""}`;
    const avatar   = document.querySelector(".av-xl");
    if (avatar) avatar.innerText = initials.toUpperCase();

    const clientName = document.querySelector(".card-body div[style*='font-size:20px']");
    if (clientName) clientName.innerText = `${adminBooking.first_name} ${adminBooking.last_name}`;

    const clientMeta = document.getElementById("client-meta");
    if (clientMeta) {
        const since = adminBooking.user_created_at
            ? new Date(adminBooking.user_created_at).toLocaleDateString("en-PH", { year: "numeric", month: "long" })
            : "—";
        const total = adminBooking.total_bookings ?? 0;
        clientMeta.innerText = `Member since ${since} · ${total} total booking${total !== 1 ? "s" : ""}`;
    }

    const emailEl = document.querySelector(".fa-envelope")?.parentElement;
    if (emailEl) emailEl.innerHTML =
        `<i class="fa-solid fa-envelope" style="color:var(--primary);"></i> ${adminBooking.email ?? "N/A"}`;

    const phoneEl = document.querySelector(".fa-phone")?.parentElement;
    if (phoneEl) phoneEl.innerHTML =
        `<i class="fa-solid fa-phone" style="color:var(--primary);"></i> ${adminBooking.phone ?? "N/A"}`;

    const detailBoxes = document.querySelectorAll(".form-row > div");
    if (detailBoxes.length >= 6) {
        detailBoxes[0].querySelector("div:last-child").innerHTML = `
            <i class="${adminBooking.icon_class}" style="color:var(--primary);margin-right:7px;"></i>
            ${adminBooking.category_name}`;

        detailBoxes[1].querySelector("div:last-child").innerText = adminBooking.service_name;
        detailBoxes[2].querySelector("div:last-child").innerText = formatDateTime(adminBooking.created_at);

        const modeBadgeClass = getModeBadgeClass(adminBooking.location_type);
        const fallbackModeIcon = {
            "badge-online": "fa-solid fa-video",
            "badge-home":   "fa-solid fa-house",
            "badge-walkin": "fa-solid fa-shop",
        };
        const resolvedModeIcon = adminBooking.mode_icon || fallbackModeIcon[modeBadgeClass] || "fa-solid fa-shop";
        detailBoxes[3].querySelector("div:last-child").innerHTML = `
            <span class="badge ${modeBadgeClass}">
                <i class="${resolvedModeIcon}" style="margin-right:5px;"></i>${adminBooking.location_type ?? "N/A"}
            </span>`;

        detailBoxes[4].querySelector("div:last-child").innerText = formatDate(adminBooking.booking_date);
        detailBoxes[5].querySelector("div:last-child").innerText = adminBooking.slot_label ?? "N/A";
    }

    const concernWrap = document.querySelector(".form-label + div[style*='line-height']");
    if (concernWrap) concernWrap.innerText = adminBooking.concern_details ?? "No concern details provided.";
}

// ─────────────────────────────────────────────────────────────────
// QUICK ACTIONS
// ─────────────────────────────────────────────────────────────────
function renderQuickActions() {
    const wrap = document.getElementById("quick-actions-body");
    let html   = "";

    switch (adminBooking.status) {
        case "pending":
            html = `
            <button class="btn btn-success" onclick="approveBooking()">
                <i class="fa-solid fa-check"></i> Approve Request
            </button>
            <button class="btn btn-danger" onclick="rejectBooking()">
                <i class="fa-solid fa-xmark"></i> Reject Request
            </button>`;
            break;
        case "waiting":
            html = `
            <button class="btn btn-danger" onclick="cancelBooking()">
                <i class="fa-solid fa-ban"></i> Cancel Booking
            </button>`;
            break;
        case "confirmed":
        case "approved":
            html = `
            <button class="btn btn-warning" onclick="completeBooking()">
                <i class="fa-solid fa-flag-checkered"></i> Mark as Completed
            </button>
            <button class="btn btn-danger" onclick="cancelBooking()">
                <i class="fa-solid fa-ban"></i> Cancel Booking
            </button>`;
            break;
        case "awaiting_payment":
            html = `
            <button class="btn btn-success" onclick="markPaid()" style="width:100%;">
                <i class="fa-solid fa-circle-check"></i> Mark as Paid
            </button>`;
            break;
        case "completed":
        case "cancelled":
            html = "";
            break;
    }

    wrap.innerHTML = html;
    wrap.closest(".card").style.display = html.trim() ? "block" : "none";
}

// ─────────────────────────────────────────────────────────────────
// QUOTATION PANEL
// ─────────────────────────────────────────────────────────────────
function renderQuotation() {
    const card     = document.getElementById("quotation-form-wrap").closest(".card");
    const formWrap = document.getElementById("quotation-form-wrap");
    const viewWrap = document.getElementById("quotation-view");

    if (adminBooking.status === "cancelled") {
        card.style.display = "none";
        return;
    }
    if (adminBooking.status === "pending") {
        card.style.display     = "block";
        formWrap.style.display = "block";
        viewWrap.style.display = "none";
        return;
    }

    card.style.display     = "block";
    formWrap.style.display = "none";
    viewWrap.style.display = "block";

    document.getElementById("quote-amount-text").innerText =
        parseFloat(adminBooking.quotation_amount ?? 0)
        .toLocaleString("en-PH", { minimumFractionDigits: 2 });

    const noteEl = document.getElementById("quote-note-text");
    if (noteEl) noteEl.remove();
}

// ─────────────────────────────────────────────────────────────────
// ADMIN NOTES PANEL
// ─────────────────────────────────────────────────────────────────
function renderAdminNotes() {
    const card     = document.getElementById("admin-notes-form-wrap").closest(".card");
    const formWrap = document.getElementById("admin-notes-form-wrap");
    const viewWrap = document.getElementById("admin-notes-view");

    if (adminBooking.status === "pending") {
        card.style.display     = "block";
        formWrap.style.display = "block";
        viewWrap.style.display = "none";
        return;
    }

    card.style.display     = "block";
    formWrap.style.display = "none";
    viewWrap.style.display = "block";

    document.getElementById("admin-note-display").innerText =
        adminBooking.admin_notes ?? "No notes available.";
}

// ─────────────────────────────────────────────────────────────────
// UPLOADED FILES
// ─────────────────────────────────────────────────────────────────
function renderFiles(files) {
    const wrap = document.querySelector(".uploaded-files-wrap");
    if (!wrap) return;

    if (!files || files.length === 0) {
        wrap.innerHTML = `<div style="color:var(--text-muted);font-size:14px;">No uploaded files.</div>`;
        return;
    }

    const imagePaths = files
        .filter(f => ["jpg","jpeg","png","webp"].includes(f.file_name.split(".").pop().toLowerCase()))
        .map(f => `uploads/${f.file_name}`);

    let html       = "";
    let imageIndex = 0;

    files.forEach(file => {
        const path = `uploads/${file.file_name}`;
        const ext  = file.file_name.split(".").pop().toLowerCase();

        if (["jpg","jpeg","png","webp"].includes(ext)) {
            html += `
            <div class="image-preview-wrap">
                <img
                    src="${path}"
                    class="preview-image"
                    onclick='openAdminImageViewer(${JSON.stringify(imagePaths)}, ${imageIndex})'
                >
            </div>`;
            imageIndex++;
        } else {
            html += `
            <a href="${path}" target="_blank" class="file-item" style="text-decoration:none;">
                <div class="file-icon"><i class="fa-solid fa-file-pdf"></i></div>
                <div class="file-name">${file.file_name}</div>
            </a>`;
        }
    });

    wrap.innerHTML = html;
}

// ─────────────────────────────────────────────────────────────────
// IMAGE LIGHTBOX
// ─────────────────────────────────────────────────────────────────
function setupAdminImageViewer() {
    if (document.getElementById("admin-image-modal")) return;
    const modal = document.createElement("div");
    modal.id    = "admin-image-modal";
    modal.innerHTML = `
        <div class="admin-image-overlay">
            <button class="admin-image-close" onclick="closeAdminImageViewer()">
                <i class="fa-solid fa-xmark"></i>
            </button>
            <button class="admin-image-nav prev" onclick="changeAdminImage(-1)">
                <i class="fa-solid fa-chevron-left"></i>
            </button>
            <img id="admin-image-preview" class="admin-image-preview">
            <button class="admin-image-nav next" onclick="changeAdminImage(1)">
                <i class="fa-solid fa-chevron-right"></i>
            </button>
        </div>`;
    document.body.appendChild(modal);
}

let currentAdminImages = [];
let currentAdminIndex  = 0;

function openAdminImageViewer(images, index) {
    currentAdminImages = images;
    currentAdminIndex  = index;
    document.getElementById("admin-image-modal").style.display = "flex";
    updateAdminImageViewer();
}
function closeAdminImageViewer() {
    document.getElementById("admin-image-modal").style.display = "none";
}
function changeAdminImage(direction) {
    currentAdminIndex = (currentAdminIndex + direction + currentAdminImages.length) % currentAdminImages.length;
    updateAdminImageViewer();
}
function updateAdminImageViewer() {
    document.getElementById("admin-image-preview").src = currentAdminImages[currentAdminIndex];
}

// ─────────────────────────────────────────────────────────────────
// STATUS ACTIONS
// ─────────────────────────────────────────────────────────────────
async function updateBookingStatus(action) {
    if (!adminBooking) return;

    const quotationAmount = document.getElementById("quotation-amount")?.value ?? "";
    const adminNotes      = document.getElementById("admin-notes")?.value ?? "";

    if (action === "approve") {
        if (!quotationAmount || parseFloat(quotationAmount) <= 0) {
            alert("Please enter a valid quotation amount before approving.");
            return;
        }
        if (!adminNotes.trim()) {
            alert("Admin notes are required when approving a request.");
            return;
        }
    }
    if (action === "reject" && !adminNotes.trim()) {
        alert("Please add a note explaining the rejection reason.");
        return;
    }

    try {
        const formData = new FormData();
        formData.append("booking_id",       adminBooking.booking_id);
        formData.append("action",           action);
        formData.append("quotation_amount", quotationAmount);
        formData.append("admin_notes",      adminNotes);

        const res  = await fetch("src/admin_update_booking_status.php", { method: "POST", body: formData });
        const data = await res.json();

        if (!data.success) { alert(data.message); return; }

        alert(data.message);
        location.reload();
    } catch (err) {
        console.error(err);
        alert("Something went wrong. Please try again.");
    }
}

function approveBooking()  { updateBookingStatus("approve");  }
function rejectBooking()   { updateBookingStatus("reject");   }
function completeBooking() { updateBookingStatus("complete"); }
function cancelBooking()   { updateBookingStatus("cancel");   }
function markPaid()        { updateBookingStatus("paid");     }

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
function getModeBadgeClass(mode) {
    const lower = (mode || "").toLowerCase();
    if (lower.includes("online")) return "badge-online";
    if (lower.includes("home"))   return "badge-home";
    return "badge-walkin";
}

function formatDate(dateString) {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-PH", {
        year: "numeric", month: "long", day: "numeric",
    });
}

function formatDateTime(dateString) {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString("en-PH", {
        year: "numeric", month: "long", day: "numeric",
        hour: "numeric", minute: "2-digit", hour12: true,
    });
}

function capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
}