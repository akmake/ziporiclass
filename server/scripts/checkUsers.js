import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/userModel.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const check = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const users = await User.find({}, 'name email role');
  console.table(users.map(u => ({ Name: u.name, Email: u.email, Role: u.role })));
  process.exit(0);
};
check();