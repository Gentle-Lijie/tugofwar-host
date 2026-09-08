<?php
require_once dirname(__DIR__) . '/config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    exit;
}

$classA = trim($_POST['class_a'] ?? '');
$classB = trim($_POST['class_b'] ?? '');

if ($classA === '' || $classB === '') {
    http_response_code(400);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode([
        'success' => false,
        'message' => '班级名称不能为空'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

function classExists(mysqli $connection, string $className): bool
{
    $stmt = mysqli_prepare($connection, 'SELECT COUNT(*) FROM `classes` WHERE `class_name` = ?');
    if (!$stmt) {
        return false;
    }

    mysqli_stmt_bind_param($stmt, 's', $className);
    mysqli_stmt_execute($stmt);
    mysqli_stmt_bind_result($stmt, $count);
    mysqli_stmt_fetch($stmt);
    mysqli_stmt_close($stmt);

    return ($count ?? 0) > 0;
}

header('Content-Type: application/json; charset=UTF-8');
echo json_encode([
    'success' => true,
    'class_a_exists' => classExists($db, $classA),
    'class_b_exists' => classExists($db, $classB)
], JSON_UNESCAPED_UNICODE);
