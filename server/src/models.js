import mongoose from 'mongoose';

// Configure before model compilation: otherwise Mongoose can start background
// collection creation during a reconnect and race a deliberate disconnect.
mongoose.set('bufferCommands',false);
mongoose.set('autoCreate',false);
mongoose.set('autoIndex',false);

const userSchema = new mongoose.Schema({
  name:{type:String,required:true,maxlength:80},
  email:{type:String,required:true,unique:true,maxlength:254},
  passwordHash:{type:String,required:true,select:false}
},{timestamps:true,strict:'throw'});
const slotSchema = new mongoose.Schema({day:Number,time:String},{_id:false,strict:'throw'});
const subjectSchema = new mongoose.Schema({id:String,name:String,total:Number,attended:Number,missed:Number,endDate:String,weekly:[slotSchema],historyThrough:String,historyThroughTime:String,totalMode:String},{_id:false,strict:'throw'});
const sessionSchema = new mongoose.Schema({id:String,subjectId:String,date:String,time:String,actual:String,plan:String,cancelled:Boolean},{_id:false,strict:'throw'});
const stateSchema = new mongoose.Schema({version:Number,subjects:[subjectSchema],sessions:[sessionSchema]},{_id:false,strict:'throw'});
const plannerSchema = new mongoose.Schema({owner:{type:mongoose.Schema.Types.ObjectId,ref:'User',unique:true,required:true},revision:{type:Number,required:true,default:0},state:{type:stateSchema,required:true}},{timestamps:true,strict:'throw',minimize:false});
export const User = mongoose.model('User', userSchema);
export const Planner = mongoose.model('Planner', plannerSchema);
export async function initializeModels() {
  await Promise.all([User.init(),Planner.init()]);
  await Promise.all([User.createIndexes(),Planner.createIndexes()]);
}
