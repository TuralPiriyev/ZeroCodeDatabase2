declare module 'pg' {
	export class Pool {
		constructor(opts?: any);
		connect(): Promise<any>;
		query(text: any, params?: any): Promise<any>;
		end(): Promise<void>;
	}
	export type PoolConfig = any;
}
export {};
