<?php
// ============================================================
// src/update_profile.php
// Handles three actions: update_info | update_password | update_prefs
// ============================================================
session_start();
require "../database.php";
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    echo json_encode(["success" => false, "message" => "Not authenticated."]);
    exit;
}

$user_id = $_SESSION['user_id'];
$action  = trim($_POST['action'] ?? '');
$response = ["success" => false];

try {
    $db   = new Database();
    $conn = $db->connect();

    // ── UPDATE PERSONAL INFO ─────────────────────────────────
    if ($action === 'update_info') {
        $first_name = trim($_POST['first_name'] ?? '');
        $last_name  = trim($_POST['last_name']  ?? '');
        $email      = trim($_POST['email']      ?? '');
        $phone      = trim($_POST['phone']      ?? '');

        if (!$first_name || !$last_name || !$email) {
            throw new Exception("First name, last name, and email are required.");
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new Exception("Invalid email format.");
        }

        // Check email uniqueness (ignore current user)
        $check = $conn->prepare("SELECT user_id FROM users WHERE email = ? AND user_id != ?");
        $check->execute([$email, $user_id]);
        if ($check->rowCount() > 0) {
            throw new Exception("That email is already in use by another account.");
        }

        $stmt = $conn->prepare("
            UPDATE users
            SET first_name = ?, last_name = ?, email = ?, phone = ?
            WHERE user_id = ?
        ");
        $stmt->execute([$first_name, $last_name, $email, $phone, $user_id]);

        // Keep session in sync
        $_SESSION['user_name']  = $first_name . " " . $last_name;
        $_SESSION['user_email'] = $email;

        $response = [
            "success"   => true,
            "message"   => "Profile updated.",
            "user_name" => $first_name . " " . $last_name,
        ];

    // ── UPDATE PASSWORD ──────────────────────────────────────
    } elseif ($action === 'update_password') {
        $current_pw = $_POST['current_password'] ?? '';
        $new_pw     = $_POST['new_password']     ?? '';

        if (!$current_pw || !$new_pw) {
            throw new Exception("All password fields are required.");
        }
        if (strlen($new_pw) < 8) {
            throw new Exception("New password must be at least 8 characters.");
        }

        // Verify current password
        $stmt = $conn->prepare("SELECT password_hash FROM users WHERE user_id = ?");
        $stmt->execute([$user_id]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || !password_verify($current_pw, $user['password_hash'])) {
            throw new Exception("Current password is incorrect.");
        }

        $new_hash = password_hash($new_pw, PASSWORD_DEFAULT);
        $upd = $conn->prepare("UPDATE users SET password_hash = ? WHERE user_id = ?");
        $upd->execute([$new_hash, $user_id]);

        $response = ["success" => true, "message" => "Password updated."];

    // ── UPDATE CONTACT PREFERENCES ───────────────────────────
    } elseif ($action === 'update_prefs') {
        $preferred = $_POST['preferred_contact'] ?? 'email';
        $allowed   = ['email', 'phone', 'sms'];

        if (!in_array($preferred, $allowed)) {
            throw new Exception("Invalid contact preference.");
        }

        // Upsert into clients table
        $check = $conn->prepare("SELECT client_id FROM clients WHERE user_id = ?");
        $check->execute([$user_id]);

        if ($check->rowCount() > 0) {
            $upd = $conn->prepare("
                UPDATE clients SET preferred_contact_method = ? WHERE user_id = ?
            ");
            $upd->execute([$preferred, $user_id]);
        } else {
            $ins = $conn->prepare("
                INSERT INTO clients (user_id, preferred_contact_method) VALUES (?, ?)
            ");
            $ins->execute([$user_id, $preferred]);
        }

        $response = ["success" => true, "message" => "Preferences saved."];

    } else {
        throw new Exception("Unknown action.");
    }

} catch (Exception $e) {
    $response = ["success" => false, "message" => $e->getMessage()];
}

echo json_encode($response);
?>
