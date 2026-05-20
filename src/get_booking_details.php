<?php
require_once "../Database.php";
header("Content-Type: application/json");

$db   = new Database();
$conn = $db->connect();

$booking_id = $_GET['booking_id'] ?? 0;

$sql = "
    SELECT
        b.*,
        s.service_name,
        sts.slot_label,
        q.quotation_amount,
        q.admin_notes
    FROM bookings b
    INNER JOIN services s             ON b.service_id = s.service_id
    INNER JOIN service_time_slots sts ON b.slot_id     = sts.slot_id
    LEFT  JOIN booking_quotations q   ON b.booking_id  = q.booking_id
    WHERE b.booking_id = ?
";
$stmt = $conn->prepare($sql);
$stmt->execute([$booking_id]);
$booking = $stmt->fetch(PDO::FETCH_ASSOC);

$stmt2 = $conn->prepare("SELECT * FROM booking_files WHERE booking_id = ?");
$stmt2->execute([$booking_id]);
$files = $stmt2->fetchAll(PDO::FETCH_ASSOC);

// ── history for progress tracker ──────────────────────────────
$stmt3 = $conn->prepare("
    SELECT new_status, changed_at
    FROM booking_history
    WHERE booking_id = ?
    ORDER BY changed_at ASC
");
$stmt3->execute([$booking_id]);
$history = $stmt3->fetchAll(PDO::FETCH_ASSOC);

echo json_encode([
    "booking" => $booking,
    "files"   => $files,
    "history" => $history,
]);
?>