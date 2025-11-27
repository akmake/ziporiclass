# פרויקט קייטרינג - Full Stack

פרויקט Full-Stack מודרני המדגים מערכת הזמנות לקייטרינג.
הפרויקט בנוי בארכיטקטורת Monorepo ומכיל:
- **Client**: אפליקציית React עם Vite, TailwindCSS, Zustand ו-React Query.
- **Server**: שרת Express עם Node.js, MongoDB, אימות JWT מאובטח והגנות מתקדמות.
- **Containerization**: הגדרות Docker ו-Docker Compose להרצה קלה בסביבות פיתוח וייצור.

## 🚀 הרצה מקומית (פיתוח)

1.  **התקנת תלויות בכל הפרויקטים:**
    ```bash
    npm run install-all
    ```

2.  **יצירת קובץ סביבה בשרת:**
    - העתק את `server/.env.example` לקובץ חדש בשם `server/.env`.
    - מלא את הערכים הסודיים בקובץ.

3.  **הרצת שרת ולקוח במקביל:**
    ```bash
    npm run dev
    ```
    - הלקוח ירוץ ב-`http://localhost:5173`.
    - השרת ירוץ ב-`http://localhost:4000`.

## 🐳 הרצה עם Docker

ודא ש-Docker ו-Docker Compose מותקנים במערכת.

```bash
npm run docker:up