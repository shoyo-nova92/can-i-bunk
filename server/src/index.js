import dotenv from 'dotenv';
import {fileURLToPath} from 'node:url';
import {createApp} from './app.js';
import {connectDatabase,disconnectDatabase} from './database.js';
dotenv.config({path:fileURLToPath(new URL('../.env',import.meta.url)),quiet:true});
try {
  if(process.env.JWT_SECRET?.includes('REPLACE_'))throw new Error('Replace the example JWT_SECRET with a generated secret.');
  const app=createApp({jwtSecret:process.env.JWT_SECRET});
  await connectDatabase(process.env.MONGODB_URI);
  const port=Number(process.env.PORT??3000);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT must be an integer from 1 to 65535.');
  const server=app.listen(port,process.env.HOST??'127.0.0.1',()=>console.log(`Can I Bunk running at http://${process.env.HOST??'127.0.0.1'}:${port}; MongoDB connected.`));
  const stop=()=>server.close(async()=>{await disconnectDatabase();process.exit(0);});
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
} catch(error) {
  console.error('Startup failed:',/MONGODB_URI|JWT_SECRET|PORT|Replace/.test(error.message)?error.message:'MongoDB connection failed. Check the URI, Atlas IP access list, and database user credentials.');
  await disconnectDatabase();process.exitCode=1;
}
