<?php
// src/get_conversations.php  (admin only)
session_start();
header("Content-Type: application/json");

if (!isset($_SESSION['user_id'], $_SESSION['role_id']) || (int)$_SESSION['role_id'] !== 1) {
    http_response_code(403);
    echo json_encode(["success" => false, "error" => "Forbidden"]);
    exit;
}

require_once "../Database.php";

$db   = new Database();
$conn = $db->connect();

// ── Latest message + unread count per client ─────────────────────
$stmt = $conn->query("
    SELECT
        u.user_id,
        CONCAT(u.first_name, ' ', u.last_name) AS full_name,
        u.email,
        latest.message_text      AS last_message,
        latest.created_at        AS last_time,
        DATE_FORMAT(latest.created_at, '%l:%i %p') AS last_time_label,
        DATEDIFF(NOW(), latest.created_at)          AS days_ago,
        unread.cnt                                  AS unread_count,
        -- initials for avatar
        CONCAT(
            UPPER(LEFT(u.first_name, 1)),
            UPPER(LEFT(u.last_name,  1))
        ) AS initials
    FROM users u

    -- Most recent message in each room
    JOIN (
        SELECT m1.*
        FROM   messages m1
        JOIN   (
            SELECT client_user_id, MAX(message_id) AS max_id
            FROM   messages
            GROUP  BY client_user_id
        ) m2 ON m1.client_user_id = m2.client_user_id
             AND m1.message_id    = m2.max_id
    ) latest ON latest.client_user_id = u.user_id

    -- Unread count (messages FROM client that admin hasn't read)
    LEFT JOIN (
        SELECT client_user_id, COUNT(*) AS cnt
        FROM   messages
        WHERE  sender_id  = client_user_id   -- sent by the client themselves
          AND  is_read    = 0
        GROUP  BY client_user_id
    ) unread ON unread.client_user_id = u.user_id

    WHERE u.role_id = 3     -- clients only
    ORDER BY latest.created_at DESC
");

$conversations = $stmt->fetchAll(PDO::FETCH_ASSOC);

// ── Format time label ─────────────────────────────────────────────
foreach ($conversations as &$c) {
    $days = (int)$c['days_ago'];
    if ($days === 0)      $c['relative_time'] = $c['last_time_label'];
    elseif ($days === 1)  $c['relative_time'] = 'Yesterday';
    else                  $c['relative_time'] = $days . 'd ago';
    $c['unread_count'] = (int)($c['unread_count'] ?? 0);
}

echo json_encode(["success" => true, "conversations" => $conversations]);
