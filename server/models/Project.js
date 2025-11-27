import mongoose from 'mongoose';

/*
 * Sub-schemas for tasks and funds, embedded within a project.
 */
const taskSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  done: { type: Boolean, default: false },
});

const fundSchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: 0 },
  destination: { type: String, trim: true },
  date: { type: Date, default: Date.now },
});

/*
 * Main project schema.
 */
const projectSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  projectName: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  projectType: { type: String, required: true, enum: ['goal', 'task'] },
  
  // Fields for "goal" type projects
  targetAmount: {
    type: Number,
    min: 0,
    // Required only if the project type is 'goal'
    required() { return this.projectType === 'goal'; },
  },
  currentAmount: { type: Number, min: 0, default: 0 },
  
  // Embedded documents based on project type
  tasks: [taskSchema],
  funds: [fundSchema],

  dueDate: { type: Date },
}, { timestamps: true });

/**
 * Middleware (pre-save hook) to automatically calculate current and target amounts.
 * This logic runs before any `save()` operation on a project document.
 */
projectSchema.pre('save', function (next) {
  if (this.projectType === 'goal') {
    // For goal projects, currentAmount is the sum of all funds.
    this.currentAmount = (this.funds || []).reduce((sum, f) => sum + f.amount, 0);
  } else if (this.projectType === 'task') {
    // For task projects, currentAmount is the sum of completed tasks,
    // and targetAmount is the sum of all tasks.
    const doneSum = (this.tasks || []).filter(t => t.done).reduce((sum, t) => sum + t.amount, 0);
    const totalSum = (this.tasks || []).reduce((sum, t) => sum + t.amount, 0);
    this.currentAmount = doneSum;
    this.targetAmount = totalSum;
  }
  next();
});

export default mongoose.model('Project', projectSchema);
