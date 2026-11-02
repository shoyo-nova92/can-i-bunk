import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {User,Planner} from '../models.js';
import {object} from '../validation.js';
import {ApiError} from '../errors.js';
import {emptyState} from '../../../data.js';

export const publicUser=user=>({id:String(user._id),name:user.name,email:user.email});
export function authControllers(secret) {
  const response=user=>({user:publicUser(user),token:jwt.sign({},secret,{algorithm:'HS256',subject:String(user._id),issuer:'can-i-bunk',audience:'can-i-bunk-web',expiresIn:'2h'})});
  function credentials(body,registration=false) {
    object(body,registration?['name','email','password']:['email','password']);
    if (typeof body.email!=='string' || body.email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) throw new ApiError(400,'VALIDATION_ERROR','Enter a valid email address.');
    if (typeof body.password!=='string' || body.password.length<10 || Buffer.byteLength(body.password,'utf8')>72) throw new ApiError(400,'VALIDATION_ERROR','Password must have at least 10 characters and at most 72 UTF-8 bytes.');
    if (registration && (typeof body.name!=='string'||!body.name.trim()||body.name.trim().length>80)) throw new ApiError(400,'VALIDATION_ERROR','Name must contain 1–80 characters.');
    return body.email.trim().toLowerCase();
  }
  return {
    register:async(req,res)=>{
      const email=credentials(req.body,true);
      const user=await User.create({email,name:req.body.name.trim(),passwordHash:await bcrypt.hash(req.body.password,12)});
      // Planner initialization is independently idempotent, so failed initialization can recover on the next authenticated request.
      await Planner.updateOne({owner:user._id},{$setOnInsert:{revision:0,state:emptyState()}},{upsert:true});
      res.status(201).json(response(user));
    },
    login:async(req,res)=>{
      const email=credentials(req.body);
      const user=await User.findOne({email}).select('+passwordHash');
      const hash=user?.passwordHash??'$2b$12$hSnc2xjYn5N3Xw3XgOk69uOLuIdr.MQPdhKBDURgK9/ci8qnSFcxC';
      const valid=await bcrypt.compare(req.body.password,hash);
      if (!user||!valid) throw new ApiError(401,'INVALID_CREDENTIALS','Email or password is incorrect.');
      res.json(response(user));
    },
    me:(req,res)=>res.json({user:publicUser(req.user)})
  };
}
