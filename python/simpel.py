import os
import tkinter as tk
from tkinter import filedialog, messagebox

MAX_DEPTH = 5
SKIP_DIRS = {"node_modules", ".git", "__pycache__","package-lock.json"}
PRINT_CONTENT_EXTENSIONS = {".py", ".js", ".ts", ".jsx", ".tsx", ".html", ".css",".prisma", ".mjs", ".cjs", ".env", ".md", "Dockerfile","docker-compose.yml", ".jsonc", ".eslintrc.json", "tsconfig.json"}


def scan_directory(path, indent=0, output_lines=None, current_depth=0, print_content=False):
    if output_lines is None:
        output_lines = []

    if current_depth > MAX_DEPTH:
        output_lines.append("  " * indent + "🔽 ... (עוד תיקיות הוסתרו)")
        return output_lines

    try:
        items = sorted(os.listdir(path))
    except PermissionError:
        output_lines.append("  " * indent + f"[⛔ אין הרשאה]: {path}")
        return output_lines

    for item in items:
        full_path = os.path.join(path, item)

        if os.path.isdir(full_path) and item in SKIP_DIRS:
            print(f"⏭️ מדלג על תיקייה: {full_path}")
            output_lines.append("  " * indent + f"🚫 {item}/ (נפסל לסריקה)")
            continue

        print(f"▶️ סורק: {full_path}")

        if os.path.isdir(full_path):
            output_lines.append("  " * indent + f"📁 {item}/")
            scan_directory(full_path, indent + 1, output_lines, current_depth + 1, print_content)
        else:
            output_lines.append("  " * indent + f"📄 {item}")
            ext = os.path.splitext(item)[1].lower()
            if print_content and ext in PRINT_CONTENT_EXTENSIONS:
                try:
                    with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                        lines = f.readlines()
                        for line in lines:
                            output_lines.append("  " * (indent + 1) + line.rstrip())
                except Exception as e:
                    output_lines.append("  " * (indent + 1) + f"[שגיאה בקריאה: {e}]")

    return output_lines

def ask_include_content():
    root = tk.Tk()
    root.withdraw()
    result = messagebox.askyesno(
        "האם לכלול תוכן קבצים?",
        "האם אתה רוצה שהקוד ידפיס גם את תוכן קבצי הקוד (ולא רק את שמותיהם)?"
    )
    return result

def main():
    root = tk.Tk()
    root.withdraw()
    folder_path = filedialog.askdirectory(title="בחר תקייה לסריקה")

    if not folder_path:
        print("❌ לא נבחרה תקייה.")
        return

    include_content = ask_include_content()
    print(f"\n📂 סורק את: {folder_path} (עד עומק {MAX_DEPTH})")
    print(f"📄 כולל תוכן קבצים: {'כן' if include_content else 'לא'}\n")

    structure_lines = scan_directory(folder_path, print_content=include_content)

    print("\n📋 מבנה מלא:\n")
    for line in structure_lines:
        print(line)

    output_file = os.path.join(folder_path, "directory_structure.txt")
    with open(output_file, "w", encoding="utf-8") as f:
        f.write("\n".join(structure_lines))

    print(f"\n✅ נשמר ב: {output_file}")

if __name__ == "__main__":
    main()
