<?php
session_start();
require "../Database.php";
header("Content-Type: application/json");

$data     = json_decode(file_get_contents("php://input"), true) ?? [];
$password = $data['password'] ?? $_POST['password'] ?? '';

$db   = new Database();
$conn = $db->connect();

$stmt = $conn->prepare("SELECT * FROM users WHERE role_id = 1 LIMIT 1");
$stmt->execute();
$admin = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$admin || !password_verify($password, $admin['password_hash'])) {
    echo json_encode(["success" => false, "message" => "Invalid credentials"]);
    exit;
}

$_SESSION['user_id']    = $admin['user_id'];
$_SESSION['user_name']  = $admin['first_name'] . ' ' . $admin['last_name'];
$_SESSION['user_email'] = $admin['email'];
$_SESSION['role_id']    = 1;

echo json_encode(["success" => true]);