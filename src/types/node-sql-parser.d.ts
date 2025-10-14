declare module 'node-sql-parser' {
  export class Parser {
    constructor(options?: any);
    astify(sql: string, options?: any): any;
    sqlify(ast: any, options?: any): string;
  }
  export function parse(sql: string, db?: string): any;
  const _default: any;
  export default _default;
}
