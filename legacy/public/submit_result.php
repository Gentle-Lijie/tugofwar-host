<?php
require_once dirname(__DIR__) . '/config/database.php';

$matches_result = mysqli_query($db, 'SELECT * FROM `matches` ORDER BY `start_time` ASC');
$matches = [];
while($row = mysqli_fetch_assoc($matches_result)) {
    $matches[] = $row;
}

function getClassName($class_id) {
    global $db;
    $stmt = mysqli_prepare($db, 'SELECT `class_name` FROM `classes` WHERE `id` = ?');
    if (!$stmt) {
        return '未知班级';
    }
    mysqli_stmt_bind_param($stmt, 'i', $class_id);
    mysqli_stmt_execute($stmt);
    mysqli_stmt_bind_result($stmt, $class_name);
    $result = mysqli_stmt_fetch($stmt) ? $class_name : '未知班级';
    mysqli_stmt_close($stmt);
    return $result ?: '未知班级';
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['winner'])) {
    $match_id = intval($_POST['match_id'] ?? 0);
    $winner = $_POST['winner'] ?? '';

    if ($match_id > 0 && in_array($winner, ['A', 'B'], true)) {
        $result = $winner === 'A' ? 'A胜利' : 'B胜利';
        $stmt = mysqli_prepare($db, 'UPDATE `matches` SET `result` = ? WHERE `id` = ?');
        if ($stmt) {
            mysqli_stmt_bind_param($stmt, 'si', $result, $match_id);
            mysqli_stmt_execute($stmt);
            mysqli_stmt_close($stmt);
        }
    }

    $next_index = 0;
    foreach ($matches as $i => $m) {
        if ((int)$m['id'] === $match_id) {
            $next_index = $i + 1;
            break;
        }
    }
    if (isset($matches[$next_index])) {
        header('Location: submit_result.php?match_id=' . $matches[$next_index]['id']);
    } else {
        header('Location: submit_result.php?message=finished');
    }
    exit;
}

$current_match_id = $_GET['match_id'] ?? ($matches[0]['id'] ?? null);
$current_match_index = 0;
$current_match = $matches[0] ?? null;
foreach ($matches as $i => $m) {
    if ((int)$m['id'] === (int)$current_match_id) {
        $current_match_index = $i;
        $current_match = $m;
        break;
    }
}

$prev_match = $current_match_index > 0 ? $matches[$current_match_index - 1] : null;
$next_match = $current_match_index < count($matches) - 1 ? $matches[$current_match_index + 1] : null;

$winner_a = $current_match && $current_match['result'] === 'A胜利';
$winner_b = $current_match && $current_match['result'] === 'B胜利';

$text_a = ($winner_a ? '🎉 ' : '') . ($current_match ? getClassName($current_match['class_a']) : '班级 A') . '<br/> 获胜';
$text_b = ($winner_b ? '🎉 ' : '') . ($current_match ? getClassName($current_match['class_b']) : '班级 B') . '<br/> 获胜';
?>

<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<title>比赛结果提交</title>

<style>
body {
    font-size: 35px;
    font-family: Arial, sans-serif;
    text-align: center;
    padding: 40px;
    background: #FAF6EF;
}

select {
    font-size: 35px;
    padding: 10px;
    margin-bottom: 30px;
}

button {
    font-size: 48px;
    padding: 20px 40px;
    margin: 20px;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: transform 0.2s;
    width: 400px;
    display: inline-block;
}

button:hover {
    transform: scale(1.05);
}

.button-a { background-color: #33AFCD; color: white; }
.button-b { background-color: #10263B; color: white; }
.button-prev { background-color: #707D89; color: white; font-size: 36px;}

.message { font-size: 35px; color: #E74C3C; margin-top: 30px; }
.back-to-home {
    z-index: 999;
    font-size:24px;
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 10px 20px;
    background-color: #10263B;
    color: white;
    border-radius: 50px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    text-decoration: none;
    display: inline-block;
    text-align: center;
    transition: background-color 0.3s ease, transform 0.3s ease;
}

.back-to-home:hover {
    background-color: #33AFCD;
    transform: scale(1.1);
}

.back-to-home:active {
    background-color: #405162;
    transform: scale(1);
}
</style>

</head>
<body>

<h1>比赛结果提交</h1>

<?php if(isset($_GET['message']) && $_GET['message'] === 'finished'): ?>
    <div class="message">所有比赛已完成！</div>
<?php elseif($current_match): ?>
<form method="POST" id="resultForm">
<div>
    <label for="match_id">选择比赛：</label>
    <select name="match_id" id="matchSelect" onchange="location.href='submit_result.php?match_id='+this.value;">
        <?php foreach($matches as $m): ?>
            <option value="<?= (int)$m['id'] ?>" <?= (int)$m['id']===(int)$current_match['id']?'selected':'' ?>>
                <?= htmlspecialchars(date('Y-m-d H:i', strtotime($m['start_time']))) ?>：
                <?= htmlspecialchars(getClassName($m['class_a'])) ?> VS <?= htmlspecialchars(getClassName($m['class_b'])) ?>
            </option>
        <?php endforeach; ?>
    </select>
</div>

<div>
    <button type="submit" name="winner" value="A" class="button-a"><?= $text_a ?></button>
    <button type="submit" name="winner" value="B" class="button-b"><?= $text_b ?></button>
</div>

</form>

<?php if ($prev_match): ?>
    <form method="GET" style="margin-top:40px; display:inline-block;">
        <input type="hidden" name="match_id" value="<?= (int)$prev_match['id'] ?>">
        <button type="submit" class="button-prev">上一场比赛</button>
    </form>
<?php endif; ?>

<?php if ($next_match): ?>
    <form method="GET" style="margin-top:40px; display:inline-block;">
        <input type="hidden" name="match_id" value="<?= (int)$next_match['id'] ?>">
        <button type="submit" class="button-prev">下一场比赛</button>
    </form>
<?php endif; ?>

<?php endif; ?>
<a href="index.php" class="back-to-home">回首页</a>

<footer style="position:fixed; left:0; bottom:0; width:100%; background:#fff; border-top:1px solid #e0e6ed; box-shadow:0 -2px 8px rgba(52,152,219,0.08); padding:12px 0; color:#666; font-size:24px; text-align:center; z-index:99;">
    For tech support: Contact Lijie ZHOU (20809020 <a href="mailto:scylz12@nottingham.edu.cn" style="color:#2980b9;text-decoration:none;">scylz12@nottingham.edu.cn</a>)
    &nbsp;|&nbsp; 
</footer>
</body>
</html>
