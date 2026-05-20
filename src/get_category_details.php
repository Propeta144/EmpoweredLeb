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

$categories = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach($categories as &$category){

    $feature_sql = "
    SELECT *
    FROM category_features
    WHERE category_id = ?
    LIMIT 5
    ";

    $stmt2 = $conn->prepare($feature_sql);
    $stmt2->execute([$category['category_id']]);

    $category['features'] =
        $stmt2->fetchAll(PDO::FETCH_ASSOC);
}

echo json_encode($categories);