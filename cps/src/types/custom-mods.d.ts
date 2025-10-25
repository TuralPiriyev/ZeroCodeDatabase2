/*
  Minimal ambient module declarations to quiet the TypeScript server
  while development proceeds without installing native modules / @types.

  These are intentionally broad — when you run `npm install` in an
  environment with build tools, prefer installing proper @types packages
  or rely on shipped types from the packages.
*/

declare module 'bcryptjs';
declare module 'cookie-parser';
declare module 'json2csv';
declare module 'better-sqlite3';
declare module 'mysql2/promise';
declare module 'mongodb';
declare module 'pg';
declare module 'jsonwebtoken';

// Allow importing .cjs files or other JS modules without types
declare module '*.cjs';
declare module '*.js';

// If any third-party has no types, this keeps the editor from erroring
// and gives us a chance to add proper types later.

export {};
