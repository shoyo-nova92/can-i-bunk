import dotenv from 'dotenv';
import {fileURLToPath} from 'node:url';
import {createApp} from './app.js';
import {disconnectDatabase} from './database.js';
import {connectDatabaseWithRetry} from './startup.js';
import {ConfigurationError,classifyStartupFailure} from './startup-errors.js';
dotenv.config({path:fileURLToPath(new URL('../.env',import.meta.url)),quiet:true});
try {
  if(typeof process.env.JWT_SECRET!=='string'||process.env.JWT_SECRET.length<32||process.env.JWT_SECRET.includes('REPLACE_'))throw new ConfigurationError('JWT_SECRET must be a generated secret of at least 32 characters.');
  const app=createApp({jwtSecret:process.env.JWT_SECRET});
  const port=Number(process.env.PORT??3000);
  if(!Number.isInteger(port)||port<1||port>65535)throw new ConfigurationError('PORT must be an integer from 1 to 65535.');
  await connectDatabaseWithRetry(process.env.MONGODB_URI);
  const server=app.listen(port,process.env.HOST??'127.0.0.1',()=>console.log(`Can I Bunk running at http://${process.env.HOST??'127.0.0.1'}:${port}; MongoDB connected.`));
  const stop=()=>server.close(async()=>{await disconnectDatabase();process.exit(0);});
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
} catch(error) {
  console.error('Startup failed:',classifyStartupFailure(error).message);
  try { await disconnectDatabase(); } catch { /* Do not expose driver errors during cleanup. */ }
  process.exitCode=1;
}
