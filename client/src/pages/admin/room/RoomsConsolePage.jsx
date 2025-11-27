import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/Card.jsx';
import { 
    CalendarDays, ListChecks, Hotel, Wrench, ArrowRight, Activity 
} from 'lucide-react';

export default function RoomsConsolePage() {
    const menuItems = [
        {
            title: "תמונת מצב (Live)",
            desc: "צפייה בסטטוסים בזמן אמת: נקי, מלוכלך, תקלות.",
            icon: <Activity size={32} className="text-green-600"/>,
            to: "/admin/rooms-status",
            color: "border-green-200 hover:border-green-400"
        },
        {
            title: "סידור עבודה יומי",
            desc: "הכנת חדרים למחר (Stayover / Checkout) והוראות.",
            icon: <CalendarDays size={32} className="text-blue-600"/>,
            to: "/admin/daily-plan",
            color: "border-blue-200 hover:border-blue-400"
        },
        {
            title: "ניהול צ'ק ליסטים",
            desc: "הגדרת רשימת המשימות הקבועה לכל מלון.",
            icon: <ListChecks size={32} className="text-purple-600"/>,
            to: "/admin/rooms-checklists", // הנתיב החדש שיצרנו
            color: "border-purple-200 hover:border-purple-400"
        },
        {
            title: "מרכז בקרה תפעולי",
            desc: "דשבורד מנהלים הכולל סטטיסטיקות וגרפים.",
            icon: <Wrench size={32} className="text-amber-600"/>,
            to: "/admin/maintenance",
            color: "border-amber-200 hover:border-amber-400"
        },
        {
            title: "הקמת חדרים",
            desc: "הוספת חדרים חדשים למערכת (Bulk).",
            icon: <Hotel size={32} className="text-slate-600"/>,
            to: "/admin/rooms/create",
            color: "border-slate-200 hover:border-slate-400"
        }
    ];

    return (
        <div className="container mx-auto p-6 space-y-8">
            <header>
                <h1 className="text-3xl font-bold text-gray-900">ניהול מערך החדרים</h1>
                <p className="text-gray-600 mt-2">כל הכלים לניהול התפעול, הניקיון והתחזוקה במקום אחד.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {menuItems.map((item, idx) => (
                    <Link key={idx} to={item.to} className="block group h-full">
                        <Card className={`h-full transition-all duration-200 hover:shadow-md border-t-4 ${item.color}`}>
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div className="p-3 bg-slate-50 rounded-xl group-hover:scale-110 transition-transform">
                                        {item.icon}
                                    </div>
                                    <ArrowRight className="text-gray-300 group-hover:text-gray-600"/>
                                </div>
                                <CardTitle className="mt-4 text-xl">{item.title}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CardDescription className="text-base">{item.desc}</CardDescription>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
}