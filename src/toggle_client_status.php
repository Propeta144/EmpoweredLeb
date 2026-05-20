<?php
session_start();
header("Content-Type: application/json");
require_once "../Database.php";

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(["success" => false, "message" => "Invalid request."]);
    exit;
}

$userId = intval($_POST['user_id'] ?? 0);
if (!$userId) {
    echo json_encode(["success" => false, "message" => "Invalid user ID."]);
    exit;
}

try {
    $db   = new Database();
    $conn = $db->connect();

    $stmt = $conn->prepare("SELECT account_status FROM users WHERE user_id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        echo json_encode(["success" => false, "message" => "User not found."]);
        exit;
    }

    $newStatus = $user['account_status'] === 'active' ? 'inactive' : 'active';

    $conn->prepare("UPDATE users SET account_status = ? WHERE user_id = ?")
         ->execute([$newStatus, $userId]);

    echo json_encode([
        "success"    => true,
        "new_status" => $newStatus,
        "message"    => "Client " . ($newStatus === 'active' ? 'activated' : 'deactivated') . " successfully.",
    ]);

} catch (PDOException $e) {
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
?>