<?php
// ============================================================
// src/get_profile.php
// Returns current user's profile data for the settings page
// ============================================================
session_start();
require "../database.php";
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    echo json_encode(["success" => false, "message" => "Not authenticated."]);
    exit;
}

try {
    $db   = new Database();
    $conn = $db->connect();

    // Join with clients table to get preferred_contact
    $stmt = $conn->prepare("
        SELECT u.first_name, u.last_name, u.email, u.phone,
               c.preferred_contact_method AS preferred_contact
        FROM users u
        LEFT JOIN clients c ON c.user_id = u.user_id
        WHERE u.user_id = ?
    ");
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        echo json_encode(["success" => false, "message" => "User not found."]);
        exit;
    }

    echo json_encode(array_merge(["success" => true], $user));

} catch (Exception $e) {
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
?>
