<?php
require_once dirname(__DIR__) . '/config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    exit;
}

$matchId = intval($_POST['match_id'] ?? 0);
$resultRaw = trim($_POST['result'] ?? '');

if ($matchId <= 0) {
    http_response_code(400);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode(['success' => false, 'message' => '无效的比赛 ID']);
    exit;
}

$allowedResults = ['未结束', 'A胜利', 'B胜利', ''];
if (!in_array($resultRaw, $allowedResults, true)) {
    http_response_code(400);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode(['success' => false, 'message' => '无效的比赛结果']);
    exit;
}

$matchResult = null;
if ($resultRaw === '未结束') {
    $matchResult = '未结束';
} elseif ($resultRaw === 'A胜利' || $resultRaw === 'B胜利') {
    $matchResult = $resultRaw;
}

$stmt = mysqli_prepare($db, 'UPDATE `matches` SET `result` = ? WHERE `id` = ?');
if (!$stmt) {
    http_response_code(500);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode(['success' => false, 'message' => '数据库预处理失败: ' . mysqli_error($db)]);
    exit;
}

mysqli_stmt_bind_param($stmt, 'si', $matchResult, $matchId);
$success = mysqli_stmt_execute($stmt);
$error   = mysqli_error($db);
mysqli_stmt_close($stmt);

if (!$success) {
    http_response_code(500);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode(['success' => false, 'message' => '更新失败: ' . $error]);
    exit;
}

header('Content-Type: application/json; charset=UTF-8');
echo json_encode([
    'success' => true,
    'match_id' => $matchId,
    'result' => $matchResult
]);
