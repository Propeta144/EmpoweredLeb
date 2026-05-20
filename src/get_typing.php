<?php
// src/get_typing.php
session_start();
header("Content-Type: application/json");

if (!isset($_SESSION['user_id'], $_SESSION['role_id'])) {
    http_response_code(401);
    echo json_encode(["is_typing" => false]);
    exit;
}

require_once "../Database.php";

$user_id = (int) $_SESSION['user_id'];
$role_id = (int) $_SESSION['role_id'];

if ($role_id === 3) {
    // Client wants to know if ADMIN is typing in their room
    $client_user_id  = $user_id;
    $watch_role_id   = 1;   // admin
} else {
    // Admin wants to know if the CLIENT is typing
    $client_user_id  = (int)($_GET['client_user_id'] ?? 0);
    $watch_role_id   = 3;   // client
}

if ($client_user_id === 0) {
    echo json_encode(["is_typing" => false]);
    exit;
}

$db   = new Database();
$conn = $db->connect();

// Typing expires after 5 seconds of inactivity
$stmt = $conn->prepare("
    SELECT ts.is_typing
    FROM   typing_status ts
    JOIN   users          u  ON ts.user_id = u.user_id
    WHERE  ts.client_user_id = ?
      AND  u.role_id         = ?
      AND  ts.is_typing      = 1
      AND  ts.updated_at    >= DATE_SUB(NOW(), INTERVAL 5 SECOND)
    LIMIT  1
");
$stmt->execute([$client_user_id, $watch_role_id]);
$row = $stmt->fetch(PDO::FETCH_ASSOC);

echo json_encode(["is_typing" => (bool)($row['is_typing'] ?? false)]);
