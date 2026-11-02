import {Router} from 'express';
import {rateLimit} from 'express-rate-limit';
import {authControllers} from './controllers/auth.js';
import {getState,putState,collectionControllers} from './controllers/planner.js';
import {requireAuth} from './middleware/auth.js';
export function routes(secret,{authLimit=30}={}) {
  const router=Router();
  const auth=authControllers(secret);
  const authenticate=requireAuth(secret);
  const limit=rateLimit({windowMs:15*60*1000,limit:authLimit,standardHeaders:'draft-8',legacyHeaders:false,message:{error:{code:'RATE_LIMITED',message:'Too many sign-in attempts. Retry in 15 minutes.'}}});
  router.post('/auth/register',limit,auth.register);
  router.post('/auth/login',limit,auth.login);
  router.get('/auth/me',authenticate,auth.me);
  router.use(authenticate);
  router.get('/state',getState);
  router.put('/state',putState);
  for(const kind of ['subjects','sessions']) {
    const controller=collectionControllers(kind);
    router.get(`/${kind}`,controller.list);
    router.get(`/${kind}/:id`,controller.get);
    router.post(`/${kind}`,controller.mutate('create'));
    router.patch(`/${kind}/:id`,controller.mutate('update'));
    router.delete(`/${kind}/:id`,controller.mutate('delete'));
  }
  return router;
}
