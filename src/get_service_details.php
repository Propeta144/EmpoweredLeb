<?php

require_once "../Database.php";

$db = new Database();
$conn = $db->connect();

$service_id = $_GET['service_id'];

$service_sql = "
SELECT 
    s.*,
    c.category_name,
    c.detail_title,
    c.detail_description
FROM services s
INNER JOIN service_categories c
ON s.category_id = c.category_id
WHERE s.service_id = ?
";

$stmt = $conn->prepare($service_sql);
$stmt->execute([$service_id]);

$service = $stmt->fetch(PDO::FETCH_ASSOC);

$item_sql = "
SELECT *
FROM service_items
WHERE service_id = ?
";

$stmt2 = $conn->prepare($item_sql);
$stmt2->execute([$service_id]);

$items = $stmt2->fetchAll(PDO::FETCH_ASSOC);

$mode_sql = "
SELECT *
FROM service_modes
WHERE service_id = ?
";

$stmt3 = $conn->prepare($mode_sql);
$stmt3->execute([$service_id]);

$modes = $stmt3->fetchAll(PDO::FETCH_ASSOC);

$schedule_sql = "
SELECT *
FROM service_schedules
WHERE service_id = ?
";

$stmt4 = $conn->prepare($schedule_sql);
$stmt4->execute([$service_id]);

$schedules = $stmt4->fetchAll(PDO::FETCH_ASSOC);

echo json_encode([
    "service" => $service,
    "items" => $items,
    "modes" => $modes,
    "schedules" => $schedules
]); 