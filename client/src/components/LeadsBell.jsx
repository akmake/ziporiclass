// client/src/components/LeadsBell.jsx

import React, { useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/utils/api.js';
// 1. ייבוא ה-hook הנכון עבור ההתראות (shadcn)
import { useToast } from "@/hooks/use-toast.js";
import { Bell } from 'lucide-react';

// --- הגדרת צליל ---
// 1. הנח קובץ צליל (למשל, 'notification.mp3') בתיקייה 'client/public'.
const notificationSound = new Audio('/notification.mp3');
// ---------------------------------

const fetchLeads = async () => {
  const { data } = await api.get('/leads');
  return data;
};

export function LeadsBell() {
  // 2. הפעל את ה-hook של shadcn כדי לקבל את פונקציית toast
  const { toast } = useToast();
  // 3. Ref שיזכור את מזהי הפניות שראינו
  const previousProcessedLeadIds = useRef(null);
  // מתחיל ב-null כדי לזהות טעינה ראשונה

  // 4. שאילתה אוטומטית כל 10 שניות
  const { data: leads } = useQuery({
    queryKey: ['leads'],
    queryFn: fetchLeads,
    refetchInterval: 10000, // רענון אוטומטי כל 10 שניות
    
    onSuccess: (data) => {
      // 5. מצא את כל הלידים הנוכחיים שבמצב "לא נענה"
      const currentNewLeads = data.filter(lead => lead.status === 'new');
      const currentNewIds = new Set(currentNewLeads.map(lead => lead._id));

      // 6. בדיקה אם זו הטעינה הראשונה של הרכיב
      if (previousProcessedLeadIds.current === null) {
        // בטעינה ראשונה, אנחנו רק שומרים את המצב הקיים ולא מקפיצים התראות
        previousProcessedLeadIds.current = currentNewIds;
        return;
      }

      // 7. נמצא את הפניות ה"חדשות" (אלו שקיימות ברשימה החדשה אך לא היו ברשימה הקודמת)
      const newLeads = currentNewLeads.filter(
        lead => !previousProcessedLeadIds.current.has(lead._id)
      );
      
      // 8. אם יש פניות חדשות - נקפיץ התראה ונגן צליל
      if (newLeads.length > 0) {
        try {
          // נגן את הצליל (פעם אחת, גם אם נכנסו כמה פניות ביחד)
          notificationSound.play().catch(e => console.warn("לא ניתן היה לנגן צליל התראה (ייתכן שנדרשת אינטראקציה ראשונית עם הדף):", e));
        } catch (e) {
          console.warn("שגיאה בניגון צליל:", e);
        }

        // נקפיץ התראה נפרדת לכל פנייה חדשה
        newLeads.forEach(lead => {
          const leadName = lead.parsedName || 'פנייה חדשה';

          // 9. שימוש בפונקציית ה-toast של shadcn
          toast({
            title: "🔥 פנייה חדשה התקבלה!",
            description: `הגיעה הודעה חדשה מ${leadName}.`,
          });
        });
      }

      // 10. עדכון הזיכרון למצב הנוכחי
      previousProcessedLeadIds.current = currentNewIds;
    }
  });

  // 11. חישוב ספירת הפניות הפתוחות (סטטוס 'new')
  const openLeadsCount = useMemo(() => {
    if (!leads) return 0;
    // ספור לידים שהם "לא נענה" (new)
    return leads.filter(lead => lead.status === 'new').length;
  }, [leads]);

  // 12. הרכיב הויזואלי
  return (
    <Link to="/leads" className="relative text-2xl text-gray-600 hover:text-amber-600" aria-label="פתח תיבת פניות">
      <Bell size={24} />
      {openLeadsCount > 0 && (
        <span className="absolute -top-2 -right-3 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
          {openLeadsCount}
        </span>
      )}
    </Link>
  );
}