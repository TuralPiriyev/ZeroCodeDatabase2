/*
  Repo-level ambient declarations for CPS workspace to help the
  TypeScript server find minimal types for third-party modules used
  by the CPS subproject when @types packages aren't installed.

  This file is placed under the repository `src` tree so the root
  tsconfig.app.json (which includes `src`) picks it up automatically.
*/

declare module 'cookie-parser';
declare module 'pg';
declare module 'bcryptjs';
declare module 'better-sqlite3';
declare module 'mysql2/promise';
declare module 'mongodb';
declare module 'jsonwebtoken';

export {};
