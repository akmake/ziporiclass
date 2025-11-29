import User from '../../models/userModel.js';
import bcrypt from 'bcryptjs';

export const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({}).select('-passwordHash').sort({ name: 1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'שגיאה בטעינת המשתמשים' });
    }
};

export const updateUserPermissions = async (req, res) => {
    // ✨ הוספנו את canViewCommissions
    const { role, canManagePriceLists, canViewCommissions } = req.body;
    try {
        const user = await User.findById(req.params.id);
        if (user) {
            if (role) user.role = role;
            if (canManagePriceLists !== undefined) user.canManagePriceLists = canManagePriceLists;
            if (canViewCommissions !== undefined) user.canViewCommissions = canViewCommissions; // ✨ עדכון
            
            await user.save();
            res.json({ message: 'הרשאות עודכנו בהצלחה' });
        } else {
            res.status(404).json({ message: 'משתמש לא נמצא' });
        }
    } catch (error) {
        console.error("Update User Error:", error);
        res.status(500).json({ message: 'שגיאה בעדכון: ' + error.message });
    }
};

export const createUser = async (req, res) => {
    // ✨ הוספנו את canViewCommissions
    const { name, email, password, role, canManagePriceLists, canViewCommissions } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'שם, אימייל וסיסמה הם שדות חובה' });
    }

    try {
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'משתמש עם אימייל זה כבר קיים' });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        let finalRole = 'sales';
        if (role && ['admin', 'sales', 'maintenance'].includes(role)) {
            finalRole = role;
        }

        const user = await User.create({
            name,
            email,
            passwordHash,
            role: finalRole,
            canManagePriceLists: canManagePriceLists || false,
            canViewCommissions: canViewCommissions || false, // ✨ שמירה
        });

        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
        });
    } catch (error) {
        console.error("CRITICAL ERROR Creating User:", error);
        res.status(500).json({ message: 'שגיאה ביצירת המשתמש: ' + error.message });
    }
};

export const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (user) {
            if (user.role === 'admin') {
                return res.status(400).json({ message: 'לא ניתן למחוק משתמש מנהל' });
            }
            await User.findByIdAndDelete(req.params.id);
            res.json({ message: 'המשתמש נמחק בהצלחה' });
        } else {
            res.status(404).json({ message: 'משתמש לא נמצא' });
        }
    } catch (error) {
        res.status(500).json({ message: 'שגיאה במחיקה' });
    }
};