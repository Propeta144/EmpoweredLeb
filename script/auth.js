// ============================================================
// script/auth.js  (UPDATED)
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

    // ── LOGIN ────────────────────────────────────────────────
    const loginBtn = document.getElementById("login-btn");
    if (loginBtn) {
        loginBtn.addEventListener("click", async () => {
            const email    = document.getElementById("login_email").value.trim();
            const password = document.getElementById("login_password").value;
            const error    = document.getElementById("login-error");

            error.textContent = "";
            hideVerificationBanner();

            if (!email || !password) {
                error.textContent = "Please fill in all fields.";
                return;
            }

            loginBtn.disabled    = true;
            loginBtn.textContent = "Logging in…";

            try {
                const formData = new FormData();
                formData.append("email", email);
                formData.append("password", password);

                const res  = await fetch("src/login.php", { method: "POST", body: formData });
                const data = await res.json();

                if (data.success) {
                    window.location.href = "customer.html";
                } else if (data.needs_verification) {
                    showVerificationBanner(data.email || email);
                } else {
                    error.textContent = data.message;
                }
            } catch {
                error.textContent = "Server error. Try again.";
            } finally {
                loginBtn.disabled    = false;
                loginBtn.textContent = "Log In";
            }
        });
    }

    // ── SIGNUP ───────────────────────────────────────────────
    const signupBtn = document.getElementById("signup-btn");
    if (signupBtn) {
        signupBtn.addEventListener("click", async () => {
            const first   = document.getElementById("first_name").value.trim();
            const last    = document.getElementById("last_name").value.trim();
            const email   = document.getElementById("signup_email").value.trim();
            const phone   = document.getElementById("phone").value.trim();
            const password = document.getElementById("password").value;
            const confirm  = document.getElementById("confirm_password").value;
            const error    = document.getElementById("signup-error");

            error.textContent = "";

            if (!first || !last || !email || !phone || !password || !confirm) {
                error.textContent = "All fields are required.";
                return;
            }
            if (password !== confirm) {
                error.textContent = "Passwords do not match.";
                return;
            }
            signupBtn.disabled    = true;
            signupBtn.textContent = "Creating account…";

            try {
                const formData = new FormData();
                formData.append("first_name", first);
                formData.append("last_name",  last);
                formData.append("email",      email);
                formData.append("phone",      phone);
                formData.append("password",   password);

                const res  = await fetch("src/signup.php", { method: "POST", body: formData });
                const data = await res.json();

                if (data.success) {
                    if (data.needs_verification) {
                        // Switch to login tab and show the "check your email" notice
                        document.getElementById("loginTab").click();
                        showSignupSuccessBanner(email);
                    } else {
                        window.location.href = "customer.html";
                    }
                } else {
                    error.textContent = data.message;
                }
            } catch {
                error.textContent = "Server error. Try again.";
            } finally {
                signupBtn.disabled    = false;
                signupBtn.textContent = "Create Account";
            }
        });
    }

    // ── RESEND VERIFICATION (banner button) ──────────────────
    document.addEventListener("click", async (e) => {
        if (e.target && e.target.id === "resend-btn") {
            const email       = e.target.dataset.email;
            const resendBtn   = e.target;
            resendBtn.disabled    = true;
            resendBtn.textContent = "Sending…";

            try {
                const fd = new FormData();
                fd.append("email", email);
                const res  = await fetch("src/resend_verification.php", { method: "POST", body: fd });
                const data = await res.json();
                resendBtn.textContent = data.success ? "Sent ✓" : "Error — try again";
                if (!data.success) resendBtn.disabled = false;
            } catch {
                resendBtn.textContent = "Error — try again";
                resendBtn.disabled = false;
            }
        }
    });

    // ── PASSWORD TOGGLE ─────────────────────────────
document.querySelectorAll(".password-toggle").forEach(btn => {

    btn.addEventListener("click", () => {

        const targetId = btn.dataset.target;
        const input = document.getElementById(targetId);
        const icon = btn.querySelector("i");

        if (input.type === "password") {
            input.type = "text";
            icon.classList.remove("fa-eye");
            icon.classList.add("fa-eye-slash");
        } else {
            input.type = "password";
            icon.classList.remove("fa-eye-slash");
            icon.classList.add("fa-eye");
        }

    });

});

});

// ── Banner helpers ───────────────────────────────────────────

function showVerificationBanner(email) {
    let banner = document.getElementById("verification-banner");
    if (!banner) {
        banner = document.createElement("div");
        banner.id = "verification-banner";
        banner.style.cssText = `
            background:#eff6ff; border:1px solid #93c5fd; border-radius:10px;
            padding:16px 18px; margin-bottom:16px; font-size:14px; color:#1e40af;
            display:flex; align-items:flex-start; gap:12px;
        `;
        banner.innerHTML = `
            <i class="fa-solid fa-envelope" style="margin-top:2px; flex-shrink:0;"></i>
            <div>
                <strong>Check your email</strong>
                <p style="margin:4px 0 8px;">
                    Your email address hasn't been verified yet.
                    We sent a link to <strong id="banner-email"></strong>.
                </p>
                <button id="resend-btn" class="btn btn-outline" style="font-size:13px; padding:6px 14px;">
                    Resend verification email
                </button>
            </div>
        `;
        const loginForm = document.getElementById("loginForm");
        loginForm.insertBefore(banner, loginForm.firstChild);
    }

    document.getElementById("banner-email").textContent = email;
    document.getElementById("resend-btn").dataset.email = email;
    document.getElementById("resend-btn").disabled    = false;
    document.getElementById("resend-btn").textContent = "Resend verification email";
    banner.style.display = "flex";
}

function showSignupSuccessBanner(email) {
    let banner = document.getElementById("signup-success-banner");
    if (!banner) {
        banner = document.createElement("div");
        banner.id = "signup-success-banner";
        banner.style.cssText = `
            background:#f0fdf4; border:1px solid #86efac; border-radius:10px;
            padding:16px 18px; margin-bottom:16px; font-size:14px; color:#166534;
            display:flex; align-items:flex-start; gap:12px;
        `;
        banner.innerHTML = `
            <i class="fa-solid fa-circle-check" style="margin-top:2px; flex-shrink:0;"></i>
            <div>
                <strong>Account created!</strong>
                <p style="margin:4px 0 0;">
                    A verification link was sent to <strong id="success-banner-email"></strong>.
                    Please verify your email before logging in.
                </p>
            </div>
        `;
        const loginForm = document.getElementById("loginForm");
        loginForm.insertBefore(banner, loginForm.firstChild);
    }

    document.getElementById("success-banner-email").textContent = email;
    banner.style.display = "flex";
}

function hideVerificationBanner() {
    const b = document.getElementById("verification-banner");
    if (b) b.style.display = "none";
}