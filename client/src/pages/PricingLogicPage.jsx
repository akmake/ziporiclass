import React from 'react';
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { Calculator, Users, Phone, ArrowRight, Plus, Baby, User as UserIcon } from "lucide-react";

// רכיב עזר פנימי להצגת דוגמה
const ExampleCard = ({ title, setup, logic, result }) => (
  <Card className="shadow-sm">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-lg">
        {title}
      </CardTitle>
      <CardDescription>{setup}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-2 text-sm">
      <p className="font-medium text-gray-700">מהלך החישוב:</p>
      {logic}
    </CardContent>
    <CardFooter className="bg-gray-50 dark:bg-slate-800 p-4 rounded-b-xl">
      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
        תוצאה: {result}
      </p>
    </CardFooter>
  </Card>
);

// הדף הראשי
export default function PricingLogicPage() {
  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8 max-w-5xl">
      <header className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 flex items-center gap-3">
          <Calculator className="h-8 w-8 text-primary" />
          לוגיקת חישוב מחירי חדרים
        </h1>
        <p className="mt-2 text-lg text-gray-600">
          מדריך זה מסביר לסוכני המכירות כיצד המערכת מחשבת מחיר לחדר.
        </p>
      </header>

      {/* שלב 1: סוגי האורחים */}
      <Card>
        <CardHeader>
          <CardTitle>שלב 1: מי נחשב בתוך החדר?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>בכל חדר אנחנו סופרים ארבעה סוגי אורחים:</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-4 bg-gray-50 rounded-lg">
              <Users className="mx-auto h-6 w-6 text-gray-700" />
              <p className="font-semibold mt-1">מבוגרים</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <UserIcon className="mx-auto h-6 w-6 text-gray-700" />
              <p className="font-semibold mt-1">נערים</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <UserIcon className="mx-auto h-6 w-6 text-gray-500" />
              <p className="font-semibold mt-1">ילדים</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <Baby className="mx-auto h-6 w-6 text-gray-700" />
              <p className="font-semibold mt-1">תינוקות</p>
            </div>
          </div>
          <p className="text-lg font-semibold text-red-600 bg-red-50 p-3 rounded-md">
            ❗ תינוקות תמיד מחושבים בנפרד, בתור תוספת קבועה, ולא "תופסים מקום" בזוג או בחדר יחיד.
          </p>
        </CardContent>
      </Card>

      {/* שלב 2: כללי החישוב (הגרסה המתוקנת) */}
      <Card>
        <CardHeader>
          <CardTitle>שלב 2: איך נקבע המחיר לפי מספר האורחים?</CardTitle>
          <CardDescription>
            החישוב מתבצע לפי הקבוצה העיקרית (מבוגרים, נערים, ילדים), ואז מוסיפים תינוקות.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <h4 className="text-lg font-semibold">א. חדר עם אורח אחד (מבוגר / נער / ילד)</h4>
          <p>ברגע שיש אדם אחד בלבד בחדר (לא משנה אם הוא מבוגר, נער או ילד):</p>
          <p className="font-bold text-gray-800 p-3 bg-gray-100 rounded-md">
            המחיר = "חדר יחיד" לפי המחירון.
          </p>

          {/* --- החלק ששונה והודגש --- */}
          <h4 className="text-lg font-semibold mt-4">ב. חדר עם שני אורחים או יותר (לא כולל תינוקות)</h4>
          <p>ברגע שיש לפחות שניים מתוך: מבוגרים / נערים / ילדים – נכנס כלל מורכב:</p>
          <ul className="list-disc list-inside space-y-2 rtl pr-4">
            <li>
              קודם כל, המערכת **ממיינת** את האורחים מה"יקר" ל"זול" (הסדר הוא: מבוגר ⇐ נער ⇐ ילד).
            </li>
            <li>
              המחיר תמיד מתחיל מ-**"זוג בחדר"**. מחיר זה "מכסה" את שני האורחים היקרים ביותר בחדר.
            </li>
            <li>
              כל אורח נוסף (החל מהשלישי ברשימה הממוינת) משלם תוספת לפי סוגו:
              <ul className="list-circle list-inside space-y-1 rtl pr-6 mt-1">
                <li>כל <strong>מבוגר או נער</strong> נוסף ⇐ מחיר "נער/מבוגר נוסף".</li>
                <li>כל <strong>ילד</strong> נוסף ⇐ מחיר "ילד נוסף".</li>
              </ul>
            </li>
          </ul>
          {/* --- סוף החלק ששונה --- */}

          <h4 className="text-lg font-semibold mt-4">ג. תינוקות – איך הם מחושבים?</h4>
          <p>תינוקות לא נכנסים לספירה של יחיד/זוג/תוספות. בכל חדר:</p>
          <p className="font-bold text-gray-800 p-3 bg-gray-100 rounded-md">
            לכל תינוק מוסיפים תוספת מחיר קבועה לפי השורה "תינוק" במחירון.
          </p>
        </CardContent>
      </Card>

      {/* דוגמאות (עם הדוגמה החדשה) */}
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-gray-900 text-center">דוגמאות</h2>

        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle>מחירון לדוגמה</CardTitle>
            <CardDescription>המספרים כאן הם דוגמה בלבד כדי להסביר את העיקרון.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table className="bg-white rounded-lg">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">סוג</TableHead>
                  <TableHead className="text-right">מחיר</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow><TableCell className="font-medium">חדר יחיד</TableCell><TableCell>1,750 ₪</TableCell></TableRow>
                <TableRow><TableCell className="font-medium">זוג בחדר</TableCell><TableCell>2,190 ₪</TableCell></TableRow>
                <TableRow><TableCell className="font-medium">נער/מבוגר נוסף</TableCell><TableCell>870 ₪</TableCell></TableRow>
                <TableRow><TableCell className="font-medium">ילד נוסף</TableCell><TableCell>650 ₪</TableCell></TableRow>
                <TableRow><TableCell className="font-medium">תינוק</TableCell><TableCell>100 ₪</TableCell></TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">

          <ExampleCard
            title="דוגמה 1: ילד לבד בחדר"
            setup="0 מבוגרים, 0 נערים, 1 ילד, 0 תינוקות"
            logic={<p>← יש אדם אחד בחדר ← מחיר <strong>"חדר יחיד"</strong>.</p>}
            result="1,750 ₪"
          />

          <ExampleCard
            title="דוגמה 2: מבוגר וילד בחדר"
            setup="1 מבוגר, 0 נערים, 1 ילד, 0 תינוקות"
            logic={<p>← יש שני אנשים בחדר ← מחיר <strong>"זוג בחדר"</strong>.</p>}
            result="2,190 ₪"
          />

          <ExampleCard
            title="דוגמה 3: שני מבוגרים וילד"
            setup="2 מבוגרים, 0 נערים, 1 ילד, 0 תינוקות"
            logic={
              <ul className="list-disc list-inside rtl pr-4">
                <li>מיון האורחים: `[מבוגר, מבוגר, ילד]`</li>
                <li>בסיס (2 היקרים): `מבוגר, מבוגר` ← <strong>"זוג בחדר"</strong> = 2,190 ₪</li>
                <li>תוספת: `ילד` ← <strong>"ילד נוסף"</strong> = 650 ₪</li>
              </ul>
            }
            result="2,840 ₪ (2,190 + 650)"
          />

          {/* --- ✨ דוגמה חדשה שמסבירה את המיון ✨ --- */}
          <ExampleCard
            title="דוגמה 4: נער ו-2 ילדים (כלל המיטוב)"
            setup="0 מבוגרים, 1 נער, 2 ילדים, 0 תינוקות"
            logic={
              <ul className="list-disc list-inside rtl pr-4">
                <li>מיון האורחים מהיקר לזול: `[נער, ילד, ילד]`</li>
                <li>בסיס (2 היקרים): `נער, ילד` ← <strong>"זוג בחדר"</strong> = 2,190 ₪</li>
                <li>תוספת: `ילד` (השני) ← <strong>"ילד נוסף"</strong> = 650 ₪</li>
                <li className="text-xs text-gray-500 pt-1">(זה זול יותר מאשר 2,190 + 870)</li>
              </ul>
            }
            result="2,840 ₪ (2,190 + 650)"
          />

          <ExampleCard
            title="דוגמה 5: שני מבוגרים, נער, ילד ותינוק"
            setup="2 מבוגרים, 1 נער, 1 ילד, 1 תינוק"
            logic={
              <ul className="list-disc list-inside rtl pr-4">
                <li>מיון האורחים: `[מבוגר, מבוגר, נער, ילד]`</li>
                <li>בסיס (2 היקרים): `מבוגר, מבוגר` ← <strong>"זוג בחדר"</strong> = 2,190 ₪</li>
                <li>תוספות (מעבר לזוג):
                  <ul className="list-circle list-inside space-y-1 rtl pr-6 mt-1">
                    <li>`נער` ← <strong>"נער/מבוגר נוסף"</strong> = 870 ₪</li>
                    <li>`ילד` ← <strong>"ילד נוסף"</strong> = 650 ₪</li>
                  </ul>
                </li>
                <li>תינוקות (תמיד בנפרד):
                  <ul className="list-circle list-inside space-y-1 rtl pr-6 mt-1">
                    <li>`תינוק` ← <strong>"תינוק"</strong> = 100 ₪</li>
                  </ul>
                </li>
              </ul>
            }
            result="3,810 ₪ (2,190 + 870 + 650 + 100)"
          />

          <ExampleCard
            title="דוגמה 6: מקרה קצה (רק תינוקות)"
            setup="0 מבוגרים, 0 נערים, 0 ילדים, 2 תינוקות"
            logic={
              <ul className="list-disc list-inside rtl pr-4">
                <li>הקבוצה העיקרית ריקה (0 אורחים).</li>
                <li>← לא מחושב "חדר יחיד" או "זוג".</li>
                <li>← מחושב רק לפי <strong>"תינוק"</strong>: 2 * 100 ₪</li>
              </ul>
            }
            result="200 ₪"
          />
        </div>
      </div>

      {/* חיבור מחירונים */}
      <Card>
        <CardHeader>
          <CardTitle>שלב 3: חישוב כמה מחירונים ביחד</CardTitle>
          <CardDescription>
            המערכת מאפשרת לבחור כמה מחירונים לאותו חדר (למשל: לינה + אוכל).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>איך זה עובד?</p>
          <ol className="list-decimal list-inside space-y-2 rtl pr-4">
            <li>המערכת מחשבת את מחיר החדר **בנפרד** לכל מחירון, לפי אותם כללים שראינו למעלה.</li>
            <li>אחר כך היא **מחברת** את כל התוצאות למחיר אחד סופי.</li>
          </ol>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 text-center p-4 bg-gray-50 rounded-lg">
            <div className="p-3 bg-white rounded shadow-sm">
              <p className="text-sm text-gray-500">חישוב מחירון "לינה"</p>
              <p className="text-xl font-bold">1,000 ₪</p>
            </div>
            <Plus className="h-5 w-5 text-gray-500" />
            <div className="p-3 bg-white rounded shadow-sm">
              <p className="text-sm text-gray-500">חישוב מחירון "ארוחות"</p>
              <p className="text-xl font-bold">400 ₪</p>
            </div>
            <Plus className="h-5 w-5 text-gray-500" />
            <div className="p-3 bg-white rounded shadow-sm">
              <p className="text-sm text-gray-500">חישוב "אטרקציות"</p>
              <p className="text-xl font-bold">200 ₪</p>
            </div>
            <ArrowRight className="h-5 w-5 text-gray-500 hidden md:block" />
            <div className="p-4 bg-blue-100 rounded shadow-sm md:ml-4">
              <p className="text-sm text-blue-700">מחיר סופי לחדר</p>
              <p className="text-2xl font-bold text-blue-700">1,600 ₪</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* סיכום ללקוח */}
      <Card className="border-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-6 w-6 text-primary" />
            איך להסביר ללקוח בטלפון בקצרה?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-lg">
          <p>אפשר לתת להם "נוסחה" פשוטה להסבר:</p>
          <ul className="list-disc list-inside space-y-2 rtl pr-4 text-gray-700">
            <li>קודם כל רואים כמה אנשים בחדר (לא כולל תינוקות).</li>
            <li>אם יש <strong>אחד</strong> ⇐ הוא משלם מחיר <strong>"חדר יחיד"</strong>.</li>
            <li>אם יש <strong>שניים ומעלה</strong> ⇐ המחיר מתחיל מ<strong>"זוג בחדר"</strong> (עבור שני היקרים ביותר), וכל אחד מעבר לזוג מוסיף תוספת לפי הגיל.</li>
            <li><strong>תינוקות</strong> – הם תמיד תוספת קטנה ונפרדת, ולא תופסים מקום של מבוגר/ילד.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}