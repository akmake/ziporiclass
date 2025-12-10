import User from '../models/userModel.js';
import { catchAsync } from '../middlewares/errorHandler.js';

// שליפת משתמשים (תומך בסינון ?role=housekeeper)
export const getAllUsers = catchAsync(async (req, res) => {
    const filter = {};
    
    // אם נשלח פרמטר role, נסנן לפיו
    if (req.query.role) {
        filter.role = req.query.role;
    }

    // שולפים רק שדות נחוצים (בלי סיסמאות)
    const users = await User.find(filter)
        .select('_id name email role')
        .sort({ name: 1 });

    res.json(users);
});