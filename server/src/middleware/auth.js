import jwt from 'jsonwebtoken';
import {ApiError} from '../errors.js';
import {User} from '../models.js';
export function requireAuth(secret) {
  return async(req,res,next)=>{
    const authorization=req.get('authorization')??'';
    if (!/^Bearer [^ ]+$/.test(authorization)) throw new ApiError(401,'UNAUTHORIZED','Sign in to access your planner.');
    let claims;
    try { claims=jwt.verify(authorization.slice(7),secret,{algorithms:['HS256'],issuer:'can-i-bunk',audience:'can-i-bunk-web'}); }
    catch { throw new ApiError(401,'UNAUTHORIZED','Your sign-in expired or is invalid. Sign in again.'); }
    if (typeof claims.sub!=='string' || !/^[a-f0-9]{24}$/.test(claims.sub)) throw new ApiError(401,'UNAUTHORIZED','Invalid sign-in.');
    const user=await User.findById(claims.sub).lean();
    if (!user) throw new ApiError(401,'UNAUTHORIZED','Account unavailable. Sign in again.');
    req.user=user;
    next();
  };
}
