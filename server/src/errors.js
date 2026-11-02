export class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error instanceof ApiError) return res.status(error.status).json({error:{code:error.code,message:error.message}});
  if (error.type === 'entity.too.large') return res.status(413).json({error:{code:'PAYLOAD_TOO_LARGE',message:'Planner exceeds the 8 MB request limit.'}});
  if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({error:{code:'INVALID_JSON',message:'Request body must be valid JSON.'}});
  if (error.code === 11000) return res.status(409).json({error:{code:'EMAIL_EXISTS',message:'An account with this email already exists.'}});
  if (error.status === 403 || error.status === 404) return res.status(404).json({error:{code:'NOT_FOUND',message:'Resource not found.'}});
  const unavailable = /Mongo|Mongoose/.test(error.name);
  if (!unavailable) console.error('API failure:', error.name);
  res.status(unavailable ? 503 : 500).json({error:{code:unavailable?'DATABASE_UNAVAILABLE':'INTERNAL_ERROR',message:unavailable?'Database unavailable. Your changes were not saved.':'The request could not be completed.'}});
}
