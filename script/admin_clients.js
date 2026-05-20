let allClients = [];

document.addEventListener("DOMContentLoaded", loadClients);

// ─────────────────────────────────────────────────────────
// LOAD
// ─────────────────────────────────────────────────────────
async function loadClients() {
    try {
        const res  = await fetch("src/get_clients.php");
        const data = await res.json();

        if (!data.success) {
            console.error(data.message);
            return;
        }

        allClients = data.clients;

        renderClientStats(data.stats);
        renderClients(allClients);
        setupClientFilters();

    } catch (err) {
        console.error(err);
    }
}

// ─────────────────────────────────────────────────────────
// STAT CARDS
// ─────────────────────────────────────────────────────────
function renderClientStats(stats) {
    document.getElementById("clients-total").textContent        = stats.total;
    document.getElementById("clients-active").textContent       = stats.active;
    document.getElementById("clients-inactive").textContent     = stats.inactive;
    document.getElementById("clients-new-month").textContent    = stats.new_this_month;
}

// ─────────────────────────────────────────────────────────
// RENDER TABLE
// ─────────────────────────────────────────────────────────
function renderClients(clients) {
    const tbody = document.getElementById("clients-table-body");
    tbody.innerHTML = "";

    if (clients.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-row">No clients found.</td>
            </tr>`;
        return;
    }

    clients.forEach(client => {
        const row = document.createElement("tr");

        const isActive     = client.account_status === "active";
        const btnLabel     = isActive ? "Deactivate" : "Activate";
        const btnIcon      = isActive ? "fa-solid fa-ban" : "fa-solid fa-circle-check";
        const btnClass     = isActive ? "btn-danger" : "btn-success";

        row.innerHTML = `
        <td>
            <div class="avatar av-md">
                ${client.initials}
            </div>
        </td>

        <td>
            <div style="font-weight:600;">
                ${client.first_name} ${client.last_name}
            </div>
        </td>

        <td>
            <span style="font-size:13px;">${client.email ?? "—"}</span>
        </td>

        <td>
            <span style="font-size:13px;">${client.phone ?? "—"}</span>
        </td>

        <td>
            <span style="font-size:12px;">
                ${formatJoinDate(client.created_at)}
            </span>
        </td>

        <td>${formatLastActivity(client.last_activity)}</td>

        <td>
            <span style="font-weight:700;color:var(--primary);">
                ${client.total_bookings ?? 0}
            </span>
        </td>

        <td>
            <button
                class="btn ${btnClass} btn-xs"
                onclick="toggleClientStatus(${client.user_id}, this)"
            >
                <i class="${btnIcon}"></i> ${btnLabel}
            </button>
        </td>
        `;

        tbody.appendChild(row);
    });
}

// ─────────────────────────────────────────────────────────
// TOGGLE STATUS
// ─────────────────────────────────────────────────────────
async function toggleClientStatus(userId, btn) {
    const isCurrentlyActive = btn.classList.contains("btn-danger");
    const action = isCurrentlyActive ? "deactivate" : "activate";

    const confirmed = confirm(
        `Are you sure you want to ${action} this client?`
    );
    if (!confirmed) return;

    const formData = new FormData();
    formData.append("user_id", userId);

    try {
        const res  = await fetch("src/toggle_client_status.php", {
            method: "POST",
            body:   formData,
        });
        const data = await res.json();

        if (!data.success) {
            alert(data.message);
            return;
        }

        // Update button in-place without full reload
        const newActive = data.new_status === "active";
        btn.className   = `btn ${newActive ? "btn-danger" : "btn-success"} btn-xs`;
        btn.innerHTML   = `<i class="${newActive ? "fa-solid fa-ban" : "fa-solid fa-circle-check"}"></i> ${newActive ? "Deactivate" : "Activate"}`;

        // Sync local array and re-render stats
        const clientInArray = allClients.find(c => c.user_id == userId);
        if (clientInArray) clientInArray.account_status = data.new_status;

        const active   = allClients.filter(c => c.account_status === "active").length;
        const inactive = allClients.length - active;
        document.getElementById("clients-active").textContent   = active;
        document.getElementById("clients-inactive").textContent = inactive;

    } catch (err) {
        console.error(err);
        alert("Something went wrong. Please try again.");
    }
}

// ─────────────────────────────────────────────────────────
// FILTERS & SEARCH
// ─────────────────────────────────────────────────────────
function setupClientFilters() {
    document.getElementById("client-search").addEventListener("input",  applyClientFilters);
    document.getElementById("client-status-filter").addEventListener("change", applyClientFilters);
    document.getElementById("client-sort-filter").addEventListener("change",   applyClientFilters);
}

function applyClientFilters() {
    const search = document.getElementById("client-search").value.toLowerCase().trim();
    const status = document.getElementById("client-status-filter").value;
    const sort   = document.getElementById("client-sort-filter").value;

    let filtered = [...allClients];

    // Search: name, email, phone
    if (search) {
        filtered = filtered.filter(c =>
            `${c.first_name} ${c.last_name}`.toLowerCase().includes(search) ||
            (c.email ?? "").toLowerCase().includes(search)                  ||
            (c.phone ?? "").toLowerCase().includes(search)
        );
    }

    // Status filter
    if (status === "Active") {
        filtered = filtered.filter(c => c.account_status === "active");
    } else if (status === "Inactive") {
        filtered = filtered.filter(c => c.account_status !== "active");
    } else if (status === "New (This Month)") {
        const thisMonth = new Date().toISOString().slice(0, 7);
        filtered = filtered.filter(c => c.created_at?.slice(0, 7) === thisMonth);
    }

    // Sort
    switch (sort) {
        case "Sort: Name A–Z":
            filtered.sort((a, b) =>
                `${a.last_name} ${a.first_name}`
                .localeCompare(`${b.last_name} ${b.first_name}`)
            );
            break;
        case "Sort: Most Bookings":
            filtered.sort((a, b) => (b.total_bookings ?? 0) - (a.total_bookings ?? 0));
            break;
        case "Sort: Last Active":
            filtered.sort((a, b) => {
                if (!a.last_activity && !b.last_activity) return 0;
                if (!a.last_activity) return 1;
                if (!b.last_activity) return -1;
                return new Date(b.last_activity) - new Date(a.last_activity);
            });
            break;
        default: // Date Joined (newest first — already default from PHP)
            filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            break;
    }

    renderClients(filtered);
}

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────

function formatJoinDate(dateString) {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-US", {
        month: "short",
        day:   "numeric",
        year:  "numeric",
    });
}

function formatLastActivity(dateString) {
    if (!dateString) {
        return `<span style="font-size:12px;color:var(--text-light);">No activity</span>`;
    }

    const now      = new Date();
    const activity = new Date(dateString);

    // Normalise both to midnight for day-diff comparison
    const nowMidnight  = new Date(now.getFullYear(),      now.getMonth(),      now.getDate());
    const actMidnight  = new Date(activity.getFullYear(), activity.getMonth(), activity.getDate());
    const diffDays     = Math.round((nowMidnight - actMidnight) / (1000 * 60 * 60 * 24));

    if (diffDays === 0)
        return `<span style="font-size:12px;color:var(--success);font-weight:600;">Today</span>`;
    if (diffDays === 1)
        return `<span style="font-size:12px;color:var(--text-muted);">Yesterday</span>`;
    return `<span style="font-size:12px;color:var(--text-muted);">${diffDays} days ago</span>`;
}