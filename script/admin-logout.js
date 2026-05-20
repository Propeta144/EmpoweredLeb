document.addEventListener("DOMContentLoaded", () => {

    const logoutBtn = document.getElementById("admin-logout-btn");

    if (!logoutBtn) return;

    logoutBtn.addEventListener("click", async (e) => {

        e.preventDefault();

        const confirmed = confirm("Are you sure you want to logout?");

        if (!confirmed) return;

        try {

            const res = await fetch("src/admin_logout.php", {
                method: "POST"
            });

            const data = await res.json();

            if (data.success) {

                // Redirect to customer homepage
                window.location.href = "customer.html";

            } else {

                alert("Logout failed.");

            }

        } catch (err) {

            console.error(err);
            alert("Server error during logout.");

        }

    });

});