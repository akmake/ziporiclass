import ExtraType from '../../models/ExtraType.js';
import { catchAsync } from '../../middlewares/errorHandler.js';

export const getExtraTypes = catchAsync(async (req, res) => {
    const types = await ExtraType.find({}).sort({ name: 1 });
    res.json(types);
});

export const createExtraType = catchAsync(async (req, res) => {
    const { name } = req.body;
    const newType = await ExtraType.create({ name });
    res.status(201).json(newType);
});

export const deleteExtraType = catchAsync(async (req, res) => {
    await ExtraType.findByIdAndDelete(req.params.id);
    res.status(204).send();
});