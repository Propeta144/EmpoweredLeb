<?php
// src/get_messages.php
session_start();
header("Content-Type: application/json");

if (!isset($_SESSION['user_id'], $_SESSION['role_id'])) {
    http_response_code(401);
    echo json_encode(["success" => false, "error" => "Not authenticated"]);
    exit;
}

require_once "../Database.php";

$user_id  = (int) $_SESSION['user_id'];
$role_id  = (int) $_SESSION['role_id'];
$last_id  = (int) ($_GET['last_id'] ?? 0);

// ── Determine room ────────────────────────────────────────────────
if ($role_id === 3) {
    $client_user_id = $user_id;
} elseif ($role_id === 1) {
    $client_user_id = (int)($_GET['client_user_id'] ?? 0);
    if ($client_user_id === 0) {
        echo json_encode(["success" => true, "messages" => []]);
        exit;
    }
} else {
    echo json_encode(["success" => false, "error" => "Invalid role"]);
    exit;
}

$db   = new Database();
$conn = $db->connect();

// ── Fetch new messages since last_id ─────────────────────────────
$stmt = $conn->prepare("
    SELECT
        m.message_id,
        m.sender_id,
        m.message_text,
        m.attachment_path,
        m.attachment_name,
        m.attachment_size,
        m.is_read,
        DATE_FORMAT(m.created_at, '%l:%i %p')  AS time_label,
        DATE_FORMAT(m.created_at, '%M %d, %Y') AS date_label,
        m.created_at,
        u.role_id AS sender_role
    FROM   messages m
    JOIN   users    u ON m.sender_id = u.user_id
    WHERE  m.client_user_id = ?
      AND  m.message_id > ?
    ORDER  BY m.created_at ASC
");
$stmt->execute([$client_user_id, $last_id]);
$messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

// ── Mark incoming messages as read ───────────────────────────────
if ($role_id === 3) {
    // Client is reading → mark admin's messages read
    $conn->prepare("
        UPDATE messages
        SET    is_read = 1
        WHERE  client_user_id = ?
          AND  sender_id      != ?
          AND  is_read        = 0
    ")->execute([$client_user_id, $user_id]);
} else {
    // Admin is reading → mark client's messages read
    $conn->prepare("
        UPDATE messages
        SET    is_read = 1
        WHERE  client_user_id = ?
          AND  sender_id      = ?
          AND  is_read        = 0
    ")->execute([$client_user_id, $client_user_id]);
}

echo json_encode(["success" => true, "messages" => $messages]);
