let allAdminBookings = [];

document.addEventListener(
    "DOMContentLoaded",
    () => {

        loadAdminBookings();

        initializeBookingFilters();

    }
);

async function loadAdminBookings(){

    try{

        const res =
            await fetch(
                "src/get_admin_bookings.php"
            );

        const data =
            await res.json();

        if(!data.success){

            console.error(data.message);

            return;
        }

        allAdminBookings =
            data.bookings;

        renderAdminBookings(
            allAdminBookings
        );

        populateCategoryFilter();

        updateBookingStats();

    }catch(err){

        console.error(err);

    }
}

function renderAdminBookings(bookings){

    const tbody =
        document.getElementById(
            "admin-bookings-body"
        );

    tbody.innerHTML = "";

    if(bookings.length === 0){

        tbody.innerHTML = `
        <tr>
            <td colspan="8" class="empty-row">
                No bookings found.
            </td>
        </tr>
        `;

        return;
    }

    bookings.forEach(booking => {

        const row =
            document.createElement("tr");

        row.innerHTML = `

        <td>
            <div class="td-name">

                <div class="avatar av-sm">
                    ${booking.initials}
                </div>

                <div>
                    <div>
                        ${booking.client_name}
                    </div>

                    <div class="td-sub">
                        ${booking.email}
                    </div>
                </div>

            </div>
        </td>

        <td>
            <span style="font-size:12px;color:var(--text-muted);">
                ${booking.category_name}
            </span>
        </td>

        <td>
            <span style="font-size:13px;font-weight:500;">
                ${booking.service_name}
            </span>
        </td>

        <td>
            ${getModeHTML(booking.location_type, booking.mode_icon)}
        </td>

        <td>
            <div style="font-size:12px;font-weight:600;">
                ${formatScheduleDate(
                    booking.booking_date
                )}
            </div>

            <div class="td-sub">
                ${booking.slot_label ?? "No Slot"}
            </div>
        </td>

        <td>
            <span style="font-size:12px;color:var(--text-muted);">
                ${formatDate(
                    booking.created_at
                )}
            </span>
        </td>

        <td>
            ${getStatusHTML(
                booking.status
            )}
        </td>

        <td>

            <div style="display:flex;gap:5px;">

                <a
                    href="admin.html?booking_id=${booking.booking_id}#detail"
                    class="btn btn-ghost btn-xs"
                >
                    <i class="fa-solid fa-eye"></i>
                </a>

                ${booking.status !== "cancelled"
                && booking.status !== "completed"
                ?
                `
                <button
                    class="btn btn-danger btn-xs"
                    onclick="cancelAdminBooking(${booking.booking_id})"
                >
                    <i class="fa-solid fa-xmark"></i>
                    Cancel
                </button>
                `
                :
                `
                <button
                    class="btn btn-danger btn-xs"
                    disabled
                    style="opacity:.4;"
                >
                    <i class="fa-solid fa-xmark"></i>
                    Cancel
                </button>
                `
                }

            </div>

        </td>
        `;

        tbody.appendChild(row);

    });

}

function getModeHTML(mode, modeIcon) {

    let className = "badge-walkin";
    const lower   = mode.toLowerCase();

    if      (lower.includes("online")) className = "badge-online";
    else if (lower.includes("home"))   className = "badge-home";

    const fallbackIcon = {
        "badge-online": "fa-solid fa-video",
        "badge-home":   "fa-solid fa-house",
        "badge-walkin": "fa-solid fa-shop",
    };

    const resolvedIcon = modeIcon || fallbackIcon[className];

    return `
    <span class="badge ${className}">
        <i class="${resolvedIcon}" style="margin-right:4px;"></i>${mode}
    </span>
    `;
}

// ──────────────────────────────────────────────────────────────
// getStatusHTML — Pascal Case labels, payment_pending included
// ──────────────────────────────────────────────────────────────
function getStatusHTML(status) {
    let label     = "Pending";
    let className = "badge-pending";

    switch (status) {
        case "approved":
        case "confirmed":
            label     = "Confirmed";
            className = "badge-confirmed";
            break;
        case "waiting":
            label     = "Waiting";
            className = "badge-waiting";
            break;
        case "awaiting_payment":
            label     = "Awaiting Payment";
            className = "badge-awaiting-payment";
            break;
        case "completed":
            label     = "Completed";
            className = "badge-completed";
            break;
        case "cancelled":
            label     = "Cancelled";
            className = "badge-cancelled";
            break;
        case "pending":
        default:
            label     = "Pending";
            className = "badge-pending";
            break;
    }

    return `<span class="badge ${className}">${label}</span>`;
}

function formatDate(dateString){

    return new Date(dateString)
    .toLocaleString(
        "en-US",
        {
            month: "short",
            day:   "numeric",
            year:  "numeric"
        }
    );
}

function formatScheduleDate(dateString){

    return new Date(dateString)
    .toLocaleDateString(
        "en-US",
        {
            month: "short",
            day:   "numeric",
            year:  "numeric"
        }
    );
}

// ──────────────────────────────────────────────────────────────
// updateBookingStats — counts payment_pending under "waiting"
// ──────────────────────────────────────────────────────────────
function updateBookingStats() {
    document.getElementById("pending-count").textContent   = countStatus("pending");
    document.getElementById("waiting-count").textContent   = countStatus("waiting");
    // DB uses "confirmed" (after customer accepts); "approved" is legacy — count both
    document.getElementById("confirmed-count").textContent =
        countStatus("confirmed") + countStatus("approved");
    document.getElementById("completed-count").textContent = countStatus("completed");
    document.getElementById("cancelled-count").textContent = countStatus("cancelled");
}

function countStatus(status){

    return allAdminBookings.filter(
        booking => booking.status === status
    ).length;
}

function populateCategoryFilter(){

    const filter =
        document.getElementById(
            "booking-category-filter"
        );

    const categories =
        [...new Set(
            allAdminBookings.map(
                b => b.category_name
            )
        )];

    categories.forEach(category => {

        const option =
            document.createElement("option");

        option.value       = category;
        option.textContent = category;

        filter.appendChild(option);

    });

}

function initializeBookingFilters(){

    document
    .getElementById("booking-search")
    .addEventListener(
        "input",
        applyAdminFilters
    );

    document
    .getElementById("booking-status-filter")
    .addEventListener(
        "change",
        applyAdminFilters
    );

    document
    .getElementById("booking-category-filter")
    .addEventListener(
        "change",
        applyAdminFilters
    );

    document
    .getElementById("booking-mode-filter")
    .addEventListener(
        "change",
        applyAdminFilters
    );

    document
    .getElementById("booking-sort-filter")
    .addEventListener(
        "change",
        applyAdminFilters
    );
}

function applyAdminFilters(){

    const search =
        document.getElementById(
            "booking-search"
        ).value.toLowerCase();

    const status =
        document.getElementById(
            "booking-status-filter"
        ).value;

    const category =
        document.getElementById(
            "booking-category-filter"
        ).value;

    const mode =
        document.getElementById(
            "booking-mode-filter"
        ).value;

    const sort =
        document.getElementById(
            "booking-sort-filter"
        ).value;

    let filtered = [...allAdminBookings];

    // SEARCH
    if(search){

        filtered = filtered.filter(booking =>

            booking.client_name
            .toLowerCase()
            .includes(search)

            ||

            booking.service_name
            .toLowerCase()
            .includes(search)
        );
    }

    // STATUS FILTER
    if (status !== "All Statuses") {
        let statusValue = status;
        if      (status === "Confirmed")               statusValue = "confirmed";
        else if (status === "Waiting for Acceptance")  statusValue = "waiting";
        else if (status === "Awaiting Payment")        statusValue = "awaiting_payment";
        else                                           statusValue = status.toLowerCase();

        filtered = filtered.filter(b => b.status === statusValue);
    }

    // CATEGORY FILTER
    if(category !== "All Categories"){

        filtered = filtered.filter(
            booking => booking.category_name === category
        );
    }

    // MODE FILTER
    if(mode !== "All Modes"){

        filtered = filtered.filter(booking => {

            const bookingMode =
                booking.location_type
                .toLowerCase()
                .replace(/\s+/g, "");

            const selectedMode =
                mode
                .toLowerCase()
                .replace(/\s+/g, "");

            return bookingMode === selectedMode;
        });
    }

    // SORTING
    if(sort.includes("Status")){

        const statusOrder = {
            approved:        1,
            payment_pending: 2,
            waiting:         3,
            pending:         4,
            cancelled:       5,
            completed:       6
        };

        filtered.sort((a, b) => {
            return (statusOrder[a.status] ?? 9)
                 - (statusOrder[b.status] ?? 9);
        });

    }else if(sort.includes("Oldest")){

        filtered.sort((a, b) => {
            return new Date(a.created_at) - new Date(b.created_at);
        });

    }else{

        filtered.sort((a, b) => {
            return new Date(b.created_at) - new Date(a.created_at);
        });
    }

    renderAdminBookings(filtered);
}

async function cancelAdminBooking(id){

    const confirmed = confirm("Cancel this booking?");

    if(!confirmed) return;

    const formData = new FormData();
    formData.append("booking_id", id);

    const res =
        await fetch(
            "src/admin_cancel_booking.php",
            {
                method: "POST",
                body:   formData
            }
        );

    const data = await res.json();

    if(data.success){

        loadAdminBookings();

    }else{

        alert(data.message);

    }

}