import mongoose from 'mongoose';
import {initializeModels} from './models.js';
import {ConfigurationError} from './startup-errors.js';
export async function connectDatabase(uri) {
  if(typeof uri!=='string'||!/^mongodb(?:\+srv)?:\/\//.test(uri))throw new ConfigurationError('MONGODB_URI is required. Configure server/.env with your MongoDB Atlas URI.');
  if (/DATABASE_USER|URL_ENCODED_PASSWORD|@CLUSTER\./.test(uri)) throw new ConfigurationError('MONGODB_URI still contains example placeholders. Replace it with your MongoDB Atlas URI.');
  await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
  await initializeModels();
}
export async function disconnectDatabase(){await mongoose.disconnect();}
