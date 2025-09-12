                  {/* Column Name */}
                  <input
                    type="text"
                    value={column.name}
                    onChange={(e) => updateColumn(index, { name: e.target.value })}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    placeholder="Column name"
                  />

                  {/* Data Type */}
                  <div className="flex items-center gap-2">
                    <select
                      value={column.type}
                      onChange={(e) => updateColumn(index, { type: e.target.value })}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    >
                      {dataTypes.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                        <option value="NVARCHAR">NVARCHAR</option>
                        <option value="VARCHAR">VARCHAR</option>
                        <option value="DECIMAL">DECIMAL</option>
                    </select>
                    </div>
                    {/* Inline editors for NVARCHAR/VARCHAR length and DECIMAL precision/scale */}
                    {(() => {
                      const tRaw = String(column.type || '');
                      const t = tRaw.toUpperCase();
                      if (t.startsWith('NVARCHAR') || t.startsWith('VARCHAR')) {
                        // extract existing length if present
                        const m = t.match(/^(N?VARCHAR)\s*\(([^)]+)\)/i);
                        const base = m ? m[1].toUpperCase() : (t.startsWith('N') ? 'NVARCHAR' : 'VARCHAR');
                        const existing = m ? m[2] : '';
                        return (
                          <div className="flex items-center gap-2 mt-2">
                            <label className="text-sm text-gray-700 dark:text-gray-300">Length</label>
                            <input
                              type="text"
                              placeholder="e.g. 255 or MAX"
                              defaultValue={existing}
                              onBlur={(e) => {
                                const v = String(e.target.value || '').trim().toUpperCase();
                                const newType = (v === 'MAX' || v === '') ? `${base}(MAX)` : `${base}(${Number(v) || 0})`;
                                updateColumn(index, { type: newType });
                              }}
                              className="w-32 px-2 py-1 border rounded text-sm"
                            />
                          </div>
                        );
                      }

                      if (t.startsWith('DECIMAL')) {
                        const m = t.match(/^DECIMAL\s*\((\d+)\s*,\s*(\d+)\)/i);
                        const prec = m ? Number(m[1]) : 10;
                        const scale = m ? Number(m[2]) : 2;
                        return (
                          <div className="flex items-center gap-2 mt-2">
                            <label className="text-sm text-gray-700 dark:text-gray-300">Precision</label>
                            <input
                              type="number"
                              min={1}
                              max={38}
                              defaultValue={prec}
                              onBlur={(e) => {
                                const p = Number(e.target.value) || prec;
                                const s = scale;
                                updateColumn(index, { type: `DECIMAL(${p},${s})` });
                              }}
                              className="w-20 px-2 py-1 border rounded text-sm"
                            />
                            <label className="text-sm text-gray-700 dark:text-gray-300">Scale</label>
                            <input
                              type="number"
                              min={0}
                              max={38}
                              defaultValue={scale}
                              onBlur={(e) => {
                                const s = Number(e.target.value);
                                const pMatch = String(column.type).match(/DECIMAL\((\d+),(\d+)\)/i);
                                const p = pMatch ? Number(pMatch[1]) : 10;
                                updateColumn(index, { type: `DECIMAL(${p},${s})` });
                              }}
                              className="w-20 px-2 py-1 border rounded text-sm"
                            />
                          </div>
                        );
                      }

                      return null;
                    })()}
                  </div>

                  {/* Default Value */}
                  <input
                    type="text"
                    value={column.defaultValue || ''}
                    onChange={(e) => updateColumn(index, { defaultValue: e.target.value })}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    placeholder="Default value (optional)"
                  />

                  {/* Checkboxes */}
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!column.nullable}
                        onChange={(e) => updateColumn(index, { nullable: !e.target.checked })}
                        className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                      />
                      <span className="text-gray-700 dark:text-gray-300">Not Null</span>
                    </label>

                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={column.isPrimaryKey || false}
                        onChange={(e) => updateColumn(index, { isPrimaryKey: e.target.checked })}
                        className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                      />
                      <Key className="w-4 h-4 text-yellow-500" />
                      <span className="text-gray-700 dark:text-gray-300">Primary Key</span>
                    </label>

                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={column.isForeignKey || false}
                        onChange={(e) => updateColumn(index, { isForeignKey: e.target.checked })}
                        className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                      />
                      <Link2 className="w-4 h-4 text-blue-500" />
                      <span className="text-gray-700 dark:text-gray-300">Foreign Key</span>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Button */}
      <button
        onClick={createTable}
        disabled={!table.name.trim() || table.columns.length === 0}
        className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors duration-200 font-medium"
      >
        Create Table
      </button>
    </div>
  );

// export default TableBuilder; // Removed stray export statement
export default TableBuilder;