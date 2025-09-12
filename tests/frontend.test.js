// Minimal Jest tests (conceptual) for UI components
describe('TypePicker and DefaultEditor (conceptual)', () => {
  test('decimal precision/scale bounds', () => {
    const valid = (p, s) => p >= 1 && p <= 38 && s >= 0 && s <= p;
    expect(valid(18, 2)).toBe(true);
    expect(valid(1, 0)).toBe(true);
    expect(valid(38, 38)).toBe(true);
    expect(valid(10, 11)).toBe(false); // scale > precision invalid
  });

  test('NVARCHAR mapping and MAX handling', () => {
    const map = (type, len) => type === 'NVARCHAR' && (len === 'MAX' ? 'NVARCHAR(MAX)' : `NVARCHAR(${len})`);
    expect(map('NVARCHAR', 255)).toBe('NVARCHAR(255)');
    expect(map('NVARCHAR', 'MAX')).toBe('NVARCHAR(MAX)');
  });

  test('default function should not be quoted', () => {
    const selectedFunction = 'GETDATE()';
    const sql = `CreatedAt DATETIME2 DEFAULT ${selectedFunction}`;
    expect(sql).toContain('DEFAULT GETDATE()');
  });

  test('relationship:added event payload shape', () => {
    const payload = { childTableId: 't1', parentTableId: 't2', childCol: 'ProductId', parentCol: 'ProductId', constraintName: 'FK_OrderItems_Products_ProductId' };
    expect(payload).toHaveProperty('childTableId');
    expect(payload).toHaveProperty('parentTableId');
    expect(payload).toHaveProperty('childCol');
    expect(payload).toHaveProperty('parentCol');
    expect(payload.constraintName).toMatch(/^FK_/);
  });
});
