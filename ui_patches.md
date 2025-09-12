# UI Patches and Exporter Improvements

This document describes the frontend patches to implement the requested exporter and UI fixes. It contains code snippets (React + TypeScript) and mapping rules for the backend generator.

## 1) Type Picker enhancement

- Add controls for custom length and precision/scale.
- For text types: allow integer length 1..4000 and `MAX`.
- For decimal: precision 1..38 and scale 0..precision.

Example TSX snippet (concept):

```tsx
// TypePicker.tsx (concept)
export function TypePicker({ value, onChange }) {
  const [type, setType] = useState(value.type || 'NVARCHAR');
  const [length, setLength] = useState<number | 'MAX'>(value.length || 255);
  const [precision, setPrecision] = useState(value.precision || 18);
  const [scale, setScale] = useState(value.scale || 2);

  // render UI with preset buttons and custom inputs
}
```

Generator mapping (backend):

- If type === 'NVARCHAR' and length === 'MAX' -> `NVARCHAR(MAX)`
- If type === 'NVARCHAR' and numeric length -> `NVARCHAR(<len>)`
- If type === 'DECIMAL' -> `DECIMAL(<precision>,<scale>)`

## 2) Default Value Editor

- Two modes: Static and Function. When function selected, don't quote value in SQL.

Snippet (concept):

```tsx
// DefaultEditor.tsx
const functions = ['GETDATE()', 'SYSUTCDATETIME()', 'NEWID()', 'CURRENT_TIMESTAMP', 'USER_NAME()'];

function DefaultEditor({ mode, value, onChange }) {
  // mode: 'static'|'function'
  // if function, show dropdown of functions
}
```

Generator rule:

- If defaultMode === 'function' -> emit `DEFAULT GETDATE()` (no quotes)
- Else -> quote literals appropriately (numbers/bit/date checks enforced)

## 3) FK auto-draw & event

- When user adds FK and saves table, emit `relationship:added` event with payload:

```ts
{ fromTableId, toTableId, fromCol, toCol, constraintName }
```

- Canvas should subscribe and call `canvas.addRelationship(payload)`.

Snippet (Redux-ish):

```ts
// actions.ts
export const relationshipAdded = (payload) => ({ type: 'RELATIONSHIP_ADDED', payload });

// reducer.ts
case 'RELATIONSHIP_ADDED':
  // update relationships list

// Table save flow
dispatch(relationshipAdded(payload));

// Canvas listener
useEffect(() => subscribe('relationship:added', canvas.addRelationship), []);
```

Event names: `relationship:added`, `schema:exported`

## 4) Export header

- If `schemaName` absent, set default `EXPORTED_DB_<timestamp>` in exporter.

## 5) Validation

- Client and server side validation for length/precision inputs and default value types.

## Tests

- Add unit tests for TypePicker behavior and DefaultEditor function selection.

---

Notes: these snippets are intentionally minimal and intended to be integrated into `src/components/allWorkSpace/tools/*` and the generator in `SmartExportManager.tsx`.
