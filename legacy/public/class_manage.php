<?php
require_once dirname(__DIR__) . '/config/database.php';

$query = 'SELECT * FROM `classes`';
$result_classes = mysqli_query($db, $query);
?>

<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <title>班级管理</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #FAF6EF;
            color: #10263B;
            margin: 0;
            padding: 0;
        }

        h2, h3 {
            text-align: center;
            color: #10263B;
        }

        h2 {
            margin-top: 30px;
        }

        form {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-top: 20px;
        }

        label {
            font-size: 16px;
            color: #405162;
            margin-bottom: 10px;
        }

        input[type="text"] {
            padding: 8px;
            margin-bottom: 10px;
            width: 200px;
            border: 1px solid #405162;
            border-radius: 4px;
            font-size: 14px;
        }

        button {
            background-color: #009BC1;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
        }

        button:hover {
            background-color: #33AFCD;
        }

        table {
            width: 80%;
            margin: 20px auto;
            border-collapse: collapse;
        }

        th, td {
            padding: 12px;
            text-align: center;
            border: 1px solid #CFD4D8;
        }

        th {
            background-color: #10263B;
            color: white;
        }

        tr:nth-child(even) {
            background-color: #F3F4F5;
        }

        tr:hover {
            background-color: #F2FAFC;
        }

        a {
            color: #66C3DA;
            text-decoration: none;
        }

        a:hover {
            color: #33AFCD;
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
    <h2>班级管理</h2>
    <form action="add_class.php" method="POST">
        <label for="class_name">班级名称:</label>
        <input type="text" name="class_name" required>
        <button type="submit">添加班级</button>
    </form>

    <h3>班级列表</h3>
    <table>
        <tr>
            <th>班级名称</th>
            <th>操作</th>
        </tr>
        <?php while ($row = mysqli_fetch_assoc($result_classes)): ?>
            <tr>
                <td><?= htmlspecialchars($row['class_name']) ?></td>
                <td><a href="edit_class.php?id=<?= (int)$row['id'] ?>">编辑</a></td>
            </tr>
        <?php endwhile; ?>
    </table>

    <a href="index.php" class="back-to-home">
        回首页
    </a>

    <footer style="position:fixed; left:0; bottom:0; width:100%; background:#fff; border-top:1px solid #e0e6ed; box-shadow:0 -2px 8px rgba(52,152,219,0.08); padding:12px 0; color:#666; font-size:1em; text-align:center; z-index:99;">
        For tech support: Contact Lijie ZHOU (20809020 <a href="mailto:scylz12@nottingham.edu.cn" style="color:#2980b9;text-decoration:none;">scylz12@nottingham.edu.cn</a>)
    </footer>
</body>
</html>
