<?php

require_once "../Database.php";

header("Content-Type: application/json");

$db = new Database();
$conn = $db->connect();

$date = $_GET['date'] ?? '';

$sql = "
SELECT
    sts.slot_id,
    sts.slot_label,

    CASE
        WHEN COUNT(b.booking_id) > 0
        THEN 0
        ELSE 1
    END AS available

FROM service_time_slots sts

LEFT JOIN bookings b
    ON b.slot_id = sts.slot_id
    AND b.booking_date = ?
    AND b.status != 'cancelled'

WHERE sts.is_active = 1

GROUP BY sts.slot_id
ORDER BY sts.slot_id ASC
";

$stmt = $conn->prepare($sql);

$stmt->execute([$date]);

echo json_encode(
    $stmt->fetchAll(PDO::FETCH_ASSOC)
);