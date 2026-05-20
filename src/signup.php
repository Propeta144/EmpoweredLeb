<?php
session_start();
require "../Database.php";
header('Content-Type: application/json');

$response = ["success" => false];

try {
    $db = new Database();

    $first_name = trim($_POST['first_name'] ?? '');
    $last_name  = trim($_POST['last_name'] ?? '');
    $email      = trim($_POST['email'] ?? '');
    $password   = $_POST['password'] ?? '';

    $phone = trim($_POST['phone'] ?? '');

    if (!$first_name || !$last_name || !$email || !$password || !$phone) {
        throw new Exception("All fields are required.");
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new Exception("Invalid email format.");
    }

    $conn = $db->connect();

    // ✅ CHECK IF EMAIL EXISTS
    $check = $conn->prepare("SELECT user_id FROM users WHERE email = ?");
    $check->execute([$email]);

    if ($check->rowCount() > 0) {
        throw new Exception("Email already exists.");
    }

    $password_hash = password_hash($password, PASSWORD_DEFAULT);
    $role_id = 3;

    // Insert user
    $result = $db->create("users", [
        "role_id" => $role_id,
        "first_name" => $first_name,
        "last_name" => $last_name,
        "email" => $email,
        "phone" => $phone,
        "password_hash" => $password_hash
    ]);

    if (!$result["success"]) {
        throw new Exception($result["error"]);
    }

    $user_id = $result["last_insert_id"];

    // Insert client
    $client_result = $db->create("clients", [
        "user_id" => $user_id
    ]);

    if (!$client_result["success"]) {
        throw new Exception($client_result["error"]);
    }

    // session
    $_SESSION['user_id'] = $user_id;
    $_SESSION['user_name'] = $first_name . " " . $last_name;
    $_SESSION['role_id'] = $role_id;
    $_SESSION['user_email'] = $email;

    $response = [
        "success" => true,
        "message" => "Account created successfully"
    ];

} catch (Exception $e) {
    $response = [
        "success" => false,
        "message" => $e->getMessage()
    ];
}

echo json_encode($response);
?>