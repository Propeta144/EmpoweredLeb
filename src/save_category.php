<?php
/**
 * POST /src/save_category.php
 * Creates or updates a service_categories row plus its category_features.
 *
 * Expected JSON body:
 * {
 *   "category_id":        null | int,
 *   "category_name":      string,
 *   "description":        string | null,
 *   "short_description":  string | null,
 *   "detail_title":       string | null,
 *   "detail_description": string | null,
 *   "icon_class":         string | null,
 *   "features":           string[]   e.g. ["Hardware Diagnostics","Virus Removal"]
 * }
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once '../Database.php';

$input = json_decode(file_get_contents('php://input'), true);

$categoryName      = trim($input['category_name']      ?? '');
$description       = trim($input['description']        ?? '');
$shortDescription  = trim($input['short_description']  ?? '');
$detailTitle       = trim($input['detail_title']       ?? '');
$detailDescription = trim($input['detail_description'] ?? '');
$iconClass         = trim($input['icon_class']         ?? '');
$categoryId        = isset($input['category_id']) && $input['category_id'] !== null
                         ? (int) $input['category_id'] : null;
$features          = is_array($input['features'] ?? null)
                         ? array_values(array_filter(array_map('trim', $input['features'])))
                         : [];

if ($categoryName === '') {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Category name is required.']);
    exit;
}

try {
    $db   = new Database();
    $conn = $db->connect();
    $conn->beginTransaction();

    if ($categoryId === null) {
        $stmt = $conn->prepare("
            INSERT INTO service_categories
                (category_name, description, short_description,
                 detail_title, detail_description, icon_class, is_active)
            VALUES
                (:category_name, :description, :short_description,
                 :detail_title, :detail_description, :icon_class, 1)
        ");
        $stmt->execute([
            ':category_name'      => $categoryName,
            ':description'        => $description       ?: null,
            ':short_description'  => $shortDescription  ?: null,
            ':detail_title'       => $detailTitle       ?: null,
            ':detail_description' => $detailDescription ?: null,
            ':icon_class'         => $iconClass         ?: null,
        ]);
        $categoryId = (int) $conn->lastInsertId();
        $message    = 'Category created.';

    } else {
        $stmt = $conn->prepare("
            UPDATE service_categories SET
                category_name      = :category_name,
                description        = :description,
                short_description  = :short_description,
                detail_title       = :detail_title,
                detail_description = :detail_description,
                icon_class         = :icon_class
            WHERE category_id = :category_id
        ");
        $stmt->execute([
            ':category_name'      => $categoryName,
            ':description'        => $description       ?: null,
            ':short_description'  => $shortDescription  ?: null,
            ':detail_title'       => $detailTitle       ?: null,
            ':detail_description' => $detailDescription ?: null,
            ':icon_class'         => $iconClass         ?: null,
            ':category_id'        => $categoryId,
        ]);
        $message = 'Category updated.';
    }

    // ── Full-replace features (no sort_order column in DB) ────────────────────
    $conn->prepare("DELETE FROM category_features WHERE category_id = ?")->execute([$categoryId]);

    if (!empty($features)) {
        $featStmt = $conn->prepare("
            INSERT INTO category_features (category_id, feature_text)
            VALUES (:category_id, :feature_text)
        ");
        foreach ($features as $text) {
            $featStmt->execute([
                ':category_id'  => $categoryId,
                ':feature_text' => $text,
            ]);
        }
    }

    $conn->commit();

    echo json_encode([
        'success'     => true,
        'message'     => $message,
        'category_id' => $categoryId,
    ]);

} catch (Exception $e) {
    isset($conn) && $conn->inTransaction() && $conn->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}