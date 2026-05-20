<?php

require_once "../Database.php";

$db = new Database();
$conn = $db->connect();

$category_id = $_GET['category_id'];

$sql = "
SELECT *
FROM services
WHERE category_id = ?
";

$stmt = $conn->prepare($sql);
$stmt->execute([$category_id]);

echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));