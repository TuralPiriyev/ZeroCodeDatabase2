// Simple heuristic classifier for database-related questions.
// Also covered by unit tests in tests/isLikelyDbQuestion.test.js

const KEYWORDS = [
  'select', 'insert', 'update', 'delete', 'join', 'schema', 'primary key', 'foreign key', 'normalize', 'normaliz', 'index', 'query', 'stored procedure', 'transaction', 'migration', 'table', 'column', 'uuid', 'authentication', 'password', 'hash', 'indexing', 'foreign', 'primary', 'constraint', 'ddl', 'dml'
];

export function isLikelyDbQuestion(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const t = text.toLowerCase();
  // If contains punctuation-only or very short non-word, treat as non-db
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;

  // If any keyword is present as substring
  for (const k of KEYWORDS) {
    if (t.includes(k)) return true;
  }

  // Heuristic: if it contains SQL-like characters or backticks or parentheses with SELECT
  if (/\bselect\b|\binsert\b|\bupdate\b|\bdelete\b/.test(t)) return true;
  if (/[;\*\(\)\.=]/.test(t) && t.length > 10) return true;

  return false;
}

export default isLikelyDbQuestion;
