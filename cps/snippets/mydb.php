<?php
/**
 * Simple PDO-like wrapper for MySQL/Postgres using PDO
 * Usage:
 *   $db = new MyDB($dsn, $user, $pass);
 *   $rows = $db->query('SELECT * FROM users WHERE id = ?', [$id])->fetchAll();
 */
class MyDB {
    private $pdo;

    public function __construct($dsn, $user = null, $pass = null, $options = []) {
        $default = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ];
        $opts = $options + $default;
        $this->pdo = new PDO($dsn, $user, $pass, $opts);
    }

    public function query($sql, $params = []) {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    public function fetch($sql, $params = []) {
        $stmt = $this->query($sql, $params);
        return $stmt->fetch();
    }

    public function fetchAll($sql, $params = []) {
        $stmt = $this->query($sql, $params);
        return $stmt->fetchAll();
    }

    public function execute($sql, $params = []) {
        $stmt = $this->pdo->prepare($sql);
        return $stmt->execute($params);
    }

    public function beginTransaction() { return $this->pdo->beginTransaction(); }
    public function commit() { return $this->pdo->commit(); }
    public function rollback() { return $this->pdo->rollBack(); }
    public function lastInsertId() { return $this->pdo->lastInsertId(); }
}

// Example usage:
// $dsn = 'mysql:host=127.0.0.1;port=3306;dbname=testdb;charset=utf8mb4';
// $db = new MyDB($dsn, 'user', 'pass');
// $rows = $db->fetchAll('SELECT * FROM users WHERE id = ?', [1]);

?>
