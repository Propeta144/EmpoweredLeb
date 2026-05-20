document.addEventListener("DOMContentLoaded", async () => {

    await loadCategories();

    setupDateLimit();

    setupFilePreview();

    setupBookingSubmit();

    loadBookingDetails();

    setupImageViewer();

    setupCancelBtn();

    setupAcceptBtn();

});


// ======================================================
// LOAD CATEGORIES
// ======================================================

async function loadCategories(){

    const res        = await fetch("src/get_categories.php");
    const categories = await res.json();
    const select     = document.getElementById("category-select");

    select.innerHTML = `<option value="">Select category</option>`;

    categories.forEach(cat => {
        select.innerHTML += `<option value="${cat.category_id}">${cat.category_name}</option>`;
    });
}


// ======================================================
// CATEGORY CHANGE
// ======================================================

document
.getElementById("category-select")
.addEventListener("change", async function(){

    const serviceSelect = document.getElementById("service-select");
    serviceSelect.innerHTML = `<option value="">Select service</option>`;

    const res      = await fetch(`src/get_services.php?category_id=${this.value}`);
    const services = await res.json();

    services.forEach(s => {
        serviceSelect.innerHTML += `<option value="${s.service_id}">${s.service_name}</option>`;
    });
});


// ======================================================
// SERVICE CHANGE
// ======================================================

document
.getElementById("service-select")
.addEventListener("change", async function(){

    const modeSelect = document.getElementById("mode-select");
    modeSelect.innerHTML = `<option value="">Select mode</option>`;

    const res  = await fetch(`src/get_service_details.php?service_id=${this.value}`);
    const data = await res.json();

    data.modes.forEach(m => {
        modeSelect.innerHTML += `<option value="${m.mode_name}">${m.mode_name}</option>`;
    });

    if(data.modes.length === 1){
        modeSelect.value = data.modes[0].mode_name;
    }
});


// ======================================================
// DATE LIMIT
// ======================================================

function setupDateLimit(){

    const input    = document.getElementById("booking-date");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    input.min = tomorrow.toISOString().split("T")[0];
}


// ======================================================
// DATE CHANGE → load time slots
// ======================================================

document
.getElementById("booking-date")
.addEventListener("change", async function(){
    if(this.value) loadTimeSlots(this.value);
});


async function loadTimeSlots(date){

    const res    = await fetch(`src/get_time_slots.php?date=${date}`);
    const slots  = await res.json();
    const select = document.getElementById("slot-select");

    select.innerHTML = `<option value="">Select time slot</option>`;

    slots.forEach(slot => {
        const disabled = slot.available == 0 ? "disabled" : "";
        const text     = slot.available == 0
            ? `${slot.slot_label} (Unavailable)`
            : slot.slot_label;
        select.innerHTML += `<option value="${slot.slot_id}" ${disabled}>${text}</option>`;
    });
}


// ======================================================
// FILE PREVIEW
// ======================================================

let selectedFiles = [];

function setupFilePreview(){

    const input      = document.getElementById("booking-files");
    const uploadZone = document.querySelector(".upload-zone");

    if(!input) return;

    input.addEventListener("change", handleFiles);

    uploadZone.addEventListener("dragover", e => {
        e.preventDefault();
        uploadZone.classList.add("dragging");
    });

    uploadZone.addEventListener("dragleave", () => {
        uploadZone.classList.remove("dragging");
    });

    uploadZone.addEventListener("drop", e => {
        e.preventDefault();
        uploadZone.classList.remove("dragging");
        processFiles(Array.from(e.dataTransfer.files));
    });
}

function handleFiles(e){
    processFiles(Array.from(e.target.files));
}

function processFiles(files){

    const allowed = ["image/png","image/jpeg","image/jpg","application/pdf"];

    for(const file of files){

        if(selectedFiles.length >= 3){
            alert("Maximum of 3 files only.");
            break;
        }

        if(!allowed.includes(file.type)){
            alert(`${file.name} is not a valid file type.`);
            continue;
        }

        selectedFiles.push(file);
    }

    syncFileInput();
    renderPreview();
}

function renderPreview(){

    const preview = document.getElementById("preview-container");
    preview.innerHTML = "";

    selectedFiles.forEach((file, index) => {

        const wrapper     = document.createElement("div");
        wrapper.className = "preview-image";

        if(file.type.startsWith("image/")){
            const img = document.createElement("img");
            img.src   = URL.createObjectURL(file);
            wrapper.appendChild(img);
        }else{
            const pdf       = document.createElement("div");
            pdf.className   = "preview-file";
            pdf.innerHTML   = `<i class="fa-solid fa-file-pdf"></i><span>${file.name}</span>`;
            wrapper.appendChild(pdf);
        }

        const removeBtn     = document.createElement("button");
        removeBtn.type      = "button";
        removeBtn.className = "remove-preview";
        removeBtn.innerHTML = "×";
        removeBtn.onclick   = () => removeFile(index);
        wrapper.appendChild(removeBtn);

        preview.appendChild(wrapper);
    });
}

function removeFile(index){
    selectedFiles.splice(index, 1);
    syncFileInput();
    renderPreview();
}

function syncFileInput(){
    const dt = new DataTransfer();
    selectedFiles.forEach(f => dt.items.add(f));
    document.getElementById("booking-files").files = dt.files;
}


// ======================================================
// SUBMIT BOOKING
// ======================================================

function setupBookingSubmit(){

    const form = document.getElementById("booking-form");

    form.addEventListener("submit", async e => {

        e.preventDefault();

        const formData = new FormData();
        formData.append("service_id",      document.getElementById("service-select").value);
        formData.append("location_type",   document.getElementById("mode-select").value);
        formData.append("booking_date",    document.getElementById("booking-date").value);
        formData.append("slot_id",         document.getElementById("slot-select").value);
        formData.append("concern_details", document.getElementById("concern-details").value);

        selectedFiles.forEach(file => formData.append("files[]", file));

        const res  = await fetch("src/create_booking.php", { method: "POST", body: formData });
        const data = await res.json();

        if(data.success){
            window.location.href = `customer.html?booking_id=${data.booking_id}#request-details`;
            form.reset();
            selectedFiles = [];
            renderPreview();
        }else{
            alert(data.message);
        }
    });
}


// ======================================================
// IMAGE VIEWER
// ======================================================

let imagePaths       = [];
let currentImageIndex = 0;

function setupImageViewer(){

    const viewer      = document.getElementById("image-viewer");
    const viewerImage = document.getElementById("viewer-image");
    const closeBtn    = document.getElementById("viewer-close");
    const prevBtn     = document.getElementById("viewer-prev");
    const nextBtn     = document.getElementById("viewer-next");

    document.addEventListener("click", e => {
        if(e.target.classList.contains("previewable-image")){
            currentImageIndex = parseInt(e.target.dataset.index);
            showViewerImage();
            viewer.classList.add("active");
        }
    });

    closeBtn.addEventListener("click", () => viewer.classList.remove("active"));

    viewer.addEventListener("click", e => {
        if(e.target === viewer) viewer.classList.remove("active");
    });

    prevBtn.addEventListener("click", () => {
        currentImageIndex = (currentImageIndex - 1 + imagePaths.length) % imagePaths.length;
        showViewerImage();
    });

    nextBtn.addEventListener("click", () => {
        currentImageIndex = (currentImageIndex + 1) % imagePaths.length;
        showViewerImage();
    });

    document.addEventListener("keydown", e => {
        if(e.key === "Escape") viewer.classList.remove("active");
    });

    function showViewerImage(){
        viewerImage.src = imagePaths[currentImageIndex];
    }
}


// ======================================================
// LOAD BOOKING DETAILS
// ======================================================

async function loadBookingDetails(){

    const params    = new URLSearchParams(window.location.search);
    const bookingId = params.get("booking_id");

    if(!bookingId) return;

    const res  = await fetch(`src/get_booking_details.php?booking_id=${bookingId}`);
    const data = await res.json();

    const booking = data.booking;

    // Populate static fields
    document.getElementById("detail-service").innerText  = booking.service_name;
    document.getElementById("detail-mode").innerText     = booking.location_type;
    document.getElementById("detail-schedule").innerText = `${booking.booking_date} — ${booking.slot_label}`;
    document.getElementById("detail-concern").innerText  = booking.concern_details;
    document.getElementById("detail-created").innerText  = booking.created_at;

    // Files
    const filesContainer = document.getElementById("detail-files");
    filesContainer.innerHTML = "";

    data.files.forEach(file => {

        const ext  = file.file_name.split(".").pop().toLowerCase();
        const path = `uploads/${file.file_name}`;

        if(["jpg","jpeg","png","webp"].includes(ext)){
            filesContainer.innerHTML += `
                <img
                    src="${path}"
                    class="detail-image previewable-image"
                    data-index="${imagePaths.length}"
                >
            `;
            imagePaths.push(path);
        }else{
            filesContainer.innerHTML += `
                <a href="${path}" target="_blank" class="detail-pdf">
                    <i class="fa-solid fa-file-pdf"></i>
                    ${file.file_name}
                </a>
            `;
        }
    });

    // Pass full booking data so renderBookingStatus can read quotation fields
    renderBookingStatus(booking);
    // ── In loadBookingDetails, after renderBookingStatus(booking): ──
    renderCustomerStatusTracker(booking, data.history || []);
}


// ======================================================
// RENDER BOOKING STATUS
//
//  pending   → waiting placeholders, cancel visible
//  waiting   → show price + note, Accept + Cancel visible
//  confirmed → show price + note, Cancel visible only
//  completed → show price + note, no buttons
//  cancelled → show note if exists, no buttons
// ======================================================

function renderBookingStatus(booking){

    const status      = booking.status;
    const amount      = booking.quotation_amount;
    const notes       = booking.admin_notes;

    const statusEl    = document.getElementById("detail-status");
    const noticeEl    = document.getElementById("detail-notice");
    const quotationEl = document.getElementById("quotation-placeholder");
    const responseEl  = document.getElementById("response-placeholder");
    const cancelBtn   = document.getElementById("cancel-request-btn");
    const acceptBtn   = document.getElementById("accept-quotation-btn");

    // ── helpers ──────────────────────────────────────────────────

    const hideBtn = btn => {
        btn.style.display    = "none";
        btn.disabled         = true;
    };

    const showBtn = (btn, display = "block") => {
        btn.style.display = display;
        btn.disabled      = false;
    };

    const priceBlock = amt => `
        <div style="text-align:center;padding:8px 0;">
            <div style="font-size:28px;font-weight:800;color:var(--primary);">
                ₱${parseFloat(amt).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">
                Quoted amount
            </div>
        </div>
    `;

    const noteBlock = n => n
        ? `<p style="font-size:13px;line-height:1.7;color:var(--text-muted);">${n}</p>`
        : `<p style="font-size:13px;color:var(--text-light);">No notes provided.</p>`;

    // ── status label & class ──────────────────────────────────────

    const labels = {
        pending:          ["Pending Review",           "pending"],
        waiting:          ["Waiting For Acceptance",   "waiting"],
        confirmed:        ["Confirmed",                "confirmed"],
        awaiting_payment: ["Awaiting Payment",         "awaiting-payment"],
        completed:        ["Completed",                "reviewed"],
        cancelled:        ["Cancelled",                "cancelled"],
    };

    const [label, cls] = labels[status] ?? ["Unknown", "pending"];
    statusEl.className  = `status-pill ${cls}`;
    statusEl.innerText  = label;

    // ── per-status logic ──────────────────────────────────────────

    switch(status){

        // 1. PENDING ─────────────────────────────────────────────
        case "pending":

            noticeEl.innerHTML = `
                <i class="fa-solid fa-circle-info"></i>
                <p>Your request is currently under review.
                   The admin will send a quotation once they evaluate it.</p>
            `;

            quotationEl.innerHTML = `
                <i class="fa-solid fa-file-invoice"></i><br><br>
                Quotation will appear here after admin review.
            `;

            responseEl.innerHTML = `
                <i class="fa-solid fa-comment-dots"></i><br><br>
                No response yet. Check back soon.
            `;

            hideBtn(acceptBtn);
            showBtn(cancelBtn);
            break;

        // 2. WAITING ─────────────────────────────────────────────
        case "waiting":

            noticeEl.innerHTML = `
                <i class="fa-solid fa-circle-info"></i>
                <p>The admin has sent a quotation. Please review the price
                   and either <strong>Accept</strong> or <strong>Cancel</strong> your request.</p>
            `;

            quotationEl.innerHTML = priceBlock(amount ?? 0);

            responseEl.innerHTML = noteBlock(notes);

            showBtn(acceptBtn);
            showBtn(cancelBtn);
            break;

        // 3. CONFIRMED ───────────────────────────────────────────
        case "confirmed":

            noticeEl.innerHTML = `
                <i class="fa-solid fa-circle-check"></i>
                <p>Your booking is confirmed! The technician will reach out to you
                   regarding your appointment.</p>
            `;

            quotationEl.innerHTML = priceBlock(amount ?? 0);

            responseEl.innerHTML = noteBlock(notes);

            hideBtn(acceptBtn);
            showBtn(cancelBtn);
            break;

        // Add to the switch in renderBookingStatus:

        // 3.5 AWAITING PAYMENT ────────────────────────────────────
        case "awaiting_payment":

            noticeEl.innerHTML = `
                <i class="fa-solid fa-credit-card"></i>
                <p>Your service has been completed. Please settle the payment
                so the admin can mark this booking as fully done.</p>
            `;

            quotationEl.innerHTML = priceBlock(amount ?? 0);

            responseEl.innerHTML = noteBlock(notes);

            statusEl.className = "status-pill awaiting-payment";
            statusEl.innerText = "Awaiting Payment";

            hideBtn(acceptBtn);
            showBtn(cancelBtn);
            break;

        // 4. COMPLETED ───────────────────────────────────────────
        case "completed":

            noticeEl.innerHTML = `
                <i class="fa-solid fa-circle-check"></i>
                <p>This request has been completed. Thank you for choosing our services!</p>
            `;

            quotationEl.innerHTML = priceBlock(amount ?? 0);

            responseEl.innerHTML = noteBlock(notes);

            hideBtn(acceptBtn);
            hideBtn(cancelBtn);
            break;

        // 5. CANCELLED ───────────────────────────────────────────
        case "cancelled":

            noticeEl.innerHTML = `
                <i class="fa-solid fa-face-frown"></i>
                <p>This request has been cancelled.</p>
            `;

            quotationEl.innerHTML = `
                <i class="fa-solid fa-ban"></i><br><br>
                This request has been cancelled.
            `;

            // Show admin note if one exists, otherwise generic message
            responseEl.innerHTML = notes
                ? `<p style="font-size:13px;line-height:1.7;color:var(--text-muted);">${notes}</p>`
                : `<i class="fa-solid fa-ban"></i><br><br>This request has been cancelled.`;

            hideBtn(acceptBtn);
            hideBtn(cancelBtn);
            break;
    }
}


// ======================================================
// ACCEPT QUOTATION
// Customer clicks Accept → waiting → confirmed
// ======================================================

function setupAcceptBtn(){

    document
    .getElementById("accept-quotation-btn")
    .addEventListener("click", async () => {

        const confirmed = confirm(
            "Accept this quotation and confirm your booking?"
        );

        if(!confirmed) return;

        const bookingId =
            new URLSearchParams(window.location.search).get("booking_id");

        if(!bookingId){
            alert("Booking not found.");
            return;
        }

        try{

            const formData = new FormData();
            formData.append("booking_id", bookingId);

            const res  = await fetch("src/confirm_booking.php", {
                method: "POST",
                body:   formData,
            });

            const data = await res.json();

            if(data.success){
                alert("Booking confirmed! We'll be in touch shortly.");
                location.reload();
            }else{
                alert(data.message);
            }

        }catch(err){
            console.error(err);
            alert("Something went wrong. Please try again.");
        }
    });
}


// ======================================================
// CANCEL REQUEST
// ======================================================

function setupCancelBtn(){

    document
    .getElementById("cancel-request-btn")
    .addEventListener("click", async () => {

        const confirmCancel = confirm(
            "Are you sure you want to cancel this request?"
        );

        if(!confirmCancel) return;

        const bookingId =
            new URLSearchParams(window.location.search).get("booking_id");

        if(!bookingId){
            alert("Booking not found.");
            return;
        }

        try{

            const formData = new FormData();
            formData.append("booking_id", bookingId);

            const res  = await fetch("src/cancel_booking.php", {
                method: "POST",
                body:   formData,
            });

            const data = await res.json();

            if(data.success){
                alert("Request cancelled successfully.");
                window.location.href = "customer.html";
            }else{
                alert(data.message);
            }

        }catch(err){
            console.error(err);
            alert("Something went wrong while cancelling.");
        }
    });
}

// ======================================================
// STATUS PROGRESS TRACKER (Customer)
// ======================================================

function renderCustomerStatusTracker(booking, history) {

    const steps = [
        { key: "pending",          label: "Request Submitted",  icon: "fa-solid fa-file-lines"     },
        { key: "waiting",          label: "Quote Sent",         icon: "fa-solid fa-file-invoice"   },
        { key: "confirmed",        label: "Booking Confirmed",  icon: "fa-solid fa-circle-check"   },
        { key: "awaiting_payment", label: "Awaiting Payment",   icon: "fa-solid fa-credit-card"    },
        { key: "completed",        label: "Completed",          icon: "fa-solid fa-flag-checkered" },
    ];

    const statusOrder  = ["pending","waiting","confirmed","awaiting_payment","completed"];
    const normStatus   = booking.status === "approved" ? "confirmed" : booking.status;
    const currentIndex = statusOrder.indexOf(normStatus);
    const isCancelled  = booking.status === "cancelled";

    // Build timestamp map from history
    const timestamps = { pending: booking.created_at };
    (history || []).forEach(h => {
        const s = h.new_status === "approved" ? "confirmed" : h.new_status;
        if (!timestamps[s]) timestamps[s] = h.changed_at;
    });

    let html = `<div class="customer-tracker">`;

    if (isCancelled) {
        const lastDone = Math.max(
            ...(history || [])
                .filter(h => h.new_status !== "cancelled")
                .map(h => {
                    const s = h.new_status === "approved" ? "confirmed" : h.new_status;
                    return statusOrder.indexOf(s);
                }),
            0
        );
        steps.forEach((step, i) => {
            const state = i <= lastDone ? "done" : "upcoming";
            html += customerTrackerStep(step, state, timestamps[step.key]);
        });
        const cancelTs = (history || []).filter(h => h.new_status === "cancelled").pop();
        html += `
        <div class="tracker-step cancelled">
            <div class="tracker-icon"><i class="fa-solid fa-ban"></i></div>
            <div class="tracker-body">
                <div class="tracker-label">Request Cancelled</div>
                ${cancelTs ? `<div class="tracker-time">${trackerDate(cancelTs.changed_at)}</div>` : ""}
            </div>
        </div>`;
    } else {
        steps.forEach((step, i) => {
            let state = "upcoming";
            if (i < currentIndex)  state = "done";
            if (i === currentIndex) state = "current";
            html += customerTrackerStep(step, state, timestamps[step.key]);
        });
    }

    html += `</div>`;

    // Inject as a card in the left column, before the notice
    const noticeEl = document.getElementById("detail-notice");
    if (noticeEl && !document.getElementById("customer-tracker-card")) {
        const card = document.createElement("div");
        card.id        = "customer-tracker-card";
        card.className = "req-card";
        card.style.marginBottom = "20px";
        card.innerHTML = `
            <div class="req-card-head">
                <h4><i class="fa-solid fa-timeline" style="margin-right:8px;color:var(--primary);"></i>Request Progress</h4>
            </div>
            <div class="req-card-body">${html}</div>
        `;
        noticeEl.parentElement.insertBefore(card, noticeEl);
    }
}

function customerTrackerStep(step, state, timestamp) {
    return `
    <div class="tracker-step ${state}">
        <div class="tracker-icon"><i class="${step.icon}"></i></div>
        <div class="tracker-body">
            <div class="tracker-label">${step.label}</div>
            ${timestamp
                ? `<div class="tracker-time">${trackerDate(timestamp)}</div>`
                : (state === "upcoming"
                    ? `<div class="tracker-time upcoming-hint">Upcoming</div>`
                    : "")}
        </div>
    </div>`;
}

function trackerDate(dateString) {
    if (!dateString) return "";
    return new Date(dateString).toLocaleString("en-US", {
        month: "short", day: "numeric", year: "numeric",
        hour: "numeric", minute: "2-digit", hour12: true,
    });
}