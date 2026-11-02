export class ConfigurationError extends Error {}

// MongoDB server-selection failures can wrap the useful error several levels
// deep. Inspect bounded metadata internally; never return driver error text.
function details(error) {
  const queue=[error], found=[], seen=new Set();
  while(queue.length && found.length<50) {
    const current=queue.shift();
    if(!current || typeof current!=='object' || seen.has(current))continue;
    seen.add(current);found.push(current);
    queue.push(current.cause,current.reason,current.error);
    if(current.servers instanceof Map)queue.push(...current.servers.values());
  }
  return found;
}
export function classifyStartupFailure(error) {
  if(error instanceof ConfigurationError)return {retryable:false,message:error.message};
  const errors=details(error);
  const text=errors.map(item=>String(item.message??'')).join(' ');
  if(errors.some(item=>[13,18].includes(item.code)) || /authentication failed|bad auth|not authorized|unauthorized/i.test(text)) {
    return {retryable:false,message:'MongoDB authentication or permissions failed. Check the database user credentials and access to the application database.'};
  }
  const retryable=errors.some(item=>['MongoNetworkError','MongoNetworkTimeoutError','MongoServerSelectionError','MongooseServerSelectionError'].includes(item.name));
  if(/alert(?: number)?\s*80|tlsv1 alert internal error/i.test(text))return {retryable,message:'MongoDB TLS negotiation failed (alert 80). The network may be intermittent; the explicit start:atlas command uses TLS 1.2 with certificate validation enabled.'};
  if(/ENOTFOUND|EAI_AGAIN|querySrv|queryTxt/i.test(text))return {retryable,message:'MongoDB DNS lookup failed. Check your internet connection and Atlas cluster address.'};
  if(retryable)return {retryable:true,message:'MongoDB network connection failed. Check internet access and the Atlas IP access list.'};
  return {retryable:false,message:'Startup could not complete. Check configuration and database permissions; no server is listening.'};
}
