const e = React.createElement;

// Prompt for the admin key only once per page load to avoid endless dialogs
let apiKey = window.sessionStorage.getItem('cps_admin_api_key');
if (!apiKey) {
  apiKey = prompt('Enter ADMIN API KEY for demo UI:');
  if (apiKey) {
    window.sessionStorage.setItem('cps_admin_api_key', apiKey);
    window.sessionStorage.removeItem('cps_csrf_token');
  }
}

function App() {
  const [dbs, setDbs] = React.useState([]);
  const [name, setName] = React.useState('');
  const [type, setType] = React.useState('mysql');
  const [host, setHost] = React.useState('localhost');
  const [port, setPort] = React.useState('');
  const [csrf, setCsrf] = React.useState(window.sessionStorage.getItem('cps_csrf_token') || '');

  React.useEffect(() => {
    fetchList();
    if (!csrf) fetchCsrf();
  }, []);

  async function fetchList() {
    const res = await fetch('/api/databases', { headers: { 'x-api-key': apiKey } });
    if (res.status === 200) setDbs(await res.json());
    else console.error('failed to fetch', await res.text());
  }

  async function fetchCsrf() {
    const res = await fetch('/api/csrf-token', { headers: { 'x-api-key': apiKey } });
    if (res.ok) {
      const data = await res.json();
      if (data?.csrf) {
        setCsrf(data.csrf);
        window.sessionStorage.setItem('cps_csrf_token', data.csrf);
      }
    } else {
      console.error('failed to fetch csrf', await res.text());
    }
  }

  async function createDb() {
    if (!csrf) return alert('CSRF token not ready yet. Refresh the page if this persists.');
    const body = { name, type, host, port: port ? Number(port) : undefined };
    const res = await fetch('/api/databases', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'x-csrf-token': csrf },
      body: JSON.stringify(body)
    });
    if (res.ok) { setName(''); setHost(''); setPort(''); fetchList(); }
    else alert('failed: ' + await res.text());
  }

  async function provision(dbId) {
    if (!csrf) return alert('CSRF token not ready yet. Refresh the page if this persists.');
    const usernamePrefix = prompt('username prefix (e.g., app)');
    const ttl = prompt('ttl seconds (optional)');
    const body = { usernamePrefix, ttl: ttl ? Number(ttl) : undefined };
    const res = await fetch(`/api/databases/${dbId}/provision-user`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'x-csrf-token': csrf },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      const data = await res.json();
      const text = 'Connection string:\n' + data.connectionString + '\n\nSnippets:\n' + JSON.stringify(data.snippets, null, 2);
      // show modal-like prompt
      alert(text);
    } else alert('failed: ' + await res.text());
  }

  async function downloadSnippet(path, filename) {
    // fetch static file
    const res = await fetch(path);
    if (!res.ok) return alert('failed to fetch snippet');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  return e('div', { style: { padding: 20 } },
    e('h2', null, 'CPS Admin UI (Minimal)'),
    e('div', null,
      e('input', { placeholder: 'db name', value: name, onChange: (e) => setName(e.target.value) }),
      e('select', { value: type, onChange: (e) => setType(e.target.value) },
        e('option', { value: 'mysql' }, 'MySQL'),
        e('option', { value: 'mongodb' }, 'MongoDB')
      ),
      e('input', { placeholder: 'host', value: host, onChange: (e) => setHost(e.target.value) }),
      e('input', { placeholder: 'port', value: port, onChange: (e) => setPort(e.target.value) }),
      e('button', { onClick: createDb }, 'Add DB')
    ),
    e('hr'),
    e('h3', null, 'Configured DBs'),
    e('ul', null, dbs.map((db) => e('li', { key: db.id },
      `${db.name} (${db.type}) — id: ${db.id} `,
      e('button', { onClick: () => provision(db.id) }, 'Provision user')
    )))
    , e('hr'), e('div', null, e('button', { onClick: () => downloadSnippet('/cps/snippets/mydb.php', 'mydb.php') }, 'Download PHP MyDB snippet'))
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(e(App));
