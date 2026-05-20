// ============================================================
// script/session_check.js  (UPDATED)
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {

    const guestView = document.getElementById("guest-view");
    const userView  = document.getElementById("user-view");

    try {
        const res  = await fetch("src/check_session.php");
        const data = await res.json();

        if (data.logged_in) {
            // ── Show logged-in nav ──────────────────────────
            guestView.style.display = "none";
            userView.style.display  = "flex";

            // Show auth-only nav items (My Requests, Inbox)
            document.querySelectorAll(".auth-only").forEach(el => {
                el.style.display = "list-item";
            });

            document.dispatchEvent(new Event("chatReady"));

            // Populate user info
            document.getElementById("user-name").textContent     = data.user_name;
            document.getElementById("user-fullname").textContent = data.user_name;
            document.getElementById("user-email").textContent    = data.user_email;

const nameParts = data.user_name.trim().split(/\s+/);

let initials = "";

if (nameParts.length === 1) {
    initials = nameParts[0][0];
} else {
    initials =
        nameParts[0][0] +
        nameParts[nameParts.length - 1][0];
}

document.getElementById("user-avatar").textContent =
    initials.toUpperCase();

            setupLogout();

        } else {
            // ── Guest view ──────────────────────────────────
            guestView.style.display = "block";
            userView.style.display  = "none";

            // Wire up "Request Service" buttons to show login modal
            setupLoginRequiredModal();
        }

    } catch (err) {
        console.error("Session error:", err);
        guestView.style.display = "block";
        userView.style.display  = "none";
        setupLoginRequiredModal();
    }
});

// ── Show login-required modal on any .request-btn click ──────
function setupLoginRequiredModal() {
    const modal     = document.getElementById("login-required-modal");
    const cancelBtn = document.getElementById("login-required-cancel");

    if (!modal) return;

    // Attach to all request/book buttons
    document.querySelectorAll(".request-btn, .book-btn, [data-requires-auth]").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            modal.classList.add("active");
            modal.style.display = "flex";
        });
    });

    // Close on Cancel
    cancelBtn?.addEventListener("click", () => closeLoginModal());

    // Close on backdrop click
    modal.addEventListener("click", (e) => {
        if (e.target === modal) closeLoginModal();
    });

    // Close on Escape
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeLoginModal();
    });
}

function closeLoginModal() {
    const modal = document.getElementById("login-required-modal");
    if (modal) {
        modal.classList.remove("active");
        modal.style.display = "none";
    }
}

// ── Logout modal ─────────────────────────────────────────────
function setupLogout() {
    const logoutBtn  = document.getElementById("logout-btn");
    const modal      = document.getElementById("logout-modal");
    const cancelBtn  = document.getElementById("cancel-logout");
    const confirmBtn = document.getElementById("confirm-logout");

    if (!logoutBtn || !modal || !cancelBtn || !confirmBtn) return;

    logoutBtn.addEventListener("click", () => {
        modal.classList.add("active");
        modal.style.display = "flex";
    });

    cancelBtn.addEventListener("click", () => closeLogoutModal());

    modal.addEventListener("click", (e) => {
        if (e.target === modal) closeLogoutModal();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeLogoutModal();
    });

    confirmBtn.addEventListener("click", async () => {
        confirmBtn.disabled    = true;
        confirmBtn.textContent = "Logging out…";
        try {
            const res  = await fetch("src/logout.php", { method: "POST" });
            const data = await res.json();
            if (data.success) window.location.href = "customer.html";
        } catch (err) {
            console.error("Logout error:", err);
            confirmBtn.disabled    = false;
            confirmBtn.textContent = "Log Out";
        }
    });
}

function closeLogoutModal() {
    const modal = document.getElementById("logout-modal");
    if (modal) {
        modal.classList.remove("active");
        modal.style.display = "none";
    }
}