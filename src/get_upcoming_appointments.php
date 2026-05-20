<?php
header('Content-Type: application/json');
require_once '../Database.php';

$db   = new Database();
$conn = $db->connect();

$today = date('Y-m-d');

// Top 5 confirmed appointments from today onward,
// ordered by booking_date ASC then slot order ASC.
$stmt = $conn->prepare("
    SELECT
        b.booking_id,
        b.booking_date,
        b.location_type,
        b.status,
        ts.slot_label,
        ts.slot_id,
        s.service_name,
        sc.category_name,
        CONCAT(u.first_name, ' ', u.last_name)              AS client_name,
        CONCAT(UPPER(LEFT(u.first_name, 1)),
               UPPER(LEFT(u.last_name,  1)))                AS initials
    FROM bookings b
    JOIN clients  c  ON c.client_id  = b.client_id
    JOIN users    u  ON u.user_id    = c.user_id
    JOIN services s  ON s.service_id = b.service_id
    JOIN service_categories sc ON sc.category_id = s.category_id
    LEFT JOIN service_time_slots ts ON ts.slot_id = b.slot_id
    WHERE b.status IN ('confirmed', 'approved')
      AND b.booking_date >= ?
    ORDER BY b.booking_date ASC, ts.slot_id ASC
    LIMIT 5
");
$stmt->execute([$today]);
$appointments = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode([
    'success'      => true,
    'appointments' => $appointments,
]);