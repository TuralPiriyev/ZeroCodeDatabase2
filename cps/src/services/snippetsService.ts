import { parse as parseUrl } from 'url';
import { v4 as uuidv4 } from 'uuid';

type Snippets = {
  php: { dsn: string; env: string; snippet: string };
  node: { connectionCode: string };
  python: { connectionCode: string };
  mongo: { connectionCode: string };
};

function parseConnectionString(conn: string) {
  // Use URL parser for sql-like and mongodb URIs
  try {
    const u = new URL(conn);
    const engine = u.protocol.replace(':', '');
    const user = decodeURIComponent(u.username || '');
    const pass = decodeURIComponent(u.password || '');
    const host = u.hostname;
    const port = u.port || (engine === 'mysql' ? '3306' : engine === 'mongodb' ? '27017' : '');
    const pathname = u.pathname ? u.pathname.replace(/^\//, '') : '';
    const search = u.search ? u.search.replace(/^\?/, '') : '';
    return { engine, user, pass, host, port, db: pathname, params: search };
  } catch (e) {
    // fallback: return minimal
    return { engine: '', user: '', pass: '', host: '', port: '', db: '', params: '' };
  }
}

export function generateSnippets(connectionString: string, username = ''): { snippets: Partial<Snippets>; one_time_token: string } {
  const parsed = parseConnectionString(connectionString);
  const engine = parsed.engine || (connectionString.startsWith('mongodb') ? 'mongodb' : 'mysql');

  const phpDsn = engine === 'mysql'
    ? `mysql:host=${parsed.host};port=${parsed.port || '3306'};dbname=${parsed.db || 'DB_NAME'};charset=utf8mb4`
    : engine === 'postgres'
      ? `pgsql:host=${parsed.host};port=${parsed.port || '5432'};dbname=${parsed.db || 'DB_NAME'}`
      : '';

  const phpEnv = `DB_DSN="${phpDsn}"
DB_USER="${parsed.user || 'DB_USER'}"
DB_PASS="${parsed.pass || 'DB_PASS'}"`;

  const phpSnippet = `<?php
require_once __DIR__ . '/mydb.php';
$dsn = '${phpDsn}';
$user = '${parsed.user || 'DB_USER'}';
$pass = '${parsed.pass || 'DB_PASS'}';
$db = new MyDB($dsn, $user, $pass);
try {
  $rows = $db->query('SELECT NOW()');
  print_r($rows);
} catch (Exception $e) {
  echo $e->getMessage();
}
?>`;

  const nodeSnippet = `const mysql = require('mysql2/promise');
(async ()=>{
  const conn = await mysql.createConnection({host:'${parsed.host}',user:'${parsed.user}',password:'${parsed.pass}',database:'${parsed.db}',port:${parsed.port || 3306}});
  const [rows] = await conn.query('SELECT NOW()');
  console.log(rows);
  await conn.end();
})();`;

  const pythonSnippet = `import pymysql
conn = pymysql.connect(host='${parsed.host}', user='${parsed.user}', password='${parsed.pass}', database='${parsed.db}', port=${parsed.port || 3306})
with conn.cursor() as cur:
    cur.execute('SELECT NOW()')
    print(cur.fetchone())`;

  const mongoSnippet = `const { MongoClient } = require('mongodb');
const client = new MongoClient('${connectionString}');
(async ()=>{ await client.connect(); const db = client.db('${parsed.db || 'admin'}'); const res = await db.command({ ping: 1 }); console.log(res); await client.close(); })();`;

  const one_time_token = uuidv4();

  const snippets: Partial<Snippets> = {
    php: { dsn: phpDsn, env: phpEnv, snippet: phpSnippet },
    node: { connectionCode: nodeSnippet },
    python: { connectionCode: pythonSnippet },
    mongo: { connectionCode: mongoSnippet }
  };

  return { snippets, one_time_token };
}

export default { generateSnippets };
