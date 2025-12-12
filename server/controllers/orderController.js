import Order from '../models/Order.js';
import PriceList from '../models/PriceList.js';
import RoomType from '../models/RoomType.js';
import { calculateRoomTotalPrice } from '../lib/priceCalculator.js';
import { getNextSequenceValue } from '../models/Counter.js';
import nodemailer from 'nodemailer';
import { logAction } from '../utils/auditLogger.js';
// ייבואים שהיו בקובץ המקורי שלך (הנחה שמגיעים מנתיבים אלו)
import { catchAsync } from '../middlewares/errorHandler.js';
import AppError from '../utils/AppError.js';

// פונקציית עזר לחישוב מחיר סופי (נשמרה מהמקור)
const calculateFinalTotal = (roomsPrice, extras, discountPercent) => {
    let extrasTotal = 0;
    if (extras && Array.isArray(extras)) {
        extrasTotal = extras.reduce((sum, ex) => sum + (ex.price * ex.quantity), 0);
    }

    const subTotal = roomsPrice + extrasTotal;
    const discountAmount = subTotal * (discountPercent / 100);

    return Math.max(0, subTotal - discountAmount);
};

export const createOrder = async (req, res) => {
    const {
        hotel,
        rooms,
        notes,
        customerName,
        customerPhone,
        status,
        numberOfNights = 1,
        extras = [],
        discountPercent = 0,
        customerEmail,
        eventDate
    } = req.body;

    if (!hotel) return res.status(400).json({ message: 'חובה לבחור מלון.' });
    if (!customerName) return res.status(400).json({ message: 'שם הלקוח הוא שדה חובה.' });
    if ((!rooms || rooms.length === 0) && (!extras || extras.length === 0)) {
        return res.status(400).json({ message: 'ההזמנה חייבת להכיל לפחות חדר אחד או תוספת אחת.' });
    }

    try {
        const priceListsFromDB = await PriceList.find({ hotel });
        const priceListsMap = Object.fromEntries(
            priceListsFromDB.map(pl => [pl.name, pl.toObject()])
        );

        const hotelRoomTypes = await RoomType.find({ hotel });
        const roomTypesMap = Object.fromEntries(
            hotelRoomTypes.map(rt => [rt._id.toString(), rt])
        );

        let roomsTotalPrice = 0;

        const roomsWithServerPrice = (rooms || []).map(room => {
            let supplement = 0;
            let roomTypeName = 'רגיל';

            if (room.roomTypeId && roomTypesMap[room.roomTypeId]) {
                const rt = roomTypesMap[room.roomTypeId];
                supplement = rt.supplementPerNight || 0;
                roomTypeName = rt.name;
            }

            const price = calculateRoomTotalPrice(
                room,
                priceListsMap,
                room.price_list_names,
                numberOfNights,
                supplement
            );

            roomsTotalPrice += price;

            return {
                ...room,
                price,
                roomType: roomTypeName,
                roomSupplement: supplement,
                notes: room.notes
            };
        });

        const finalPrice = calculateFinalTotal(roomsTotalPrice, extras, discountPercent);
        const orderNumber = await getNextSequenceValue('orderNumber');

        const newOrderInMongo = await Order.create({
            orderNumber,
            hotel,
            user: req.user.id,
            salespersonName: req.user.name,
            
            // ✨ תוספת חדשה: שמירת היוצר לחישוב עמלות
            createdBy: req.user.id,
            createdByName: req.user.name,

            customerName,
            customerPhone,
            customerEmail,
            eventDate: eventDate ? new Date(eventDate) : new Date(),
            status: status || 'בהמתנה',
            numberOfNights,
            rooms: roomsWithServerPrice,
            extras,
            discountPercent,
            total_price: finalPrice,
            notes,
        });

        await logAction(req, 'CREATE', 'Order', newOrderInMongo._id, `נוצרה הזמנה חדשה #${orderNumber} עבור ${customerName}`);

        res.status(201).json(newOrderInMongo);
    } catch (error) {
        console.error("Order creation error:", error);
        res.status(500).json({ message: "שגיאה בשמירת ההזמנה." });
    }
};

export const updateOrder = async (req, res) => {
    try {
        const {
            hotel, rooms, notes, customerName, customerPhone, status, total_price, numberOfNights,
            extras, discountPercent, customerEmail, eventDate,
            optimaNumber // ✨ פרמטר חדש לסגירה
        } = req.body;

        const order = await Order.findById(req.params.id);

        if (!order) return res.status(404).json({ message: 'ההזמנה לא נמצאה' });
        
        // בדיקת הרשאה: בעלים, אדמין, או אם מנסים לשנות ל'בוצע' (סגירה ע"י אחר)
        if (order.user.toString() !== req.user.id && req.user.role !== 'admin' && status !== 'בוצע') {
            return res.status(403).json({ message: 'אין הרשאה לערוך הזמנה זו' });
        }

        // ✨ לוגיקת סגירה: אם משנים ל'בוצע', חובה מספר אופטימה
        if (status === 'בוצע' && order.status !== 'בוצע') {
            if (!optimaNumber) {
                return res.status(400).json({ message: 'חובה להזין מספר הזמנה מאופטימה כדי לסגור עסקה.' });
            }
            order.closedBy = req.user.id;
            order.closedByName = req.user.name;
            order.optimaNumber = optimaNumber;
        }

        // --- בדיקת שינויים ללוג ---
        let changes = {};
        if (status && status !== order.status) changes.status = { from: order.status, to: status };
        if (customerName && customerName !== order.customerName) changes.name = { from: order.customerName, to: customerName };
        // ------------------------

        let roomsTotalPrice = 0;
        let roomsWithServerPrice = order.rooms;

        if (rooms || numberOfNights || hotel) {
            const hotelIdForCalc = hotel || order.hotel;
            const nightsForCalc = numberOfNights || order.numberOfNights || 1;

            const priceListsFromDB = await PriceList.find({ hotel: hotelIdForCalc });
            const priceListsMap = Object.fromEntries(priceListsFromDB.map(pl => [pl.name, pl.toObject()]));

            const hotelRoomTypes = await RoomType.find({ hotel: hotelIdForCalc });
            const roomTypesMap = Object.fromEntries(hotelRoomTypes.map(rt => [rt._id.toString(), rt]));

            const roomsToProcess = rooms || order.rooms;

            roomsWithServerPrice = roomsToProcess.map(room => {
                let supplement = 0;
                let roomTypeName = room.roomType || 'רגיל';

                if (room.roomTypeId && roomTypesMap[room.roomTypeId]) {
                    const rt = roomTypesMap[room.roomTypeId];
                    supplement = rt.supplementPerNight || 0;
                    roomTypeName = rt.name;
                } else if (room.roomSupplement !== undefined) {
                    supplement = room.roomSupplement;
                }

                const price = calculateRoomTotalPrice(room, priceListsMap, room.price_list_names, nightsForCalc, supplement);
                roomsTotalPrice += price;

                return {
                    ...room,
                    price,
                    roomType: roomTypeName,
                    roomSupplement: supplement,
                    notes: room.notes
                };
            });
        } else {
            roomsTotalPrice = order.rooms.reduce((sum, r) => sum + r.price, 0);
        }

        const currentExtras = extras !== undefined ? extras : order.extras;
        const currentDiscount = discountPercent !== undefined ? discountPercent : order.discountPercent;

        let finalPrice = calculateFinalTotal(roomsTotalPrice, currentExtras, currentDiscount);
        if (total_price !== undefined) finalPrice = total_price;

        if (finalPrice !== order.total_price) changes.price = { from: order.total_price, to: finalPrice };

        // עדכון שדות
        order.hotel = hotel ?? order.hotel;
        order.customerName = customerName ?? order.customerName;
        order.customerPhone = customerPhone ?? order.customerPhone;
        order.customerEmail = customerEmail ?? order.customerEmail;
        if (eventDate) order.eventDate = new Date(eventDate);

        order.status = status ?? order.status;
        order.notes = notes ?? order.notes;
        order.numberOfNights = numberOfNights ?? order.numberOfNights;
        order.rooms = roomsWithServerPrice;
        order.extras = currentExtras;
        order.discountPercent = currentDiscount;
        order.total_price = finalPrice;
        
        // עדכון אופציונלי של המספר גם ללא שינוי סטטוס
        if (optimaNumber) order.optimaNumber = optimaNumber;

        const updatedOrder = await order.save();

        let logDesc = `עודכנה הזמנה #${updatedOrder.orderNumber}`;
        if (changes.status) logDesc += `, סטטוס: ${changes.status.to}`;
        if (changes.price) logDesc += `, סכום: ${changes.price.to}`;

        await logAction(req, 'UPDATE', 'Order', updatedOrder._id, logDesc, changes);

        res.json(updatedOrder);
    } catch (error) {
        console.error("Order update error:", error);
        res.status(500).json({ message: "שגיאה בעדכון ההזמנה" });
    }
};

export const getMyOrders = async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user.id }).sort({ orderNumber: -1 }).populate('hotel', 'name');
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: "שגיאה בטעינת היסטוריית ההזמנות." });
    }
};

export const getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find({}).sort({ orderNumber: -1 }).populate('user', 'name').populate('hotel', 'name');
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: "שגיאה בטעינת כל ההזמנות." });
    }
};

// ✨ פונקציה חדשה: חיפוש גלובלי (עבור המסך החצי גלוי)
export const searchAllOrders = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) return res.json([]);

        // חיפוש לפי שם, טלפון או מספר הזמנה. מחזירים רק הזמנות שעדיין לא בוטלו
        const orders = await Order.find({
            $and: [
                { status: { $ne: 'cancelled' } },
                {
                    $or: [
                        { customerName: { $regex: query, $options: 'i' } },
                        { customerPhone: { $regex: query, $options: 'i' } },
                        { orderNumber: !isNaN(query) ? Number(query) : null }
                    ].filter(Boolean)
                }
            ]
        })
        .select('orderNumber customerName customerPhone status hotel total_price createdByName createdAt optimaNumber user') 
        .populate('hotel', 'name')
        .sort({ createdAt: -1 })
        .limit(10); // מגבלת תוצאות

        res.json(orders);
    } catch (error) {
        console.error("Search error:", error);
        res.status(500).json({ message: "שגיאה בחיפוש הזמנות." });
    }
};

export const getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).populate('user', 'name').populate('hotel', 'name');
        if (!order) return res.status(404).json({ message: 'ההזמנה לא נמצאה' });
        // הסרת בדיקת ההרשאה המחמירה כדי לאפשר למוכרת אחרת לצפות בהזמנה שמצאה בחיפוש
        res.json(order);
    } catch (error) {
        res.status(500).json({ message: "שגיאה בטעינת ההזמנה" });
    }
};

export const getPublicQuoteById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('hotel', 'name brandColor logoUrl address phone');

        if (!order) return res.status(404).json({ message: 'ההזמנה לא נמצאה' });

        res.json({
            orderNumber: order.orderNumber,
            hotel: order.hotel,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            customerEmail: order.customerEmail,
            eventDate: order.eventDate,
            createdAt: order.createdAt,
            rooms: order.rooms,
            total_price: order.total_price,
            numberOfNights: order.numberOfNights,
            extras: order.extras,
            discountPercent: order.discountPercent,
            notes: order.notes
        });
    } catch (error) {
        res.status(500).json({ message: "שגיאה בטעינת ההזמנה" });
    }
};

export const deleteOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'ההזמנה לא נמצאה' });
        if (order.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'אין הרשאה למחוק הזמנה זו' });
        }
        await Order.findByIdAndDelete(req.params.id);

        await logAction(req, 'DELETE', 'Order', req.params.id, `נמחקה הזמנה #${order.orderNumber}`);

        res.json({ message: 'ההזמנה נמחקה' });
    } catch (error) {
        res.status(500).json({ message: 'שגיאה במחיקת ההזמנה' });
    }
};

export const sendOrderEmail = async (req, res) => {
    try {
        const { email, customerName } = req.body;
        const pdfBuffer = req.file?.buffer;

        if (!email || !pdfBuffer) {
            return res.status(400).json({ message: 'חסר כתובת אימייל או קובץ PDF' });
        }

        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        const mailOptions = {
            from: `"הצעות מחיר" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `הצעת מחיר עבור ${customerName}`,
            html: `
                <div dir="rtl" style="font-family: Arial, sans-serif;">
                    <h2>שלום ${customerName},</h2>
                    <p>תודה שפנית אלינו.</p>
                    <p>מצורפת הצעת המחיר כקובץ PDF לבקשתך.</p>
                    <br>
                    <p>בברכה,</p>
                    <p>צוות ההזמנות</p>
                </div>
            `,
            attachments: [
                {
                    filename: 'quote.pdf',
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        };

        await transporter.sendMail(mailOptions);

        await logAction(req, 'EXPORT', 'Order', req.params.id, `נשלחה הצעת מחיר במייל ל-${email}`);

        res.status(200).json({ message: 'Email sent successfully' });

    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ message: 'שגיאה בשליחת המייל', error: error.message });
    }
};

export const getMyOrderStats = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const openOrders = await Order.aggregate([
        {
            $match: {
                user: userId,
                status: { $in: ['בהמתנה', 'sent', 'in_progress', 'בטיפול'] }
            }
        },
        {
            $group: {
                _id: null,
                count: { $sum: 1 },
                totalValue: { $sum: "$total_price" }
            }
        }
    ]);

    const monthlySales = await Order.aggregate([
        {
            $match: {
                user: userId,
                status: 'בוצע',
                createdAt: { $gte: thirtyDaysAgo }
            }
        },
        {
            $group: {
                _id: null,
                count: { $sum: 1 },
                totalValue: { $sum: "$total_price" }
            }
        }
    ]);

    res.status(200).json({
        pending: {
            count: openOrders[0]?.count || 0,
            value: openOrders[0]?.totalValue || 0,
        },
        monthly: {
            count: monthlySales[0]?.count || 0,
            value: monthlySales[0]?.totalValue || 0,
        },
    });
});