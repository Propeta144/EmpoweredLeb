// scripts/admin-chat.js  (full rewrite)
// ─────────────────────────────────────────────────────────────────
(function () {
    "use strict";

    /* ── DOM ──────────────────────────────────────────────────── */
    const convoList    = document.getElementById("convo-list");
    const msgFeed      = document.getElementById("msg-feed");
    const sendBtn      = document.getElementById("admin-send-btn");
    const textarea     = document.getElementById("admin-message-input");
    const fileInput    = document.getElementById("admin-file-input");
    const attachPrev   = document.getElementById("admin-attach-preview");
    const searchInput  = document.getElementById("convo-search");
    const topbarAv     = document.getElementById("topbar-av");
    const topbarName   = document.getElementById("topbar-name");
    const subtitle     = document.getElementById("msg-unread-subtitle");

    if (!convoList || !msgFeed) return;

    /* ── State ────────────────────────────────────────────────── */
    let activeClientId = null;
    let lastMessageId  = 0;
    let lastDateLabel  = "";
    let typingTimer    = null;
    let isTyping       = false;
    let typingBubble   = null;
    let pendingFiles   = [];
    let conversations  = [];

    let pollInterval   = null;
    let typingPollInt  = null;
    let convoPollInt   = null;

    /* ── Boot ─────────────────────────────────────────────────── */
    function init() {
        bindEvents();
        bindLightbox();
        loadConversations();
        convoPollInt = setInterval(loadConversations, 5000);
    }

    /* ── Conversations sidebar ───────────────────────────────── */
    async function loadConversations() {
        try {
            const res  = await fetch("src/get_conversations.php");
            const data = await res.json();
            if (!data.success) return;
            conversations = data.conversations;
            renderConvoList(conversations);

            const unread = conversations.reduce((s, c) => s + c.unread_count, 0);
            if (subtitle) {
                subtitle.textContent = unread > 0
                    ? `${unread} unread message${unread > 1 ? "s" : ""}`
                    : `${conversations.length} conversation${conversations.length !== 1 ? "s" : ""}`;
            }

            if (!activeClientId && conversations.length > 0) {
                openConversation(parseInt(conversations[0].user_id, 10));
            }
        } catch (e) { /* silent */ }
    }

    function renderConvoList(list) {
        const q        = (searchInput?.value ?? "").toLowerCase().trim();
        const filtered = q ? list.filter(c => c.full_name.toLowerCase().includes(q)) : list;

        convoList.innerHTML = "";

        if (filtered.length === 0) {
            convoList.innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;
                            justify-content:center;padding:40px 16px;height:200px;">
                    <i class="fa-solid fa-comments"
                       style="font-size:28px;color:var(--border);margin-bottom:10px;"></i>
                    <div style="font-size:12px;color:var(--text-light);">No conversations yet</div>
                </div>`;
            return;
        }

        filtered.forEach(c => convoList.appendChild(buildConvoItem(c)));
    }

    function buildConvoItem(c) {
        const isActive = parseInt(c.user_id, 10) === activeClientId;
        const unread   = parseInt(c.unread_count, 10);
        const preview  = truncate(c.last_message || "📎 Attachment", 40);

        const item = document.createElement("div");
        item.className = `convo-item${isActive ? " convo-active" : ""}`;
        item.dataset.id = c.user_id;
        item.innerHTML = `
            <div class="convo-av-wrap">
                <div class="av av-blue">${escHtml(c.initials)}</div>
            </div>
            <div class="convo-body">
                <div class="convo-meta">
                    <span class="convo-name">${escHtml(c.full_name)}</span>
                    <span class="convo-time">${escHtml(c.relative_time)}</span>
                </div>
                <div class="convo-preview">${escHtml(preview)}</div>
            </div>
            ${unread > 0 ? `<div class="unread-pill">${unread}</div>` : ""}
        `;
        item.addEventListener("click", () => openConversation(parseInt(c.user_id, 10)));
        return item;
    }

    /* ── Open a conversation ─────────────────────────────────── */
    function openConversation(clientUserId) {
        if (activeClientId === clientUserId) return;

        activeClientId = clientUserId;
        lastMessageId  = 0;
        lastDateLabel  = "";
        pendingFiles   = [];

        clearInterval(pollInterval);
        clearInterval(typingPollInt);
        hideTypingIndicator();

        document.querySelectorAll(".convo-item").forEach(el =>
            el.classList.toggle("convo-active", parseInt(el.dataset.id, 10) === clientUserId)
        );

        if (textarea) { textarea.disabled = false; textarea.placeholder = "Type a reply…"; }
        if (sendBtn)  sendBtn.disabled = false;

        const cached = conversations.find(x => parseInt(x.user_id, 10) === clientUserId);
        if (cached) updateTopbar(cached.initials, cached.full_name);

        msgFeed.innerHTML = `
            <div style="display:flex;justify-content:center;align-items:center;
                        flex:1;height:100%;padding:40px;">
                <span style="font-size:12px;color:var(--text-light);">
                    <i class="fa-solid fa-spinner fa-spin" style="margin-right:6px;"></i>
                    Loading…
                </span>
            </div>`;

        loadHistory();
        loadClientInfo(clientUserId);

        pollInterval  = setInterval(pollMessages, 2000);
        typingPollInt = setInterval(pollTyping,   1000);
    }

    /* ── Load full history ───────────────────────────────────── */
    async function loadHistory() {
        if (!activeClientId) return;
        try {
            const res  = await fetch(`src/get_messages.php?client_user_id=${activeClientId}&last_id=0`);
            const data = await res.json();

            msgFeed.innerHTML = "";
            lastMessageId = 0;
            lastDateLabel = "";

            if (!data.success || data.messages.length === 0) {
                msgFeed.innerHTML = `
                    <div style="display:flex;flex-direction:column;align-items:center;
                                justify-content:center;flex:1;padding:48px;
                                color:var(--text-light);text-align:center;">
                        <i class="fa-solid fa-comment-slash"
                           style="font-size:28px;color:var(--border);margin-bottom:10px;"></i>
                        <div style="font-size:13px;font-weight:600;color:var(--text-muted);">
                            No messages yet
                        </div>
                        <div style="font-size:12px;margin-top:4px;">Start the conversation!</div>
                    </div>`;
                return;
            }

            data.messages.forEach(renderMessage);
            scrollToBottom(false);
        } catch (e) { /* silent */ }
    }

    /* ── Polling ─────────────────────────────────────────────── */
    async function pollMessages() {
        if (!activeClientId) return;
        try {
            const res  = await fetch(`src/get_messages.php?client_user_id=${activeClientId}&last_id=${lastMessageId}`);
            const data = await res.json();
            if (!data.success || !data.messages.length) return;

            // Remove empty-state if present
            const emptyEl = msgFeed.querySelector("[data-empty]");
            emptyEl?.remove();

            data.messages.forEach(renderMessage);
            scrollToBottom(true);
            loadConversations();
        } catch (e) { /* silent */ }
    }

    async function pollTyping() {
        if (!activeClientId) return;
        try {
            const res  = await fetch(`src/get_typing.php?client_user_id=${activeClientId}`);
            const data = await res.json();
            data.is_typing ? showTypingIndicator() : hideTypingIndicator();
        } catch (e) { /* silent */ }
    }

    /* ── Render one message ──────────────────────────────────── */
    function renderMessage(msg) {
        if (lastMessageId >= parseInt(msg.message_id, 10)) return;
        lastMessageId = parseInt(msg.message_id, 10);

        const isOutgoing = parseInt(msg.sender_role, 10) === 1;

        if (msg.date_label !== lastDateLabel) {
            lastDateLabel = msg.date_label;
            const sep = document.createElement("div");
            sep.className = "date-sep";
            sep.textContent = msg.date_label;
            msgFeed.appendChild(sep);
        }

        const row = document.createElement("div");
        row.className = `msg-row${isOutgoing ? " msg-out" : ""}`;
        row.dataset.msgId = msg.message_id;

        if (!isOutgoing) {
            const av = document.createElement("div");
            av.className = "av av-blue av-sm";
            const c = conversations.find(x => parseInt(x.user_id, 10) === activeClientId);
            av.textContent = c ? c.initials : "?";
            row.appendChild(av);
        }

        const col = document.createElement("div");
        col.className = `msg-col${isOutgoing ? " msg-col-out" : ""}`;

        const bubble = document.createElement("div");
        bubble.className = `bubble ${isOutgoing
            ? "admin-bubble bubble-animate-out"
            : "client-bubble bubble-animate"}`;

        if (msg.message_text) {
            const span = document.createElement("span");
            span.textContent = msg.message_text;
            bubble.appendChild(span);
        }

        if (msg.attachment_name) {
            bubble.appendChild(
                isImageFile(msg.attachment_name)
                    ? buildInlineImage(msg)
                    : buildFileChip(msg)
            );
        }

        const time = document.createElement("div");
        time.className = "bubble-time";
        time.textContent = msg.time_label;
        bubble.appendChild(time);

        col.appendChild(bubble);
        row.appendChild(col);

        if (isOutgoing) {
            const av = document.createElement("div");
            av.className = "av av-admin av-sm";
            av.textContent = "A";
            row.appendChild(av);
        }

        msgFeed.appendChild(row);
    }

    /* ── Inline image ────────────────────────────────────────── */
    function buildInlineImage(msg) {
        const img = document.createElement("img");
        img.className = "msg-bubble-img";
        img.src = msg.attachment_path;
        img.alt = msg.attachment_name;
        img.loading = "lazy";
        img.addEventListener("click", () => openLightbox(msg.attachment_path));
        return img;
    }

    /* ── File chip (non-image) ───────────────────────────────── */
    function buildFileChip(msg) {
        const wrap = document.createElement("div");
        wrap.className = "msg-files";
        wrap.style.marginTop = "6px";
        const chip = document.createElement("div");
        chip.className = "msg-file-chip";
        chip.style.cursor = "pointer";
        chip.onclick = () => window.open(msg.attachment_path, "_blank");
        chip.innerHTML = `
            <div class="file-chip-icon"><i class="fa-solid fa-file-lines"></i></div>
            <div class="file-chip-info">
                <div class="file-chip-name">${escHtml(msg.attachment_name)}</div>
                ${msg.attachment_size
                    ? `<div class="file-chip-meta">${escHtml(msg.attachment_size)}</div>`
                    : ""}
            </div>
            <button class="file-chip-dl"
                onclick="event.stopPropagation();window.open('${msg.attachment_path}','_blank')">
                <i class="fa-solid fa-arrow-down"></i>
            </button>`;
        wrap.appendChild(chip);
        return wrap;
    }

    /* ── Typing indicator ─────────────────────────────────────── */
    function showTypingIndicator() {
        if (typingBubble) return;
        const c = conversations.find(x => parseInt(x.user_id, 10) === activeClientId);
        typingBubble = document.createElement("div");
        typingBubble.className = "msg-row";
        typingBubble.id = "admin-typing-indicator";
        typingBubble.innerHTML = `
            <div class="av av-blue av-sm">${escHtml(c?.initials ?? "?")}</div>
            <div class="msg-col">
                <div class="typing-bubble">
                    <div class="typing-dots-wrap client-typing">
                        <span class="typing-dot"></span>
                        <span class="typing-dot"></span>
                        <span class="typing-dot"></span>
                    </div>
                </div>
            </div>`;
        msgFeed.appendChild(typingBubble);
        scrollToBottom(true);
    }

    function hideTypingIndicator() {
        if (!typingBubble) return;
        typingBubble.querySelector(".typing-bubble")?.classList.add("fade-out");
        setTimeout(() => { typingBubble?.remove(); typingBubble = null; }, 250);
    }

    /* ── Topbar ──────────────────────────────────────────────── */
    function updateTopbar(initials, name) {
        if (topbarAv)   topbarAv.textContent   = initials;
        if (topbarName) topbarName.textContent = name;
    }

    /* ── Client info panel ───────────────────────────────────── */
    async function loadClientInfo(clientUserId) {
        const emptyState  = document.getElementById("info-empty-state");
        const filledState = document.getElementById("info-filled-state");
        if (!filledState) return;

        try {
            const res  = await fetch(`src/get_client_info.php?client_user_id=${clientUserId}`);
            const data = await res.json();
            if (!data.success) return;

            const u = data.user;
            setEl("info-av",             u.initials);
            setEl("info-name",           u.full_name);
            setEl("info-email",          u.email);
            setEl("info-phone",          u.phone || "No phone on record");
            setEl("info-total-bookings", data.total_bookings);
            setEl("info-pending-count",  data.bookings.length);

            const badge = document.getElementById("info-status-badge");
            if (badge) {
                badge.textContent = u.account_status === "active" ? "Active Client" : u.account_status;
                badge.className   = `badge ${u.account_status === "active" ? "badge-active" : "badge-pending"}`;
            }

            const list = document.getElementById("info-bookings-list");
            if (list) {
                list.innerHTML = data.bookings.length === 0
                    ? `<div style="font-size:12px;color:var(--text-light);padding:8px 0;">
                           No active requests.
                       </div>`
                    : data.bookings.map(b => `
                        <div class="mini-req-card"
                        style="margin-bottom:8px;cursor:pointer"
                        onclick="window.location.href='admin.html?booking_id=${b.booking_id}&from=chat#detail'">
                            <div class="mini-req-top">
                                <span class="mini-req-id">#${String(b.booking_id).padStart(4,"0")}</span>
                                <span class="badge ${statusBadge(b.status)}">${capitalize(b.status)}</span>
                            </div>
                            <div class="mini-req-name">${escHtml(b.service_name)}</div>
                            <div class="mini-req-detail">
                                ${escHtml(b.location_type ?? "")}
                                ${b.booking_date_fmt ? " · " + escHtml(b.booking_date_fmt) : ""}
                                ${b.slot_label       ? " · " + escHtml(b.slot_label)       : ""}
                            </div>
                        </div>`).join("");
            }

            if (emptyState)  emptyState.style.display  = "none";
            filledState.style.display = "block";
        } catch (e) { /* silent */ }
    }

    /* ── Send ────────────────────────────────────────────────── */
    function bindEvents() {
        sendBtn?.addEventListener("click", sendMessage);
        textarea?.addEventListener("keydown", e => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
        });
        textarea?.addEventListener("input", () => {
            textarea.style.height = "auto";
            textarea.style.height = Math.min(textarea.scrollHeight, 100) + "px";
            handleTypingNotify();
        });
        fileInput?.addEventListener("change", () => {
            pendingFiles = [...pendingFiles, ...Array.from(fileInput.files)];
            renderPendingFiles();
            fileInput.value = "";
        });
        searchInput?.addEventListener("input", () => renderConvoList(conversations));
    }

    async function sendMessage() {
        if (!activeClientId) return;
        const text = textarea?.value.trim() ?? "";
        if (!text && pendingFiles.length === 0) return;

        sendBtn?.classList.add("btn-send-flash");
        setTimeout(() => sendBtn?.classList.remove("btn-send-flash"), 200);

        const fd = new FormData();
        fd.append("message", text);
        fd.append("client_user_id", activeClientId);
        if (pendingFiles.length > 0) fd.append("attachment", pendingFiles[0]);

        if (textarea) { textarea.value = ""; textarea.style.height = "auto"; }
        pendingFiles = [];
        renderPendingFiles();
        stopTyping();

        try {
            const res  = await fetch("src/send_message.php", { method: "POST", body: fd });
            const data = await res.json();
            if (data.success) pollMessages();
        } catch (e) { /* silent */ }
    }

    /* ── Typing ──────────────────────────────────────────────── */
    function handleTypingNotify() {
        if (!isTyping) { isTyping = true; notifyTyping(true); }
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
        if (!activeClientId) return;
        try {
            await fetch("src/set_typing.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_typing: state, client_user_id: activeClientId })
            });
        } catch (e) { /* silent */ }
    }

    /* ── Pending files ───────────────────────────────────────── */
    function renderPendingFiles() {
        if (!attachPrev) return;
        attachPrev.innerHTML = "";
        if (pendingFiles.length === 0) { attachPrev.classList.remove("visible"); return; }
        attachPrev.classList.add("visible");
        pendingFiles.forEach((file, idx) => {
            const chip = document.createElement("div");
            chip.className = "admin-attach-chip";
            chip.innerHTML = `
                <i class="${isImageFile(file.name) ? "fa-solid fa-file-image" : "fa-solid fa-file-lines"}"
                   style="color:var(--primary);font-size:11px"></i>
                ${escHtml(file.name)}
                <span class="admin-chip-remove" data-idx="${idx}">×</span>`;
            chip.querySelector("[data-idx]").onclick = () => {
                pendingFiles.splice(idx, 1);
                renderPendingFiles();
            };
            attachPrev.appendChild(chip);
        });
    }

    /* ── Lightbox ────────────────────────────────────────────── */
    function bindLightbox() {
        const lb = document.getElementById("img-lightbox");
        lb?.addEventListener("click", () => lb.classList.remove("open"));
    }
    function openLightbox(src) {
        const lb  = document.getElementById("img-lightbox");
        const img = document.getElementById("img-lightbox-src");
        if (!lb || !img) return;
        img.src = src;
        lb.classList.add("open");
    }

    /* ── Helpers ─────────────────────────────────────────────── */
    function scrollToBottom(smooth) {
        msgFeed.scrollTo({ top: msgFeed.scrollHeight, behavior: smooth ? "smooth" : "instant" });
    }
    function setEl(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val ?? "—";
    }
    function escHtml(s) {
        if (!s) return "";
        return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    }
    function truncate(s, n) { return s && s.length > n ? s.slice(0, n) + "…" : (s || ""); }
    function isImageFile(n) { return /\.(png|jpe?g|gif|webp)$/i.test(n ?? ""); }
    function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }
    function statusBadge(s) {
        return { pending:"badge-pending", waiting:"badge-pending",
                 approved:"badge-active", confirmed:"badge-active",
                 awaiting_payment:"badge-pending" }[s] ?? "badge-pending";
    }

    window.adminChat = { refresh: loadConversations };
    document.addEventListener("DOMContentLoaded", init);
})();