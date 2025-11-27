// server/controllers/admin/productAdminController.js

import Product from '../../models/Product.js';
import { catchAsync } from '../../middlewares/errorHandler.js';

// GET /api/admin/products - שליפת כל המוצרים מ-MongoDB
export const getAllProducts = catchAsync(async (req, res, next) => {
    const products = await Product.find({ isActive: true }).sort({ createdAt: -1 });
    // Add productId for client compatibility if needed
    const productsWithId = products.map(p => ({ ...p.toObject(), productId: p._id }));
    res.status(200).json(productsWithId);
});

// POST /api/admin/products - יצירת מוצר חדש ב-MongoDB
export const createProduct = catchAsync(async (req, res, next) => {
    const newProduct = await Product.create(req.body);
    res.status(201).json({ ...newProduct.toObject(), productId: newProduct._id });
});

// PUT /api/admin/products/:id - עדכון מוצר קיים ב-MongoDB
export const updateProduct = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const updatedProduct = await Product.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });

    if (!updatedProduct) {
        return res.status(404).json({ message: "המוצר לא נמצא." });
    }

    res.status(200).json({ ...updatedProduct.toObject(), productId: updatedProduct._id });
});

// DELETE /api/admin/products/:id - מחיקת מוצר (סימון כמושבת) ב-MongoDB
export const deleteProduct = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const product = await Product.findByIdAndUpdate(id, { isActive: false });

    if (!product) {
        return res.status(404).json({ message: "המוצר לא נמצא." });
    }

    res.status(204).send(); // No Content
});