// server/controllers/admin/dashboardController.js
import { catchAsync } from '../../middlewares/errorHandler.js';
import Order from '../../models/Order.js';
import User from '../../models/userModel.js';
import InboundEmail from '../../models/InboundEmail.js';

export const getDashboardStats = catchAsync(async (req, res, next) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    orderStats,
    totalUsers,
    totalLeads,
    leadsPerDay,
    salesByPerson,    // ✨ חדש
    rejectionReasons, // ✨ חדש
    leadConversion    // ✨ חדש
  ] = await Promise.all([
    // 1. סיכום הזמנות כללי
    Order.aggregate([
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$total_price" },
          totalOrders: { $sum: 1 }
        }
      }
    ]),

    // 2. סך משתמשים
    User.countDocuments(),

    // 3. סך לידים החודש
    InboundEmail.countDocuments({ receivedAt: { $gte: thirtyDaysAgo } }),

    // 4. גרף לידים יומי
    InboundEmail.aggregate([
      { $match: { receivedAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$receivedAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),

    // 5. ביצועי אנשי מכירות
    Order.aggregate([
        { 
            $match: { 
                status: { $in: ['בוצע', 'placed', 'converted'] },
                createdAt: { $gte: thirtyDaysAgo }
            } 
        },
        { $group: { _id: "$salespersonName", dealsCount: { $sum: 1 }, totalRevenue: { $sum: "$total_price" } } },
        { $sort: { totalRevenue: -1 } }
    ]),

    // 6. פילוח סיבות "לא רלוונטי" (הזמנות)
    Order.aggregate([
        { $match: { status: { $in: ['לא רלוונטי', 'not_relevant'] }, createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: "$rejectionReason", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
    ]),

    // 7. סטטוס לידים
    InboundEmail.aggregate([
        { $match: { receivedAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: "$status", count: { $sum: 1 } } }
    ])
  ]);

  // איחוד סיבות דחייה גם מהלידים
  const leadRejections = await InboundEmail.aggregate([
      { $match: { status: 'not_relevant', receivedAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: "$rejectionReason", count: { $sum: 1 } } }
  ]);

  const combinedRejections = [...rejectionReasons];
  leadRejections.forEach(lr => {
      const existing = combinedRejections.find(r => r._id === lr._id);
      if (existing) existing.count += lr.count;
      else combinedRejections.push(lr);
  });

  res.status(200).json({
    totalSales: orderStats[0]?.totalSales || 0,
    totalOrders: orderStats[0]?.totalOrders || 0,
    totalUsers,
    totalLeads,
    leadsPerDay,
    salesByPerson,
    rejectionReasons: combinedRejections,
    leadStats: leadConversion
  });
});