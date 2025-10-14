<?php
require_once dirname(__DIR__) . '/config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    exit;
}

$classAName = trim($_POST['class_a'] ?? '');
$classBName = trim($_POST['class_b'] ?? '');
$startTime  = trim($_POST['start_time'] ?? '');

if ($classAName === '' || $classBName === '' || $startTime === '') {
    http_response_code(400);
    echo '班级 A、班级 B 和开始时间均为必填项。';
    exit;
}

function findClassId(mysqli $connection, string $className): ?int
{
    $stmt = mysqli_prepare($connection, 'SELECT `id` FROM `classes` WHERE `class_name` = ? LIMIT 1');
    if (!$stmt) {
        return null;
    }
    mysqli_stmt_bind_param($stmt, 's', $className);
    mysqli_stmt_execute($stmt);
    mysqli_stmt_bind_result($stmt, $classId);
    $result = mysqli_stmt_fetch($stmt) ? $classId : null;
    mysqli_stmt_close($stmt);
    return $result;
}

$classAId = findClassId($db, $classAName);
$classBId = findClassId($db, $classBName);

if ($classAId === null) {
    http_response_code(404);
    echo '班级 A 不存在';
    exit;
}

if ($classBId === null) {
    http_response_code(404);
    echo '班级 B 不存在';
    exit;
}

$stmt = mysqli_prepare($db, 'INSERT INTO `matches` (`class_a`, `class_b`, `start_time`, `result`) VALUES (?, ?, ?, NULL)');
if (!$stmt) {
    http_response_code(500);
    echo '数据库预处理失败: ' . mysqli_error($db);
    exit;
}

mysqli_stmt_bind_param($stmt, 'iis', $classAId, $classBId, $startTime);
$success = mysqli_stmt_execute($stmt);
mysqli_stmt_close($stmt);

if ($success) {
    echo '比赛已成功添加！';
} else {
    http_response_code(500);
    echo '添加比赛时发生错误：' . mysqli_error($db);
}
