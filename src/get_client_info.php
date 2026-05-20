<?php
// src/get_client_info.php
session_start();
header("Content-Type: application/json");

if (!isset($_SESSION['role_id']) || (int)$_SESSION['role_id'] !== 1) {
    http_response_code(403);
    echo json_encode(["success" => false, "error" => "Forbidden"]);
    exit;
}

require_once "../Database.php";

$client_user_id = (int)($_GET['client_user_id'] ?? 0);
if (!$client_user_id) {
    echo json_encode(["success" => false, "error" => "Missing client_user_id"]);
    exit;
}

$db   = new Database();
$conn = $db->connect();

// ── User profile ──────────────────────────────────────────────────
$stmt = $conn->prepare("
    SELECT
        u.user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.account_status,
        CONCAT(u.first_name, ' ', u.last_name) AS full_name,
        CONCAT(UPPER(LEFT(u.first_name,1)), UPPER(LEFT(u.last_name,1))) AS initials,
        DATE_FORMAT(u.created_at, '%M %Y') AS member_since
    FROM  users u
    WHERE u.user_id = ?
      AND u.role_id = 3
");
$stmt->execute([$client_user_id]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$user) {
    echo json_encode(["success" => false, "error" => "Client not found"]);
    exit;
}

// ── Active / pending bookings ─────────────────────────────────────
$stmt = $conn->prepare("
    SELECT
        b.booking_id,
        b.status,
        b.location_type,
        DATE_FORMAT(b.booking_date, '%M %d, %Y') AS booking_date_fmt,
        s.service_name,
        ts.slot_label
    FROM   bookings          b
    JOIN   clients           c  ON b.client_id  = c.client_id
    JOIN   services          s  ON b.service_id = s.service_id
    LEFT JOIN service_time_slots ts ON b.slot_id = ts.slot_id
    WHERE  c.user_id = ?
      AND  b.status IN ('pending','waiting','approved','confirmed','awaiting_payment')
    ORDER  BY b.created_at DESC
    LIMIT  5
");
$stmt->execute([$client_user_id]);
$bookings = $stmt->fetchAll(PDO::FETCH_ASSOC);

// ── Total booking count ───────────────────────────────────────────
$stmt = $conn->prepare("
    SELECT COUNT(*) AS total
    FROM   bookings b
    JOIN   clients  c ON b.client_id = c.client_id
    WHERE  c.user_id = ?
");
$stmt->execute([$client_user_id]);
$total = (int)$stmt->fetchColumn();

echo json_encode([
    "success"       => true,
    "user"          => $user,
    "bookings"      => $bookings,
    "total_bookings"=> $total
]);