// Minimal Jest tests (conceptual) for UI components
describe('TypePicker and DefaultEditor (conceptual)', () => {
  test('decimal precision/scale bounds', () => {
    const precision = 18;
    const scale = 2;
    expect(precision).toBeGreaterThanOrEqual(1);
    expect(precision).toBeLessThanOrEqual(38);
    expect(scale).toBeGreaterThanOrEqual(0);
    expect(scale).toBeLessThanOrEqual(precision);
  });

  test('default function should not be quoted', () => {
    const selectedFunction = 'GETDATE()';
    const sql = `CreatedAt DATETIME2 DEFAULT ${selectedFunction}`;
    expect(sql).toContain('DEFAULT GETDATE()');
  });
});
