// scripts/customer-chat.js
// ─────────────────────────────────────────────────────────────────
//  Customer chat — real-time polling + typing indicator
//  Requires: check_session.php stores $_SESSION['role_id']
// ─────────────────────────────────────────────────────────────────

(function () {
    "use strict";

    /* ── DOM refs ─────────────────────────────────────────────── */
    const feed        = document.querySelector(".msg-feed");
    const textarea    = document.querySelector(".msg-textarea");
    const sendBtn     = document.querySelector(".msg-send-btn");
    const fileInput = document.getElementById("customer-msg-file");
    const attachBtn   = document.querySelector(".msg-attach-btn");

    if (!feed || !textarea || !sendBtn) return; // section not on page

    /* ── State ────────────────────────────────────────────────── */
    let lastMessageId   = 0;
    let typingTimer     = null;
    let isTyping        = false;
    let typingBubble    = null;
    let pollInterval    = null;
    let typingPollInt   = null;
    let pendingFiles    = [];     // files queued before send
    let lastDateLabel   = "";

    /* ── Init ─────────────────────────────────────────────────── */
    function init() {
        // Seed last_id from existing static HTML messages
        const existing = feed.querySelectorAll("[data-msg-id]");
        existing.forEach(el => {
            const id = parseInt(el.dataset.msgId, 10);
            if (id > lastMessageId) lastMessageId = id;
        });

        startPolling();
        bindEvents();
        bindLightbox();
    }

    /* ── Polling ─────────────────────────────────────────────── */
    function startPolling() {
        pollMessages();
        pollInterval   = setInterval(pollMessages,   2000);
        typingPollInt  = setInterval(pollTyping,     1000);
    }

    async function pollMessages() {
        try {
            const res  = await fetch(`src/get_messages.php?last_id=${lastMessageId}`);
            const data = await res.json();
            if (!data.success || !data.messages.length) return;

            data.messages.forEach(renderMessage);
            scrollToBottom();
        } catch (e) { /* silent fail — network blip */ }
    }

    async function pollTyping() {
        try {
            const res  = await fetch("src/get_typing.php");
            const data = await res.json();
            data.is_typing ? showTypingIndicator() : hideTypingIndicator();
        } catch (e) { /* silent */ }
    }

    /* ── Render a message ────────────────────────────────────── */
    function renderMessage(msg) {
        if (lastMessageId >= msg.message_id) return;

        lastMessageId = parseInt(msg.message_id, 10);

        // REMOVE EMPTY STATE
        const emptyState = document.getElementById("customer-chat-empty");
        if (emptyState) {
            emptyState.remove();
        }

        const isOutgoing = parseInt(msg.sender_role, 10) !== 1;

        // Date separator
        if (msg.date_label !== lastDateLabel) {
            lastDateLabel = msg.date_label;

            const sep = document.createElement("div");
            sep.className = "msg-date-sep";
            sep.textContent = msg.date_label;

            feed.appendChild(sep);
        }

        const row = document.createElement("div");
        row.className = `msg-row${isOutgoing ? " msg-row-out" : ""}`;
        row.dataset.msgId = msg.message_id;

        // Incoming avatar
        if (!isOutgoing) {
            const av = document.createElement("div");
            av.className = "msg-av";
            av.textContent = "A";
            row.appendChild(av);
        }

        // Bubble
        const bubble = document.createElement("div");
        bubble.className =
            `msg-bubble ${isOutgoing
                ? "msg-bubble-out bubble-animate-out"
                : "msg-bubble-in bubble-animate"}`;

        // Text
        if (msg.message_text) {
            const txt = document.createElement("span");
            txt.textContent = msg.message_text;
            bubble.appendChild(txt);
        }

        // Attachments
        if (msg.attachment_name) {
            bubble.appendChild(
                isImageFile(msg.attachment_name)
                    ? buildInlineImage(msg)
                    : buildFileChip(msg)
            );
        }

        // Time
        const time = document.createElement("div");
        time.className = "msg-time";
        time.textContent = msg.time_label;

        bubble.appendChild(time);

        row.appendChild(bubble);
        feed.appendChild(row);
    }

        function buildInlineImage(msg) {
        const img = document.createElement("img");
        img.className = "msg-bubble-img";
        img.src = msg.attachment_path;
        img.alt = msg.attachment_name;
        img.loading = "lazy";

        img.addEventListener("click", () => {
            openLightbox(msg.attachment_path);
        });

        return img;
    }

    /* ── File chip inside a bubble ───────────────────────────── */
    function buildFileChip(msg) {
        const chip = document.createElement("div");
        chip.className = "msg-file-chip";
        chip.style.cursor = "pointer";
        chip.onclick = () => window.open(msg.attachment_path, "_blank");

        const icon = isImageFile(msg.attachment_name)
            ? "fa-solid fa-file-image"
            : "fa-solid fa-file-lines";

        chip.innerHTML = `
            <i class="${icon}"></i>
            <span>${escHtml(msg.attachment_name)}</span>
            ${msg.attachment_size ? `<small style="opacity:.7">${escHtml(msg.attachment_size)}</small>` : ""}
        `;
        return chip;
    }

    /* ── Typing indicator ─────────────────────────────────────── */
    function showTypingIndicator() {
        if (typingBubble) return;

        typingBubble = document.createElement("div");
        typingBubble.className = "msg-row";
        typingBubble.id = "typing-indicator";
        typingBubble.innerHTML = `
            <div class="msg-av">A</div>
            <div class="typing-bubble">
                <div class="typing-dots-wrap admin-typing">
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                </div>
            </div>
        `;
        feed.appendChild(typingBubble);
        scrollToBottom();
    }

    function hideTypingIndicator() {
        if (!typingBubble) return;
        const inner = typingBubble.querySelector(".typing-bubble");
        if (inner) inner.classList.add("fade-out");
        setTimeout(() => {
            typingBubble?.remove();
            typingBubble = null;
        }, 250);
    }

    /* ── Send ────────────────────────────────────────────────── */
    function bindEvents() {
        sendBtn.addEventListener("click", sendMessage);

        textarea.addEventListener("keydown", e => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Auto-resize textarea
        textarea.addEventListener("input", () => {
            textarea.style.height = "auto";
            textarea.style.height = Math.min(textarea.scrollHeight, 100) + "px";
            handleTypingNotify();
        });

        // File attach
        if (fileInput) {
            fileInput.addEventListener("change", () => {
                pendingFiles = Array.from(fileInput.files);
                renderPendingFiles();
                fileInput.value = "";
            });
        }
    }

    async function sendMessage() {
        const text = textarea.value.trim();
        if (!text && pendingFiles.length === 0) return;

        sendBtn.classList.add("btn-send-flash");
        setTimeout(() => sendBtn.classList.remove("btn-send-flash"), 200);

        // Build form data (supports file)
        const formData = new FormData();
        formData.append("message", text);
        if (pendingFiles.length > 0) {
            formData.append("attachment", pendingFiles[0]);
        }

        textarea.value = "";
        textarea.style.height = "auto";
        pendingFiles = [];
        clearPendingFiles();
        stopTyping();

        try {
            const res  = await fetch("src/send_message.php", { method: "POST", body: formData });
            const data = await res.json();
            if (!data.success) console.error("Send failed:", data.error);
            else pollMessages(); // immediate refresh
        } catch (e) {
            console.error("Send error:", e);
        }
    }

    /* ── Typing notifications ────────────────────────────────── */
    function handleTypingNotify() {
        if (!isTyping) {
            isTyping = true;
            notifyTyping(true);
        }
        clearTimeout(typingTimer);
        typingTimer = setTimeout(stopTyping, 2500);
    }

    function stopTyping() {
        if (!isTyping) return;
        isTyping = false;
        clearTimeout(typingTimer);
        notifyTyping(false);
    }

    async function notifyTyping(state) {
        try {
            await fetch("src/set_typing.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_typing: state })
            });
        } catch (e) { /* silent */ }
    }

    /* ── Pending file preview ────────────────────────────────── */
    /* ── Pending file preview ────────────────────────────────── */
function renderPendingFiles() {

    const container = document.getElementById("customer-attach-preview");

    if (!container) return;

    container.innerHTML = "";

    if (pendingFiles.length === 0) {
        container.style.display = "none";
        return;
    }

    container.style.display = "flex";
    container.style.flexWrap = "wrap";
    container.style.gap = "8px";
    container.style.marginBottom = "10px";

    pendingFiles.forEach((file, idx) => {

        const chip = document.createElement("div");

        chip.className = "attach-chip";

        chip.innerHTML = `
            <i class="${isImageFile(file.name)
                ? "fa-solid fa-file-image"
                : "fa-solid fa-file-lines"}"></i>

            <span>${escHtml(file.name)}</span>

            <span class="attach-chip-remove" data-idx="${idx}">
                ×
            </span>
        `;

        chip.querySelector("[data-idx]").onclick = () => {
            pendingFiles.splice(idx, 1);
            renderPendingFiles();
        };

        container.appendChild(chip);
    });
}

function clearPendingFiles() {
    const container = document.getElementById("customer-attach-preview");

    if (!container) return;

    container.innerHTML = "";
    container.style.display = "none";
}

    /* ── Helpers ─────────────────────────────────────────────── */
    function scrollToBottom() {
        feed.scrollTo({ top: feed.scrollHeight, behavior: "smooth" });
    }

    function escHtml(str) {
        if (!str) return "";
        return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    }

    function isImageFile(name) {
        return /\.(png|jpe?g|gif|webp)$/i.test(name ?? "");
    }

    function bindLightbox() {
        const lb = document.getElementById("img-lightbox");

        lb?.addEventListener("click", () => {
            lb.classList.remove("open");
        });
    }

    function openLightbox(src) {
        const lb = document.getElementById("img-lightbox");
        const img = document.getElementById("img-lightbox-src");

        if (!lb || !img) return;

        img.src = src;
        lb.classList.add("open");
    }

    /* ── Boot ─────────────────────────────────────────────────── */
    // Wait until session check confirms login
    document.addEventListener("chatReady", init);

    // Also expose for manual call after session_check
    window.initCustomerChat = init;

})();
