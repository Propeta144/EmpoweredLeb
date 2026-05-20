<?php
// src/set_typing.php
session_start();
header("Content-Type: application/json");

if (!isset($_SESSION['user_id'], $_SESSION['role_id'])) {
    http_response_code(401);
    echo json_encode(["success" => false]);
    exit;
}

require_once "../Database.php";

$user_id = (int) $_SESSION['user_id'];
$role_id = (int) $_SESSION['role_id'];

$body           = json_decode(file_get_contents("php://input"), true) ?? [];
$is_typing      = (int)(bool)($body['is_typing'] ?? $_POST['is_typing'] ?? false);
$client_user_id = (int)($body['client_user_id'] ?? $_POST['client_user_id'] ?? 0);

if ($role_id === 3) {
    $client_user_id = $user_id;
}

if ($client_user_id === 0) {
    echo json_encode(["success" => false, "error" => "Missing client_user_id"]);
    exit;
}

$db   = new Database();
$conn = $db->connect();

// UPSERT typing status
$stmt = $conn->prepare("
    INSERT INTO typing_status (user_id, client_user_id, is_typing, updated_at)
    VALUES (?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE
        client_user_id = VALUES(client_user_id),
        is_typing      = VALUES(is_typing),
        updated_at     = NOW()
");
$stmt->execute([$user_id, $client_user_id, $is_typing]);

echo json_encode(["success" => true]);
