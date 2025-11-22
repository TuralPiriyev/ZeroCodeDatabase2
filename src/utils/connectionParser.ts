export function parseConnectionString(conn: string) {
  try {
    const u = new URL(conn);
    const engine = u.protocol.replace(':', '');
    const user = decodeURIComponent(u.username || '');
    const pass = decodeURIComponent(u.password || '');
    const host = u.hostname;
    const port = u.port || (engine === 'mysql' ? '3306' : engine === 'mongodb' ? '27017' : '');
    const pathname = u.pathname ? u.pathname.replace(/^\//, '') : '';
    const params = Object.fromEntries(new URLSearchParams(u.search));
    return { engine, user, pass, host, port, db: pathname, params };
  } catch (e) {
    return { engine: '', user: '', pass: '', host: '', port: '', db: '', params: {} };
  }
}

export default parseConnectionString;
