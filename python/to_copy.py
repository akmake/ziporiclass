import os
import shutil
import tkinter as tk
from tkinter import filedialog, messagebox

# --- הגדרות גלובליות ---

# עומק מקסימלי (לסריקת הטקסט בלבד)
MAX_DEPTH = 7

# תיקיות שיש לדלג עליהן (גם בהעתקה וגם בסריקה)
SKIP_DIRS = {"node_modules", ".git", "__pycache__", "package-lock.json", ".venv"}

# קבצים שיש לדלג עליהם (גם בהעתקה וגם בסריקה)
SKIP_FILES = {
    "index-DEKCV7q4.js",
}

# סיומות שמותר להציג (רק בסריקת הטקסט)
PRINT_CONTENT_EXTENSIONS = {".js", ".ts", ".html", ".css", ".jsx", ".md"}


# --- פונקציה 1: העתקה מסוננת ---

def copy_filtered_directory(src_path, dest_path, indent=0, stats=None):
    """
    מעתיק תיקייה שלמה, תוך דילוג על תיקיות וקבצים ברשימות ה-SKIP.
    """
    if stats is None:
        stats = {'copied': 0, 'skipped': 0, 'errors': 0}

    try:
        if not os.path.exists(dest_path):
            os.makedirs(dest_path, exist_ok=True)
            
        items = sorted(os.listdir(src_path))
    except Exception as e:
        print("  " * indent + f"[שגיאה בגישה ל-{src_path}]: {e}")
        stats['errors'] += 1
        return stats

    for item in items:
        full_src_path = os.path.join(src_path, item)
        full_dest_path = os.path.join(dest_path, item)

        # בדיקה אם זו תיקייה
        if os.path.isdir(full_src_path):
            # שלב 1: דילוג על תיקיות אסורות
            if item in SKIP_DIRS:
                print("  " * indent + f"🚫 {item}/ (מדלג בהעתקה)")
                stats['skipped'] += 1
                continue
            
            # תיקייה מותרת - המשך רקורסיבי
            copy_filtered_directory(full_src_path, full_dest_path, indent + 1, stats)

        # זה קובץ
        else:
            # שלב 2: דילוג על קבצים אסורים
            if item in SKIP_FILES:
                print("  " * indent + f"🚫 {item} (מדלג בהעתקה)")
                stats['skipped'] += 1
                continue

            # קובץ מותר - העתק אותו
            try:
                # יצירת תיקיית אב אם צריך
                os.makedirs(os.path.dirname(full_dest_path), exist_ok=True)
                shutil.copy2(full_src_path, full_dest_path)
                stats['copied'] += 1
            except Exception as e:
                print("  " * indent + f"❌ שגיאה בהעתקת {item}: {e}")
                stats['errors'] += 1
                
    return stats

# --- פונקציה 2: סריקת מבנה (מהסקריפט המקורי שלך) ---

def scan_directory(path, indent=0, output_lines=None, current_depth=0, print_content=False):
    """
    סורק את מבנה התיקייה ויוצר רשימת טקסט.
    """
    if output_lines is None:
        output_lines = []

    if current_depth > MAX_DEPTH:
        output_lines.append("  " * indent + "🔽 ... (העומק הגיע למקסימום)")
        return output_lines

    try:
        items = sorted(os.listdir(path))
    except Exception as e:
        output_lines.append("  " * indent + f"[שגיאה בגישה]: {e}")
        return output_lines

    for item in items:
        full_path = os.path.join(path, item)

        # שלב 1: דילוג על תיקיות אסורות
        if os.path.isdir(full_path) and item in SKIP_DIRS:
            output_lines.append("  " * indent + f"🚫 {item}/ (נפסל לסריקה)")
            continue

        # שלב 2: דילוג על קבצים אסורים
        if not os.path.isdir(full_path) and item in SKIP_FILES:
            output_lines.append("  " * indent + f"🚫 {item} (נפסל לסריקה)")
            continue

        # תיקייה רגילה
        if os.path.isdir(full_path):
            output_lines.append("  " * indent + f"📁 {item}/")
            scan_directory(full_path, indent + 1, output_lines, current_depth + 1, print_content)

        # קובץ
        else:
            ext = os.path.splitext(item)[1].lower()
            if ext not in PRINT_CONTENT_EXTENSIONS:
                continue  # מדלג על קבצים לא רלוונטיים (כמו תמונות) בסריקה

            output_lines.append("  " * indent + f"📄 {item}")

            if print_content:
                try:
                    with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                        for line in f:
                            output_lines.append("  " * (indent + 1) + line.rstrip())
                except Exception as e:
                    output_lines.append("  " * (indent + 1) + f"[שגיאה בקריאה: {e}]")

    return output_lines


# --- פונקציות עזר (מהסקריפט המקורי) ---

def ask_include_content():
    root = tk.Tk()
    root.withdraw()
    result = messagebox.askyesno(
        "שלב 2: האם לכלול תוכן קבצים?",
        "ההעתקה הסתיימה.\nכעת נסרוק את התיקייה החדשה.\n\nהאם לכלול את תוכן קבצי הקוד (ולא רק את שמותיהם)?"
    )
    root.destroy()
    return result


# --- פונקציה ראשית (Main) ---

def main():
    root = tk.Tk()
    root.withdraw()

    # --- חלק 1: בחירת תיקיות ---
    source_path = filedialog.askdirectory(title="שלב 1: בחר תיקיית מקור (מאיפה להעתיק)")
    if not source_path:
        print("❌ בוטל - לא נבחרה תיקיית מקור.")
        return

    dest_path = filedialog.askdirectory(title="שלב 1: בחר תיקיית יעד (לאן להעתיק)")
    if not dest_path:
        print("❌ בוטל - לא נבחרה תיקיית יעד.")
        return

    if os.path.normpath(source_path) == os.path.normpath(dest_path):
        messagebox.showerror("שגיאה", "תיקיית המקור ותיקיית היעד לא יכולות להיות זהות.")
        return

    # --- חלק 2: ביצוע ההעתקה ---
    print(f"\n--- שלב 1: מתחיל העתקה מסוננת ---")
    print(f"   מקור: {source_path}")
    print(f"   יעד:  {dest_path}\n")
    
    copy_stats = copy_filtered_directory(source_path, dest_path)
    
    print(f"\n--- סיום שלב 1: ההעתקה הושלמה ---")
    print(f"   קבצים שהועתקו: {copy_stats['copied']}")
    print(f"   פריטים שדולגו: {copy_stats['skipped']}")
    print(f"   שגיאות: {copy_stats['errors']}")

    # --- חלק 3: ביצוע הסריקה ---
    print(f"\n--- שלב 2: מתחיל סריקת מבנה ---")
    print(f"   סורק את תיקיית היעד: {dest_path}")
    
    include_content = ask_include_content()
    structure_lines = scan_directory(dest_path, print_content=include_content)

    print("--- סיום שלב 2: הסריקה הושלמה. שומר קובץ סיכום... ---")

    # --- חלק 4: שמירת קובץ הסיכום ---
    try:
        # חישוב שם ונתיב הקובץ לפי הדרישה שלך
        dest_folder_name = os.path.basename(os.path.normpath(dest_path))
        parent_dir = os.path.dirname(os.path.normpath(dest_path))
        output_file_name = f"{dest_folder_name}.txt"
        output_file_path = os.path.join(parent_dir, output_file_name)

        with open(output_file_path, "w", encoding="utf-8") as f:
            f.write("\n".join(structure_lines))

        success_msg = (
            f"✅ התהליך המשולב הצליח!\n\n"
            f"1. התיקייה הועתקה (ללא קבצי זבל) אל:\n{dest_path}\n\n"
            f"2. קובץ סיכום המבנה נשמר לידה:\n{output_file_path}"
        )
        print(f"\n{success_msg}")
        messagebox.showinfo("הצלחה", success_msg)

    except Exception as e:
        error_msg = f"❌ שגיאה בשמירת קובץ הסיכום: {e}"
        print(f"\n{error_msg}")
        messagebox.showerror("שגיאה", error_msg)


if __name__ == "__main__":
    main()