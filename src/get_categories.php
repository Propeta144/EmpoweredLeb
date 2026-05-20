<?php

require_once "../Database.php";

$db = new Database();
$conn = $db->connect();

$sql = "
SELECT *
FROM service_categories
";

$stmt = $conn->prepare($sql);
$stmt->execute();

echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));