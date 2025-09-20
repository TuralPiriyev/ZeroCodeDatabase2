import { Server } from 'http';
import express = require('express');
declare const app: express.Express & { listen: (port:number, cb?:()=>void) => Server };
export = app;
