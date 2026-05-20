<?php
session_start();
header("Content-Type: application/json");

echo json_encode([
    "is_admin" => isset($_SESSION['role_id']) && (int)$_SESSION['role_id'] === 1
]);