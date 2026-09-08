<?php
require_once dirname(__DIR__) . '/config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    exit;
}

$matchId    = intval($_POST['match_id'] ?? 0);
$classAName = trim($_POST['class_a'] ?? '');
$classBName = trim($_POST['class_b'] ?? '');
$startTime  = trim($_POST['start_time'] ?? '');
$resultRaw  = trim($_POST['result'] ?? '');

if ($matchId <= 0) {
    http_response_code(400);
    echo '无效的比赛 ID。';
    exit;
}

if ($classAName === '' || $classBName === '' || $startTime === '') {
    http_response_code(400);
    echo '班级名称和开始时间均为必填项。';
    exit;
}

$allowedResults = ['A胜利', 'B胜利', '未结束', ''];
if (!in_array($resultRaw, $allowedResults, true)) {
    http_response_code(400);
    echo '无效的比赛结果。';
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

if ($classAId === null || $classBId === null) {
    http_response_code(404);
    echo '班级不存在，请确认名称是否正确。';
    exit;
}

$matchResult = null;
if ($resultRaw === 'A胜利' || $resultRaw === 'B胜利') {
    $matchResult = $resultRaw;
} elseif ($resultRaw === '未结束') {
    $matchResult = '未结束';
}

$stmt = mysqli_prepare($db, 'UPDATE `matches` SET `class_a` = ?, `class_b` = ?, `start_time` = ?, `result` = ? WHERE `id` = ?');
if (!$stmt) {
    http_response_code(500);
    echo '数据库预处理失败: ' . mysqli_error($db);
    exit;
}

mysqli_stmt_bind_param($stmt, 'iissi', $classAId, $classBId, $startTime, $matchResult, $matchId);
$success = mysqli_stmt_execute($stmt);
$error   = mysqli_error($db);
mysqli_stmt_close($stmt);

if (!$success) {
    http_response_code(500);
    echo '更新比赛失败: ' . $error;
    exit;
}

if (isset($_SERVER['HTTP_REFERER'])) {
    header('Location: ' . $_SERVER['HTTP_REFERER']);
} else {
    header('Location: admin.php');
}
exit;
