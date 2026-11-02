import {Planner} from '../models.js';
import {ApiError} from '../errors.js';
import {object,revision,record,plannerState} from '../validation.js';
import {emptyState} from '../../../data.js';
const result=planner=>({state:planner.state,revision:planner.revision});
async function load(owner) {
  return Planner.findOneAndUpdate({owner},{$setOnInsert:{revision:0,state:emptyState()}},{upsert:true,new:true}).lean();
}
async function commit(owner,expected,state) {
  const saved=await Planner.findOneAndUpdate({owner,revision:expected},{$set:{state},$inc:{revision:1}},{new:true,runValidators:true}).lean();
  if (!saved) throw new ApiError(409,'REVISION_CONFLICT','Another save changed this planner. Download your unsaved records before loading the latest version.');
  return saved;
}
export const getState=async(req,res)=>res.json(result(await load(req.user._id)));
export const putState=async(req,res)=>{
  object(req.body,['state','revision']);
  const expected=revision(req.body.revision);
  const state=plannerState(req.body.state);
  await load(req.user._id);
  res.json(result(await commit(req.user._id,expected,state)));
};
export function collectionControllers(kind) {
  const singular=kind==='subjects'?'subject':'session';
  return {
    list:async(req,res)=>{const planner=await load(req.user._id);res.json({[kind]:planner.state[kind],revision:planner.revision});},
    get:async(req,res)=>{const planner=await load(req.user._id);const value=planner.state[kind].find(item=>item.id===req.params.id);if(!value)throw new ApiError(404,'NOT_FOUND','Record not found.');res.json({[singular]:value,revision:planner.revision});},
    mutate:operation=>async(req,res)=>{
      object(req.body,operation==='create'?[singular,'revision']:operation==='update'?['changes','revision']:['revision']);
      const expected=revision(req.body.revision);
      const planner=await load(req.user._id);
      const state=planner.state;
      if(operation==='create') state[kind].push(record(req.body[singular],kind));
      else {
        const index=state[kind].findIndex(item=>item.id===req.params.id);
        if(index<0)throw new ApiError(404,'NOT_FOUND','Record not found.');
        if(operation==='update')Object.assign(state[kind][index],record(req.body.changes,kind,true));
        else {
          state[kind].splice(index,1);
          if(kind==='subjects')state.sessions=state.sessions.filter(session=>session.subjectId!==req.params.id);
        }
      }
      plannerState(state,{recalculate:true});
      res.status(operation==='create'?201:200).json(result(await commit(req.user._id,expected,state)));
    }
  };
}
