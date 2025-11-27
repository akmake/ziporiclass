import os
import shutil
import zipfile
import tkinter as tk
from tkinter import filedialog, messagebox

# רשימת תיקיות שיש לדלג עליהן
SKIP_DIRS = {"node_modules", ".git", "__pycache__"}

def copy_filtered_directory(src, dst):
    """
    מעתיק תיקייה כולל מבנה, תוך דילוג על תיקיות מסוימות לפי שם.
    """
    for root, dirs, files in os.walk(src):
        # חישוב הנתיב היחסי כדי לשחזר את המבנה
        rel_path = os.path.relpath(root, src)
        dest_path = os.path.join(dst, rel_path)
        os.makedirs(dest_path, exist_ok=True)

        # סינון תיקיות לא רצויות
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]

        # העתקת קבצים
        for file in files:
            src_file = os.path.join(root, file)
            dst_file = os.path.join(dest_path, file)
            try:
                shutil.copy2(src_file, dst_file)
            except Exception as e:
                print(f"❌ שגיאה בהעתקה של {src_file}: {e}")

def zip_directory(source_dir, zip_path):
    """
    יוצר קובץ ZIP תוך שמירה על מבנה תיקיות מלא.
    """
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, _, files in os.walk(source_dir):
            for file in files:
                abs_path = os.path.join(root, file)
                rel_path = os.path.relpath(abs_path, source_dir)
                zf.write(abs_path, arcname=rel_path)

def main():
    # בחירת תיקיית מקור
    root = tk.Tk()
    root.withdraw()
    src_dir = filedialog.askdirectory(title="בחר תקייה להעתקה ולכיווץ")

    if not src_dir:
        print("❌ לא נבחרה תקייה.")
        return

    # בחירת יעד לקובץ ZIP (כולל שם קובץ)
    zip_path = filedialog.asksaveasfilename(
        title="בחר מיקום ושם לקובץ ה-ZIP",
        defaultextension=".zip",
        filetypes=[("Zip Files", "*.zip")]
    )

    if not zip_path:
        print("❌ לא נבחר מיקום לשמירת ה-ZIP.")
        return

    print(f"\n📂 מקור: {src_dir}")
    print(f"📦 יעד ZIP: {zip_path}")

    # יצירת תקייה זמנית להעתקה
    temp_copy_dir = os.path.join(os.path.dirname(zip_path), "_temp_filtered_copy")
    if os.path.exists(temp_copy_dir):
        shutil.rmtree(temp_copy_dir)
    os.makedirs(temp_copy_dir)

    # העתקת קבצים עם סינון תיקיות
    copy_filtered_directory(src_dir, temp_copy_dir)

    # יצירת קובץ ZIP
    zip_directory(temp_copy_dir, zip_path)

    # ניקוי זמני
    shutil.rmtree(temp_copy_dir)

    print(f"\n✅ קובץ ZIP נוצר בהצלחה בנתיב: {zip_path}")
    messagebox.showinfo("הצלחה", f"הקובץ נוצר בהצלחה:\n{zip_path}")

if __name__ == "__main__":
    main()
