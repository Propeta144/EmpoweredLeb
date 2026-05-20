<?php
session_start();
require "../database.php";
header('Content-Type: application/json');

$response = ["success" => false];

try {
    $db = new Database();
    $conn = $db->connect();

    $email = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';

    if (!$email || !$password) {
        throw new Exception("Email and password are required.");
    }

    // MySQL PDO query
    $stmt = $conn->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->execute([$email]);

    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        throw new Exception("Invalid email or password.");
    }

    if (!password_verify($password, $user['password_hash'])) {
        throw new Exception("Invalid email or password.");
    }

    // Session
    $_SESSION['user_email'] = $user['email'];
    $_SESSION['user_name'] = $user['first_name'] . " " . $user['last_name'];
    $_SESSION['role_id'] = $user['role_id'];
    $_SESSION['user_id'] = $user['user_id'];

    $response = [
        "success" => true,
        "message" => "Login successful"
    ];

} catch (Exception $e) {
    $response = [
        "success" => false,
        "message" => $e->getMessage()
    ];
}

echo json_encode($response);
?>