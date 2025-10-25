import { Request, Response } from 'express';
import * as storage from '../services/storage';
import { getMetrics } from '../utils/metrics';

export function listAudit(req: Request, res: Response) {
  const dbId = req.query.dbId as string | undefined;
  const limit = Number(req.query.limit || 100);
  const rows = storage.listAudit(dbId, limit);
  res.json(rows);
}

export function exportAudit(req: Request, res: Response) {
  const format = (req.query.format as string || 'json').toLowerCase();
  const dbId = req.query.dbId as string | undefined;
  const rows = storage.listAudit(dbId, Number(req.query.limit || 1000));
  if (format === 'csv') {
    // simple CSV conversion
    if (!rows || rows.length === 0) {
      res.setHeader('Content-Type', 'text/csv');
      res.send('');
      return;
    }
    const keys = Object.keys(rows[0]);
    const header = keys.join(',');
    const lines = rows.map((r: any) => keys.map(k => {
      const v = r[k] === null || r[k] === undefined ? '' : String(r[k]).replace(/"/g, '""');
      return `"${v}"`;
    }).join(','));
    res.setHeader('Content-Type', 'text/csv');
    res.send([header, ...lines].join('\n'));
    return;
  }
  res.json(rows);
}

export function metrics(req: Request, res: Response) {
  res.json(getMetrics());
}
