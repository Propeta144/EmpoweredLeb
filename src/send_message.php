<?php
// src/send_message.php
session_start();
header("Content-Type: application/json");

// ── Auth guard ───────────────────────────────────────────────────
if (!isset($_SESSION['user_id'], $_SESSION['role_id'])) {
    http_response_code(401);
    echo json_encode(["success" => false, "error" => "Not authenticated"]);
    exit;
}

require_once "../Database.php";

$sender_id = (int) $_SESSION['user_id'];
$role_id   = (int) $_SESSION['role_id'];  // 1 = admin, 3 = client

// ── Parse input (JSON body or multipart form) ────────────────────
$message_text    = trim($_POST['message']    ?? '');
$client_user_id  = (int)($_POST['client_user_id'] ?? 0);

// If JSON body (no file upload)
if (empty($_POST) && empty($_FILES)) {
    $body = json_decode(file_get_contents("php://input"), true) ?? [];
    $message_text   = trim($body['message']   ?? '');
    $client_user_id = (int)($body['client_user_id'] ?? 0);
}

// ── Determine the room (client_user_id) ──────────────────────────
if ($role_id === 3) {
    // Client always talks to admin — room = their own user_id
    $client_user_id = $sender_id;
} elseif ($role_id === 1 && $client_user_id > 0) {
    // Admin sends to a specific client
    $client_user_id = $client_user_id;
} else {
    echo json_encode(["success" => false, "error" => "Invalid request"]);
    exit;
}

// Must have text OR an attachment
if ($message_text === '' && empty($_FILES['attachment'])) {
    echo json_encode(["success" => false, "error" => "Empty message"]);
    exit;
}

$db   = new Database();
$conn = $db->connect();

// ── Handle optional file attachment ──────────────────────────────
$attachment_path = null;
$attachment_name = null;
$attachment_size = null;

if (!empty($_FILES['attachment']) && $_FILES['attachment']['error'] === UPLOAD_ERR_OK) {
    $upload_dir = __DIR__ . "/../uploads/chat/";
    if (!is_dir($upload_dir)) {
        mkdir($upload_dir, 0755, true);
    }

    $allowed_types = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    $mime = mime_content_type($_FILES['attachment']['tmp_name']);
    if (!in_array($mime, $allowed_types)) {
        echo json_encode(["success" => false, "error" => "File type not allowed"]);
        exit;
    }

    if ($_FILES['attachment']['size'] > 10 * 1024 * 1024) { // 10 MB cap
        echo json_encode(["success" => false, "error" => "File too large (max 10 MB)"]);
        exit;
    }

    $ext      = pathinfo($_FILES['attachment']['name'], PATHINFO_EXTENSION);
    $safe_ext = preg_replace('/[^a-zA-Z0-9]/', '', $ext);
    $filename = time() . '_' . bin2hex(random_bytes(6)) . '.' . $safe_ext;

    if (move_uploaded_file($_FILES['attachment']['tmp_name'], $upload_dir . $filename)) {
        $attachment_path = "uploads/chat/" . $filename;
        $attachment_name = htmlspecialchars($_FILES['attachment']['name'], ENT_QUOTES, 'UTF-8');
        $attachment_size = formatBytes($_FILES['attachment']['size']);
    }
}

// ── Insert message ────────────────────────────────────────────────
$stmt = $conn->prepare("
    INSERT INTO messages
        (client_user_id, sender_id, message_text, attachment_path, attachment_name, attachment_size)
    VALUES (?, ?, ?, ?, ?, ?)
");
$stmt->execute([
    $client_user_id,
    $sender_id,
    $message_text === '' ? null : $message_text,
    $attachment_path,
    $attachment_name,
    $attachment_size
]);

$message_id = (int) $conn->lastInsertId();

// Clear typing status for this sender
$conn->prepare("
    UPDATE typing_status
    SET    is_typing = 0
    WHERE  user_id = ?
")->execute([$sender_id]);

echo json_encode([
    "success"    => true,
    "message_id" => $message_id,
    "time"       => date('g:i A')
]);

// ── Helper ────────────────────────────────────────────────────────
function formatBytes(int $bytes): string {
    if ($bytes >= 1048576) return round($bytes / 1048576, 1) . ' MB';
    if ($bytes >= 1024)    return round($bytes / 1024, 1) . ' KB';
    return $bytes . ' B';
}
