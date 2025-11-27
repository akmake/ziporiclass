// server/controllers/dashboardController.js
import Transaction from '../models/Transaction.js';
import Project from '../models/Project.js';
import Account from '../models/Account.js';
import { startOfMonth, subMonths, endOfMonth } from 'date-fns';

export const getDashboardData = async (req, res, next) => {
    try {
        const userId = req.user._id; // מגיע מה-requireAuth middleware
        const today = new Date();

        // 1. הגדרת טווחי תאריכים
        const thisMonthStart = startOfMonth(today);
        const prevMonthStart = startOfMonth(subMonths(today, 1));
        const prevMonthEnd = endOfMonth(subMonths(today, 1));

        // 2. ביצוע כל השאילתות במקביל לשיפור ביצועים
        const [
            accounts,
            monthlyAggregation,
            categoryAggregation,
            projects,
            balanceChartDataRaw
        ] = await Promise.all([
            Account.find({ userId }).lean(),
            Transaction.aggregate([
                { $match: { userId, date: { $gte: prevMonthStart } } },
                { $group: {
                    _id: { month: { $month: "$date" }, type: "$type" },
                    total: { $sum: "$amount" }
                }}
            ]),
            Transaction.aggregate([
                 { $match: { userId, type: 'הוצאה', date: { $gte: prevMonthStart } } },
                 { $group: {
                     _id: { category: "$category", month: { $month: "$date" } },
                     total: { $sum: "$amount" }
                 }}
            ]),
            Project.find({ owner: userId }).sort({ createdAt: -1 }).lean(),
            Transaction.aggregate([
                { $match: { userId } },
                { $sort: { date: 1 } },
                { $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
                    dailyChange: { $sum: { $cond: [{ $eq: ["$type", "הכנסה"] }, "$amount", { $multiply: ["$amount", -1] }] }}
                }},
                { $sort: { _id: 1 } }
            ])
        ]);

        // 3. עיבוד נתוני סיכום חודשי
        const thisMonthNum = today.getMonth() + 1;
        const prevMonthNum = prevMonthStart.getMonth() + 1;
        const monthlySummary = {
            thisMonth: { income: 0, expense: 0 },
            prevMonth: { income: 0, expense: 0 }
        };
        monthlyAggregation.forEach(item => {
            const target = item._id.month === thisMonthNum ? monthlySummary.thisMonth : monthlySummary.prevMonth;
            if (item._id.type === 'הכנסה') target.income = item.total;
            if (item._id.type === 'הוצאה') target.expense = item.total;
        });

        // 4. עיבוד נתוני קטגוריות
        const categorySummary = {};
        categoryAggregation.forEach(item => {
            const categoryName = item._id.category;
            if (!categorySummary[categoryName]) {
                categorySummary[categoryName] = { current: 0, previous: 0 };
            }
            if (item._id.month === thisMonthNum) {
                categorySummary[categoryName].current = item.total;
            } else {
                categorySummary[categoryName].previous = item.total;
            }
        });

        // 5. עיבוד נתוני גרף
        let cumulativeBalance = 0;
        const balanceChartData = balanceChartDataRaw.map(item => {
            cumulativeBalance += item.dailyChange;
            return { date: item._id, balance: cumulativeBalance };
        });

        // 6. הרכבת התגובה הסופית
        res.json({
            accounts,
            monthlySummary,
            categorySummary,
            projects,
            balanceChartData
        });

    } catch (error) {
        next(error); // העברת השגיאה ל-errorHandler
    }
};