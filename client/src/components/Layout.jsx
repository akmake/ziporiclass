// client/src/components/Layout.jsx
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar.jsx'; // Navbar שלך כבר מטפל במובייל/דסקטופ
import { Toaster } from "@/components/ui/Toaster.jsx";

export default function Layout() {
  return (
    <>
      {/* רכיב ה-Navbar שלך כבר בנוי עם ההיגיון 
        להצגת סרגל צד בדסקטופ (hidden md:flex) [cite: 245]
        וסרגל עליון במובייל (md:hidden)[cite: 247].
        אנחנו פשוט נותנים לו לעשות את העבודה.
      */}
      <Navbar />

      {/* זה החלק העיקרי של התוכן. 
        נוסיף לו 'padding' מימין (pr) במחשבים גדולים (md) 
        כדי שלא יסתתר מאחורי סרגל הצד הקבוע.
        במובייל, הוא יתפוס רוחב מלא.
      */}
      <div className="flex-1 md:pr-64">
        {/* אזור התוכן הדינמי */}
        <main className="flex-1">
          <Outlet />
        </main>
      </div>

      {/* Toaster להודעות קופצות */}
      <Toaster />
    </>
  );
}