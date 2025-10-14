<?php
require_once dirname(__DIR__) . '/config/database.php';

$query_classes = 'SELECT * FROM `classes`';
$result_classes = mysqli_query($db, $query_classes);
?>

<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <title>管理员页面</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #FAF6EF;
            color: #10263B;
            margin: 0;
            padding: 0;
            line-height: 1.6;
            height:95vh;
        }

        h2, h3 {
            color: #10263B;
            font-size: 1.8rem;
            margin-bottom: 15px;
            margin-left: 20px;
        }

        .form-container {
            background-color: #ffffff;
            padding: 15px;
            border-radius: 8px;
            width: 90%;
            margin: 20px auto;
            box-sizing: border-box;
            border: 1px solid #ddd;
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
        }

        .form-container label {
            font-size: 1rem;
            font-weight: 600;
            color: #405162;
            margin-right: 10px;
        }

        .form-container input,
        .form-container select {
            padding: 8px;
            font-size: 1rem;
            border: 1px solid #405162;
            border-radius: 6px;
        }

        .form-container button {
            background-color: #10263B;
            color: white;
            padding: 10px 20px;
            font-size: 1rem;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            transition: background-color 0.3s ease;
            margin: 15px;
        }

        .form-container button:hover {
            background-color: #405162;
        }

        table {
            width: 90%;
            margin: 20px auto;
            border-collapse: collapse;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        th, td {
            padding: 10px 15px;
            text-align: center;
            font-size: 1rem;
            border-bottom: 1px solid #ddd;
        }

        th {
            background-color: #10263B;
            color: white;
        }

        tr:nth-child(even) {
            background-color: #9FA8B1;
        }

        tr:hover {
            background-color: #CFD4D8;
        }

        td input, td select {
            padding: 10px;
            margin: 0;
            font-size: 1rem;
            border: 1px solid #405162;
            border-radius: 6px;
            width: auto;
        }

        td button {
            background-color: #405162;
            color:white;
            border-radius: 6px;
            padding: 8px 14px;
        }

        td button:hover {
            background-color: #10263B;
        }

        .highlight {
            background-color: #33AFCD;
            color: white;
        }

        .status-btn {
            display: inline-block;
            padding: 6px 12px;
            margin: 2px;
            border-radius: 6px;
            border: 1px solid #10263B;
            cursor: pointer;
            font-weight: bold;
            background-color: #fff;
            color: #10263B;
            transition: all 0.2s;
        }

        .status-btn.active {
            background-color: #33AFCD;
            color: #000;
        }

        .status-btn:hover {
            opacity: 0.8;
        }
    </style>
</head>
<body>
    <h2>管理比赛</h2>

    <div class="form-container">
        <form action="add_match.php" method="POST">
            <label for="class_a">班级 A:</label>
            <input class="text-input" type="text" id="class_a" name="class_a" placeholder="请输入班级 A 名称" required>

            <label for="class_b">班级 B:</label>
            <input type="text" id="class_b" name="class_b" placeholder="请输入班级 B 名称" required>

            <label for="start_time">开始时间:</label>
            <input type="datetime-local" name="start_time" required>

            <button type="submit">添加比赛</button>
        </form>
    </div>

    <h3>比赛列表(高亮为待开始比赛)</h3>

    <div class="table-container">
        <table>
            <tr>
                <th>班级 A</th>
                <th>班级 B</th>
                <th>开始时间</th>
                <th>结果</th>
                <th>操作</th>
            </tr>

            <?php 
            $query_matches = 'SELECT * FROM `matches` ORDER BY `start_time` ASC';
            $result_matches = mysqli_query($db, $query_matches);

            while ($match = mysqli_fetch_assoc($result_matches)): 
                $class_a_query = "SELECT class_name FROM `classes` WHERE `id` = {$match['class_a']}";
                $class_a_result = mysqli_query($db, $class_a_query);
                $class_a = mysqli_fetch_assoc($class_a_result);

                $class_b_query = "SELECT class_name FROM `classes` WHERE `id` = {$match['class_b']}";
                $class_b_result = mysqli_query($db, $class_b_query);
                $class_b = mysqli_fetch_assoc($class_b_result);
            ?>
            <form action="update_match.php" method="POST">
                <tr class="<?= $match['result'] === '未结束' || date('Y-m-d H:i:s') < $match['start_time'] ? 'highlight' : '' ?>">
                    <td>
                        <input type="hidden" name="match_id" value="<?= $match['id'] ?>">
                        <input type="text" name="class_a" value="<?= htmlspecialchars($class_a['class_name']) ?>" required>
                    </td>
                    <td>
                        <input type="text" name="class_b" value="<?= htmlspecialchars($class_b['class_name']) ?>" required>
                    </td>
                    <td>
                        <input type="datetime-local" name="start_time" value="<?= $match['start_time'] ?>" required>
                    </td>
                    <td>
                        <?php 
                        $statuses = ['未结束', 'A胜利', 'B胜利'];
                        foreach ($statuses as $s): 
                            $checked = ($match['result'] === $s) ? 'checked' : '';
                        ?>
                            <label class="status-btn <?= $checked ? 'active' : '' ?>">
                                <input type="radio" name="result" value="<?= $s ?>" <?= $checked ?> hidden>
                                <?= $s ?>
                            </label>
                        <?php endforeach; ?>
                    </td>
                    <td>
                        <button type="submit">更新</button>
                    </td>
                </tr>
            </form>
            <?php endwhile; ?>
        </table>
    </div>

    <style>
        .table-container {
            max-height: 60vh;
            overflow-y: auto;
            margin: 20px auto;
            width: 90%;
        }

        .table-container table {
            border-radius: 8px;
        }

        .back-to-home {
            z-index: 999;
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 10px 20px;
            background-color: #10263B;
            color: white;
            font-size: 1.5em;
            border-radius: 50px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
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

    <a href="index.php" class="back-to-home">回首页</a>

    <footer style="position:fixed; left:0; bottom:0; width:100%; background:#fff; border-top:1px solid #e0e6ed; box-shadow:0 -2px 8px rgba(52,152,219,0.08); padding:12px 0; color:#666; font-size:1em; text-align:center; z-index:99;">
        For tech support: Contact Lijie ZHOU (20809020 <a href="mailto:scylz12@nottingham.edu.cn" style="color:#2980b9;text-decoration:none;">scylz12@nottingham.edu.cn</a>)
    </footer>

    <script>
    document.querySelectorAll('.status-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const matchRow = btn.closest('tr');
            const matchId = matchRow.querySelector('input[name="match_id"]').value;
            const status = btn.innerText;

            matchRow.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const xhr = new XMLHttpRequest();
            xhr.open('POST', 'update_result.php', true);
            xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
            xhr.onload = function() {
                if (xhr.status !== 200) {
                    alert('更新失败');
                }
            };
            xhr.send('match_id=' + encodeURIComponent(matchId) + '&result=' + encodeURIComponent(status));
        });
    });
    </script>

</body>
</html>
