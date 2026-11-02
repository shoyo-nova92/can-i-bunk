import {connectDatabase,disconnectDatabase} from './database.js';
import {classifyStartupFailure} from './startup-errors.js';

export async function connectDatabaseWithRetry(uri,{
  connect=connectDatabase,
  disconnect=disconnectDatabase,
  delay=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds)),
  report=message=>console.warn(message)
}={}) {
  const attempts=4;
  for(let attempt=1;attempt<=attempts;attempt++) {
    try { await connect(uri);return; }
    catch(error) {
      const failure=classifyStartupFailure(error);
      // Finish closing the previous client before another connection attempt.
      try { await disconnect(); } catch { /* Final failure remains sanitized. */ }
      if(!failure.retryable || attempt===attempts)throw error;
      report(`${failure.message} Retrying startup (${attempt+1}/${attempts}) in 1 second.`);
      await delay(1000);
    }
  }
}
