document.addEventListener(
    "DOMContentLoaded",
    loadUserBookings
);

let allBookings = [];

async function loadUserBookings(){

    try{

        const res =
            await fetch(
                "src/get_user_bookings.php"
            );

        const data =
            await res.json();

        if(!data.success){

            console.error(data.message);

            return;
        }

        allBookings = data.bookings;

        populateServiceFilter();

        renderBookings(allBookings);

    }catch(err){

        console.error(err);

    }
}

function populateServiceFilter(){

    const serviceFilter =
        document.getElementById(
            "service-filter"
        );

    const categories =
        [...new Set(
            allBookings.map(
                booking =>
                booking.category_name
            )
        )];

    categories.forEach(category => {

        const option =
            document.createElement("option");

        option.value = category;

        option.textContent = category;

        serviceFilter.appendChild(option);

    });

}

function renderBookings(bookings){

    const tbody =
        document.getElementById(
            "requests-table-body"
        );

    tbody.innerHTML = "";

    if(bookings.length === 0){

        tbody.innerHTML = `
        <tr>
            <td colspan="6" class="empty-row">
                No requests found.
            </td>
        </tr>
        `;

        return;
    }

    bookings.forEach(booking => {

        const row =
            document.createElement("tr");

        row.innerHTML = `

        <td class="svc-cell">

            <div class="svc-icon">
                <i class="${booking.service_icon}"></i>
            </div>

            <div>
                <div class="svc-title">
                    ${booking.category_name}
                </div>

                <div class="svc-sub">
                    ${booking.service_name}
                </div>
            </div>

        </td>

        <td>
            ${getModeHTML(
                booking.location_type,
                booking.mode_icon
            )}
        </td>

        <td>
            ${formatDate(
                booking.created_at
            )}
        </td>

        <td>
            ${formatSchedule(
                booking.booking_date,
                booking.slot_label
            )}
        </td>

        <td>
            ${getStatusHTML(
                booking.status
            )}
        </td>

        <td>

            <div class="actions">

                <a
                    href="customer.html?booking_id=${booking.booking_id}#request-details"
                    class="icon-btn"
                >
                    <i class="fa-solid fa-eye"></i>
                </a>

                ${booking.status !== "cancelled"
                && booking.status !== "completed"
                ? `
                <button
                    class="icon-btn danger"
                    onclick="cancelBooking(${booking.booking_id})"
                >
                    <i class="fa-solid fa-xmark"></i>
                </button>
                `
                :
                `
                <button class="icon-btn disabled">
                    <i class="fa-solid fa-xmark"></i>
                </button>
                `
                }

            </div>

        </td>
        `;

        tbody.appendChild(row);

    });

}

function getModeHTML(mode, icon) {

    let className = "walkin";
    const lower   = mode.toLowerCase();

    if      (lower.includes("online")) className = "online";
    else if (lower.includes("home"))   className = "home";

    // Fallback so <i> always has a valid FA class even if DB returns null
    const fallbackIcon = {
        online: "fa-solid fa-video",
        home:   "fa-solid fa-house",
        walkin: "fa-solid fa-shop",
    };

    const resolvedIcon = icon || fallbackIcon[className];

    return `
    <span class="tag ${className}">
        <i class="${resolvedIcon}"></i>
        ${mode}
    </span>
    `;
}

function getStatusHTML(status){

    let label = status;
    let className = status;

    switch(status){

        case "approved":

            label = "Confirmed";

            className = "confirmed";

            break;

        case "pending":

            label = "Pending Review";

            className = "pending";

            break;

        case "waiting":

            label = "Waiting for Acceptance";

            className = "waiting";

            break;

        case "cancelled":

            label = "Cancelled";

            className = "cancelled";

            break;

        case "completed":

            label = "Completed";

            className = "completed";

            break;
    }

    return `
    <span class="status ${className}">
        ${label}
    </span>
    `;
}

function formatDate(dateString){

    return new Date(dateString)
    .toLocaleString(
        "en-US",
        {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true
        }
    );
}
function formatSchedule(date, slot){

    return `
    <div class="schedule-cell">
        <div>${formatScheduleDate(date)}</div>
        <div class="schedule-slot">
            ${slot ?? "No Slot"}
        </div>
    </div>
    `;
}
function formatScheduleDate(dateString){

    return new Date(dateString)
    .toLocaleDateString(
        "en-US",
        {
            month: "short",
            day: "numeric",
            year: "numeric"
        }
    );
}

async function cancelBooking(id){

    const confirmed =
        confirm(
            "Are you sure you want to cancel this request?"
        );

    if(!confirmed) return;

    const formData =
        new FormData();

    formData.append(
        "booking_id",
        id
    );

    const res =
        await fetch(
            "src/cancel_booking.php",
            {
                method: "POST",
                body: formData
            }
        );

    const data =
        await res.json();

    if(data.success){

        loadUserBookings();

    }else{

        alert(data.message);

    }
}

document
.getElementById("status-filter")
.addEventListener(
    "change",
    applyFilters
);

document
.getElementById("service-filter")
.addEventListener(
    "change",
    applyFilters
);

document
.getElementById("sort-filter")
.addEventListener(
    "change",
    applyFilters
);

function applyFilters(){

    const status =
        document.getElementById(
            "status-filter"
        ).value;

    const service =
        document.getElementById(
            "service-filter"
        ).value;

    const sort =
        document.getElementById(
            "sort-filter"
        ).value;

    let filtered =
        [...allBookings];

    if(status !== "all"){

        filtered =
            filtered.filter(
                booking =>
                booking.status === status
            );
    }

    if(service !== "all"){

        filtered =
            filtered.filter(
                booking =>
                booking.category_name === service
            );
    }

    filtered.sort((a,b) => {

        if(sort === "newest"){

            return new Date(b.created_at)
            - new Date(a.created_at);

        }else{

            return new Date(a.created_at)
            - new Date(b.created_at);
        }

    });

    renderBookings(filtered);

}

function getStatusHTML(status) {
    let label     = "Pending Review";
    let className = "pending";

    switch (status) {
        case "approved":
        case "confirmed":
            label     = "Confirmed";
            className = "confirmed";
            break;
        case "pending":
            label     = "Pending Review";
            className = "pending";
            break;
        case "waiting":
            label     = "Waiting For Acceptance";
            className = "waiting";
            break;
        case "awaiting_payment":
            label     = "Awaiting Payment";
            className = "awaiting-payment";
            break;
        case "cancelled":
            label     = "Cancelled";
            className = "cancelled";
            break;
        case "completed":
            label     = "Completed";
            className = "completed";
            break;
    }

    return `<span class="status ${className}">${label}</span>`;
}