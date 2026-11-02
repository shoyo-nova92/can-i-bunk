import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {routes} from './routes.js';
import {errorHandler,ApiError} from './errors.js';
const frontend=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const publicFiles=new Set(['index.html','styles.css','app.js','data.js','attendance.js','planner.js','storage.js','calendar.js','setup.js','timetable.js','timetable-parser.js','file-readers.js','dom.js','api.js','account.js','cloud-storage.js']);
export function createApp({jwtSecret,authLimit}={}) {
  if(typeof jwtSecret!=='string'||jwtSecret.length<32)throw new Error('JWT_SECRET must contain at least 32 characters.');
  const app=express();
  app.disable('x-powered-by');
  app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'","'wasm-unsafe-eval'"],workerSrc:["'self'",'blob:'],imgSrc:["'self'",'data:','blob:'],connectSrc:["'self'",'blob:'],styleSrc:["'self'","'unsafe-inline'"],upgradeInsecureRequests:null}},crossOriginEmbedderPolicy:false}));
  app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store');next();});
  app.get('/api/health',(req,res)=>{const connected=mongoose.connection.readyState===1;res.status(connected?200:503).json({status:connected?'ok':'unavailable',database:connected?'connected':'disconnected'});});
  app.use('/api',express.json({limit:'8mb',strict:true}),routes(jwtSecret,{authLimit}));
  app.use('/api',(req,res,next)=>next(new ApiError(404,'NOT_FOUND','API endpoint not found.')));
  app.use('/vendor',express.static(path.join(frontend,'vendor'),{dotfiles:'deny',fallthrough:false,index:false}));
  app.get('/',(req,res)=>res.sendFile(path.join(frontend,'index.html')));
  app.use((req,res,next)=>{
    const file=req.path.slice(1);
    if((req.method==='GET'||req.method==='HEAD')&&publicFiles.has(file))return res.sendFile(path.join(frontend,file));
    next(new ApiError(404,'NOT_FOUND','Resource not found.'));
  });
  app.use(errorHandler);
  return app;
}
