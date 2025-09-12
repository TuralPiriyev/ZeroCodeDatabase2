
# UI Patches, Exporter Enhancements and Migration Guidance

This file contains concrete frontend patches, generator mapping rules, event names, validation requirements, and a reference to a non-destructive migration plan. Integrate these snippets into `src/components/allWorkSpace/*` (EnhancedTableBuilder, TableNode, SmartExportManager) and generator in `SmartExportManager.tsx`.

## 1) TypePicker (detailed)

Requirements
- For text: type selector (NVARCHAR preferred), preset length buttons (50,100,255), and a custom integer input 1..4000 plus `MAX` option.
- For decimal: precision input (1..38) and scale input (0..precision). Show quick-presets (18,2) but allow custom.

Component sketch (to be wired into existing Table/Column UI):

```tsx
// src/components/allWorkSpace/tools/TypePicker.tsx (concept)
import React from 'react';

export function TypePicker({ columnMeta, onChange }) {
  // columnMeta: { type, length, precision, scale }
  // onChange should emit updated metadata used by generator
  return (
    <div>
      {/* Type select */}
      {/* If NVARCHAR selected show length presets + custom input + MAX */}
      {/* If DECIMAL show precision & scale inputs with validation */}
    </div>
  );
}
```

Generator mapping rules (backend)
- Text -> if length === 'MAX' -> `NVARCHAR(MAX)`; else `NVARCHAR(<len>)`.
- Decimal -> `DECIMAL(<precision>,<scale>)` with validation 1<=precision<=38, 0<=scale<=precision. Default DECIMAL(18,2).

Validation
- Client + server: enforce numeric ranges, required when type needs them.

## 2) Default Value Editor (detailed)

Requirements
- Mode toggle: Static vs Function.
- Function dropdown includes: GETDATE(), SYSUTCDATETIME(), NEWID(), CURRENT_TIMESTAMP, USER_NAME().
- If Function chosen, generator must emit unquoted default (e.g., DEFAULT GETDATE()).

Snippet (concept):

```tsx
// DefaultEditor.tsx (concept)
const functions = ['GETDATE()', 'SYSUTCDATETIME()', 'NEWID()', 'CURRENT_TIMESTAMP', 'USER_NAME()'];

export function DefaultEditor({ mode, value, onChange }) {
  // render radio toggle for mode, static input or functions dropdown
}
```

Generator rule
- if defaultMode === 'function' -> emit DEFAULT <FUNCTION> (no quotes)
- if static -> perform type-aware quoting/validation

## 3) FK Add / Canvas auto-draw

Problem: after Add FK + Save table, canvas didn't draw relationship.

Solution (event-driven)
- When a table save operation persists a new FK, dispatch an event and a redux action:

Event name and payload
- Event: `relationship:added`
- Payload: { childTableId, parentTableId, childCol, parentCol, constraintName }

Redux-style action snippet

```ts
// actions/relationship.ts
export const RELATIONSHIP_ADDED = 'RELATIONSHIP_ADDED';
export const relationshipAdded = (payload) => ({ type: RELATIONSHIP_ADDED, payload });
```

Integration points
- In table save flow (where backend returns FK created), call `dispatch(relationshipAdded(payload))` and also `emit('relationship:added', payload)` on any internal event bus.
- Canvas subscriber: `useEffect(() => { subscribe('relationship:added', canvas.addRelationship) }, [])`.

Conservative behavior
- If FK creation fails server-side, do not draw connector and show the error to user.

## 4) Export header / filename

- Add `Schema name` input into Export modal. If empty: use `EXPORTED_DB_${timestamp}`.
- Prepend SQL with:

```
CREATE DATABASE [EXPORTED_DB_YYYYMMDD_HHMMSS];
GO
USE [EXPORTED_DB_YYYYMMDD_HHMMSS];
GO
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
```

## 5) Validation (client & server)

- Length inputs: 1..4000 or MAX.
- Decimal: precision 1..38, scale 0..precision.
- Default static values must match column type (number, bit, string, datetime). Server validates as final guard.

## 6) Migration guidance (non-destructive)

Do NOT alter live tables destructively. For identity additions or column type changes recommend non-destructive migration:
- Add new column (e.g., NewProductId INT IDENTITY(1,1)) and backfill appropriately.
- Introduce triggers or application-level mapping while migrating.
- See `patches/non_destructive_migration_plan.sql` for a suggested sequence and TODO markers for manual review.

## 7) Event names & wiring summary

- relationship:added — when FK created
- schema:exported — when an export is generated (payload: { schemaName, generatedAt, fileName })

## 8) Tests to add

- Unit tests for TypePicker — ensure values map to NVARCHAR(len) or NVARCHAR(MAX) and decimal maps to DECIMAL(p,s).
- Unit tests for DefaultEditor — ensure function selection results in unquoted SQL.
- Integration test for save-FK flow — ensure `relationship:added` dispatched and canvas draws connector.

## 9) Manual review / TODO handling

- Ambiguous FK references are not auto-applied — they are listed in `change_log.json` under `manual_review_ambiguous_fk`. Add TODO comments in generated SQL near ambiguous cases.

----

See also: `patches/non_destructive_migration_plan.sql`.
