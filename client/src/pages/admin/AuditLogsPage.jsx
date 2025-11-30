import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api.js';
import { format } from 'date-fns';
import { LoaderCircle, Search, ShieldAlert } from 'lucide-react';

// UI Components
import { Input } from '@/components/ui/Input.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
// Badge קיים במבנה הפרויקט שלך לפי הסריקה
import { Badge } from '@/components/ui/Badge.jsx';

const fetchLogs = async ({ queryKey }) => {
  const [_, { entity, user, page }] = queryKey;
  const params = new URLSearchParams();
  if (entity && entity !== 'all') params.append('entity', entity);
  if (user) params.append('user', user);
  params.append('page', page);
  
  const { data } = await api.get(`/admin/audit?${params.toString()}`);
  return data;
};

export default function AuditLogsPage() {
  const [filterUser, setFilterUser] = useState('');
  const [filterEntity, setFilterEntity] = useState('all');
  const [page, setPage] = useState(1);

  // Debounce למניעת קריאות מרובות בחיפוש שם
  const [debouncedUser, setDebouncedUser] = useState('');
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedUser(filterUser), 500);
    return () => clearTimeout(timer);
  }, [filterUser]);

  const { data, isLoading } = useQuery({
    queryKey: ['auditLogs', { entity: filterEntity, user: debouncedUser, page }],
    queryFn: fetchLogs,
    keepPreviousData: true
  });

  const getActionColor = (action) => {
    switch (action) {
      case 'CREATE': return 'bg-green-100 text-green-800 border-green-200'; // ירוק ליצירה
      case 'UPDATE': return 'bg-blue-100 text-blue-800 border-blue-200';   // כחול לעדכון
      case 'DELETE': return 'bg-red-100 text-red-800 border-red-200';     // אדום למחיקה
      case 'LOGIN': return 'bg-purple-100 text-purple-800 border-purple-200'; // סגול לכניסה
      case 'LOGOUT': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <ShieldAlert className="text-amber-600" /> יומן פעילות (Audit Log)
        </h1>
        <p className="text-gray-600 mt-1">תיעוד מלא של כל הפעולות במערכת למטרות אבטחה ובקרה.</p>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            {/* חיפוש לפי משתמש */}
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="חפש לפי שם משתמש..." 
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* סינון לפי סוג ישות */}
            <div className="w-full md:w-48">
              <Select value={filterEntity} onValueChange={setFilterEntity}>
                <SelectTrigger>
                  <SelectValue placeholder="סנן לפי סוג" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל הסוגים</SelectItem>
                  <SelectItem value="Order">הזמנות</SelectItem>
                  <SelectItem value="User">משתמשים</SelectItem>
                  <SelectItem value="PriceList">מחירונים</SelectItem>
                  <SelectItem value="System">מערכת</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {isLoading ? (
            <div className="text-center py-10">
                <LoaderCircle className="animate-spin h-8 w-8 mx-auto text-amber-600"/>
                <p className="text-sm text-gray-500 mt-2">טוען נתונים...</p>
            </div>
          ) : (
            <>
                <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600 font-medium">
                    <tr>
                        <th className="px-4 py-3 text-right">תאריך ושעה</th>
                        <th className="px-4 py-3 text-right">משתמש</th>
                        <th className="px-4 py-3 text-right">פעולה</th>
                        <th className="px-4 py-3 text-right">סוג</th>
                        <th className="px-4 py-3 text-right w-1/3">תיאור</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                    {data?.logs.length === 0 ? (
                        <tr><td colSpan="5" className="text-center py-8 text-gray-500">לא נמצאו רשומות</td></tr>
                    ) : (
                        data?.logs.map(log => (
                        <tr key={log._id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap text-gray-500" dir="ltr">
                            {format(new Date(log.createdAt), 'dd/MM/yy HH:mm:ss')}
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-800">{log.userName}</td>
                            <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-bold border ${getActionColor(log.action)}`}>
                                {log.action}
                            </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600">{log.entity}</td>
                            <td className="px-4 py-3 text-gray-700">{log.description}</td>
                        </tr>
                        ))
                    )}
                    </tbody>
                </table>
                </div>

                {/* Pagination Controls */}
                {data?.totalPages > 1 && (
                    <div className="flex justify-center items-center gap-4 mt-6">
                    <button 
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-4 py-2 border rounded-md text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        הקודם
                    </button>
                    <span className="text-sm text-gray-600">עמוד {page} מתוך {data.totalPages}</span>
                    <button 
                        onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                        disabled={page === data.totalPages}
                        className="px-4 py-2 border rounded-md text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        הבא
                    </button>
                    </div>
                )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}