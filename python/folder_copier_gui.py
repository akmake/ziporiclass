#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import shutil
from pathlib import Path
from dataclasses import dataclass
from typing import Optional, Tuple, List, Iterable

from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
import multiprocessing

from PyQt6 import QtCore, QtGui, QtWidgets

EXCLUDED_DIR_NAME = "node_modules"

# ============================ Copy Task (top-level for processes) ============================

@dataclass
class CopyJob:
    src: str
    dst: str
    overwrite: bool

def copy_file_job(job: CopyJob) -> Tuple[bool, str, str, Optional[str]]:
    """
    פונקציה טהורה (top-level) כדי שתהיה pickle-able עבור ProcessPool.
    מחזירה: (ok, src, dst, error_message)
    """
    try:
        src_path = Path(job.src)
        dst_path = Path(job.dst)

        if dst_path.exists() and not job.overwrite:
            return True, job.src, job.dst, None  # דילוג נחשב הצלחה שקטה

        # טיפול בסימלינק: נעתיק את היעד אם הוא קובץ, אחרת נדלג
        if src_path.is_symlink():
            try:
                real = src_path.resolve(strict=True)
                if real.is_file():
                    shutil.copy2(real, dst_path)
                    return True, job.src, job.dst, None
                else:
                    return True, job.src, job.dst, None  # דילוג
            except Exception as e:
                return False, job.src, job.dst, f"symlink error: {e}"
        else:
            shutil.copy2(src_path, dst_path)
            return True, job.src, job.dst, None

    except Exception as e:
        return False, job.src, job.dst, str(e)


# ============================ Worker (runs in main proc; farms jobs to pool) ============================

class FastCopyWorker(QtCore.QObject):
    progress = QtCore.pyqtSignal(int, int)     # copied, total (total may be 0 in quick mode)
    log = QtCore.pyqtSignal(str)
    finished = QtCore.pyqtSignal(bool)         # success
    fatal = QtCore.pyqtSignal(str)
    total_known = QtCore.pyqtSignal(int)       # announce total when known (accurate mode)

    def __init__(self, src: Path, dst: Path, overwrite: bool, mode: str, workers: int, quick_mode: bool):
        super().__init__()
        self.src = src
        self.dst = dst
        self.overwrite = overwrite
        self.mode = mode  # "threads" or "processes"
        self.workers = max(1, workers)
        self.quick_mode = quick_mode
        self._cancel = False

    @QtCore.pyqtSlot()
    def start(self):
        try:
            # ולידציה בסיסית
            if not self.src.exists():
                self.fatal.emit("תיקיית המקור לא קיימת.")
                self.finished.emit(False)
                return
            if not self.src.is_dir():
                self.fatal.emit("המקור אינו תיקייה.")
                self.finished.emit(False)
                return
            try:
                if self.dst.resolve().is_relative_to(self.src.resolve()):
                    self.fatal.emit("תיקיית היעד בתוך תיקיית המקור. בחר/י יעד אחר.")
                    self.finished.emit(False)
                    return
            except AttributeError:
                s, d = str(self.src.resolve()), str(self.dst.resolve())
                if d.startswith(s + os.sep):
                    self.fatal.emit("תיקיית היעד בתוך תיקיית המקור. בחר/י יעד אחר.")
                    self.finished.emit(False)
                    return

            self.dst.mkdir(parents=True, exist_ok=True)

            # הכנת רשימת משימות (Quick Mode: בלי ספירה מוקדמת)
            if self.quick_mode:
                self.log.emit("מצב מהיר: מתחיל מייד — בלי ספירה מוקדמת.")
                total = 0  # לא ידוע
                self.total_known.emit(0)
                jobs_iter = self._iter_jobs_incremental(self.src, self.dst)
                # נבצע העתקה תוך כדי יצירת המשימות
                success = self._execute_streaming(jobs_iter, total)
                self.finished.emit(success)
                return
            else:
                self.log.emit("מצב מדויק: סופר קבצים לפני העתקה…")
                jobs = list(self._collect_jobs(self.src, self.dst))
                total = len(jobs)
                self.total_known.emit(max(1, total))
                self.log.emit(f"נמצאו {total} קבצים להעתקה (node_modules מוחרג).")
                success = self._execute_jobs(jobs, total)
                self.finished.emit(success)
                return

        except Exception as e:
            self.fatal.emit(f"שגיאה קריטית: {e}")
            self.finished.emit(False)

    def cancel(self):
        self._cancel = True

    # ----- Build jobs -----
    def _collect_jobs(self, src: Path, dst: Path) -> Iterable[CopyJob]:
        for root, dirs, files in os.walk(src, topdown=True, followlinks=False):
            if self._cancel:
                break
            # החרגת node_modules
            dirs[:] = [d for d in dirs if d != EXCLUDED_DIR_NAME]

            root_path = Path(root)
            rel = root_path.relative_to(src)
            target_dir = dst / rel
            target_dir.mkdir(parents=True, exist_ok=True)

            for f in files:
                if self._cancel:
                    break
                src_f = root_path / f
                dst_f = target_dir / f
                yield CopyJob(str(src_f), str(dst_f), self.overwrite)

    def _iter_jobs_incremental(self, src: Path, dst: Path) -> Iterable[CopyJob]:
        # כמו collect, אבל מחזיר generator "חי" שנצרך תוך כדי העתקה
        return self._collect_jobs(src, dst)

    # ----- Execute jobs -----
    def _get_executor(self):
        if self.mode == "processes":
            # הערה: לתהליכים יש overhead גדול יותר, לא תמיד עדיף ל-I/O
            return ProcessPoolExecutor(max_workers=self.workers, mp_context=multiprocessing.get_context("spawn"))
        else:
            return ThreadPoolExecutor(max_workers=self.workers)

    def _execute_jobs(self, jobs: List[CopyJob], total: int) -> bool:
        if self._cancel:
            self.log.emit("בוטל לפני התחלה.")
            return False
        copied = 0
        errors = 0
        with self._get_executor() as ex:
            futures = [ex.submit(copy_file_job, job) for job in jobs]
            for fut in as_completed(futures):
                if self._cancel:
                    self.log.emit("ביטול התבקש — מחכה לסיום משימות פעילות…")
                    break
                ok, s, d, err = fut.result()
                if ok:
                    # לא נכביד על הלוג בכל שורה — אבל כן נעדכן כל פרוגרס
                    # self.log.emit(f"OK: {s} -> {d}")
                    pass
                else:
                    errors += 1
                    self.log.emit(f"❗ שגיאה: {s} → {d}: {err}")
                copied += 1
                self.progress.emit(copied, max(1, total))

        if self._cancel:
            self.log.emit("בוטל על ידי המשתמש.")
            return False

        if errors > 0:
            self.log.emit(f"⚠️ הסתיים עם {errors} שגיאות.")
            return False
        self.log.emit("✅ הסתיים בהצלחה.")
        return True

    def _execute_streaming(self, jobs_iter: Iterable[CopyJob], total_unknown: int) -> bool:
        """
        מצב מהיר: לא יודעים total מראש.
        נריץ במאגר (Threads/Processes) ונעדכן progress כמונה מצטבר (indeterminate ב-UI).
        """
        if self._cancel:
            self.log.emit("בוטל לפני התחלה.")
            return False

        copied = 0
        errors = 0
        inflight = set()

        with self._get_executor() as ex:
            for job in jobs_iter:
                if self._cancel:
                    self.log.emit("ביטול התבקש — ממתין לסיום המשימות שרצות…")
                    break
                fut = ex.submit(copy_file_job, job)
                inflight.add(fut)

                # ניקוי Futures שהסתיימו כדי לא לנפח זיכרון
                done = [f for f in inflight if f.done()]
                for f in done:
                    inflight.remove(f)
                    ok, s, d, err = f.result()
                    if not ok:
                        errors += 1
                        self.log.emit(f"❗ שגיאה: {s} → {d}: {err}")
                    copied += 1
                    # מעדכנים ב-total=0 כדי שה-UI יעבוד במצב בלתי-קבוע (marquee)
                    self.progress.emit(copied, 0)

            # סיום: לחכות לכל המשימות הפעילות
            for f in as_completed(inflight):
                ok, s, d, err = f.result()
                if not ok:
                    errors += 1
                    self.log.emit(f"❗ שגיאה: {s} → {d}: {err}")
                copied += 1
                self.progress.emit(copied, 0)

        if self._cancel:
            self.log.emit("בוטל על ידי המשתמש.")
            return False

        if errors > 0:
            self.log.emit(f"⚠️ הסתיים עם {errors} שגיאות.")
            return False
        self.log.emit("✅ הסתיים בהצלחה.")
        return True


# ============================ Modern UI ============================

class DropLineEdit(QtWidgets.QLineEdit):
    def __init__(self):
        super().__init__()
        self.setAcceptDrops(True)

    def dragEnterEvent(self, e: QtGui.QDragEnterEvent):
        if e.mimeData().hasUrls():
            urls = e.mimeData().urls()
            if urls and Path(urls[0].toLocalFile()).is_dir():
                e.acceptProposedAction()
                return
        super().dragEnterEvent(e)

    def dropEvent(self, e: QtGui.QDropEvent):
        urls = e.mimeData().urls()
        if urls:
            p = Path(urls[0].toLocalFile())
            if p.is_dir():
                self.setText(str(p))
        super().dropEvent(e)


class Card(QtWidgets.QFrame):
    def __init__(self, title: str):
        super().__init__()
        self.setObjectName("Card")
        self.setStyleSheet("""
        QFrame#Card {
            border: 1px solid rgba(255,255,255,0.10);
            border-radius: 14px;
            background: rgba(255,255,255,0.04);
        }
        QLabel[heading="true"] {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 6px;
        }
        """)
        v = QtWidgets.QVBoxLayout(self)
        v.setContentsMargins(14, 14, 14, 14)
        title_lbl = QtWidgets.QLabel(title)
        title_lbl.setProperty("heading", True)
        v.addWidget(title_lbl)
        self.body = QtWidgets.QVBoxLayout()
        v.addLayout(self.body)


class MainWindow(QtWidgets.QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("מעתיק תיקיות — מהיר ורב־ליבות (מדלג node_modules)")
        self.setMinimumSize(900, 600)

        central = QtWidgets.QWidget()
        self.setCentralWidget(central)
        grid = QtWidgets.QGridLayout(central)
        grid.setContentsMargins(16, 16, 16, 16)
        grid.setHorizontalSpacing(14)
        grid.setVerticalSpacing(14)

        # Paths
        self.card_paths = Card("בחירת נתיבים")
        grid.addWidget(self.card_paths, 0, 0, 1, 2)

        form = QtWidgets.QGridLayout()
        self.card_paths.body.addLayout(form)

        self.src_edit = DropLineEdit()
        self.dst_edit = DropLineEdit()
        btn_src = QtWidgets.QPushButton("בחר…")
        btn_dst = QtWidgets.QPushButton("בחר…")
        btn_src.clicked.connect(self.pick_src)
        btn_dst.clicked.connect(self.pick_dst)

        form.addWidget(QtWidgets.QLabel("תיקיית מקור:"), 0, 0)
        form.addWidget(self.src_edit, 0, 1)
        form.addWidget(btn_src, 0, 2)

        form.addWidget(QtWidgets.QLabel("תיקיית יעד:"), 1, 0)
        form.addWidget(self.dst_edit, 1, 1)
        form.addWidget(btn_dst, 1, 2)

        # Options
        self.card_opts = Card("אפשרויות ביצועים")
        grid.addWidget(self.card_opts, 1, 0, 1, 2)
        h = QtWidgets.QHBoxLayout()
        self.card_opts.body.addLayout(h)

        self.overwrite_chk = QtWidgets.QCheckBox("להחליף קבצים קיימים (overwrite)")
        self.quick_mode_chk = QtWidgets.QCheckBox("מצב מהיר (בלי ספירה מוקדמת)")
        self.quick_mode_chk.setChecked(True)

        self.mode_combo = QtWidgets.QComboBox()
        self.mode_combo.addItems(["Threads (מומלץ ל-I/O)", "Processes (תהליכים)"])
        self.workers_spin = QtWidgets.QSpinBox()
        self.workers_spin.setRange(1, max(2, (os.cpu_count() or 4) * 4))
        self.workers_spin.setValue(min(32, max(8, (os.cpu_count() or 8) * 2)))

        h.addWidget(self.overwrite_chk)
        h.addWidget(self.quick_mode_chk)
        h.addStretch(1)
        h.addWidget(QtWidgets.QLabel("מוד:"))
        h.addWidget(self.mode_combo)
        h.addWidget(QtWidgets.QLabel("מס׳ עובדים:"))
        h.addWidget(self.workers_spin)

        # Progress
        self.card_prog = Card("התקדמות")
        grid.addWidget(self.card_prog, 2, 0, 1, 2)
        self.progress = QtWidgets.QProgressBar()
        self.progress.setMinimum(0)
        self.progress.setValue(0)
        self.progress_lbl = QtWidgets.QLabel("מוכן")
        self.card_prog.body.addWidget(self.progress)
        self.card_prog.body.addWidget(self.progress_lbl)

        # Buttons
        self.start_btn = QtWidgets.QPushButton("התחל העתקה")
        self.start_btn.setProperty("primary", True)
        self.cancel_btn = QtWidgets.QPushButton("בטל")
        self.cancel_btn.setEnabled(False)
        grid.addWidget(self.start_btn, 3, 0)
        grid.addWidget(self.cancel_btn, 3, 1)

        self.start_btn.clicked.connect(self.start_copy)
        self.cancel_btn.clicked.connect(self.cancel_copy)

        # Log
        self.card_log = Card("לוג")
        grid.addWidget(self.card_log, 4, 0, 1, 2)
        self.log_view = QtWidgets.QPlainTextEdit()
        self.log_view.setReadOnly(True)
        self.log_view.setStyleSheet("font-family: Consolas, 'Courier New', monospace; font-size: 12px;")
        self.card_log.body.addWidget(self.log_view)

        # Styling
        self._apply_style()
        QtGui.QShortcut(QtGui.QKeySequence("Ctrl+L"), self, activated=self.clear_log)

        # Worker wiring
        self._thread = None
        self._worker = None

    def _apply_style(self):
        try:
            import qdarktheme
            qdarktheme.setup_theme("dark")  # 'auto' גם עובד; שמתי 'dark' ליציבות
        except Exception:
            QtWidgets.QApplication.setStyle("Fusion")
            palette = QtGui.QPalette()
            palette.setColor(QtGui.QPalette.ColorRole.Window, QtGui.QColor(35, 38, 41))
            palette.setColor(QtGui.QPalette.ColorRole.WindowText, QtCore.Qt.GlobalColor.white)
            palette.setColor(QtGui.QPalette.ColorRole.Base, QtGui.QColor(25, 27, 30))
            palette.setColor(QtGui.QPalette.ColorRole.Text, QtCore.Qt.GlobalColor.white)
            palette.setColor(QtGui.QPalette.ColorRole.Button, QtGui.QColor(45, 48, 53))
            palette.setColor(QtGui.QPalette.ColorRole.ButtonText, QtCore.Qt.GlobalColor.white)
            palette.setColor(QtGui.QPalette.ColorRole.Highlight, QtGui.QColor(88, 139, 255))
            palette.setColor(QtGui.QPalette.ColorRole.HighlightedText, QtCore.Qt.GlobalColor.black)
            QtWidgets.QApplication.setPalette(palette)

        self.setStyleSheet("""
        QPushButton {
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 10px;
            padding: 8px 14px;
            background: qlineargradient(x1:0,y1:0,x2:0,y2:1,
                        stop:0 rgba(255,255,255,0.08),
                        stop:1 rgba(255,255,255,0.03));
        }
        QPushButton:hover { border-color: rgba(255,255,255,0.35); }
        QPushButton:pressed { background: rgba(255,255,255,0.12); }
        QPushButton[primary="true"] {
            background: qlineargradient(x1:0,y1:0,x2:0,y2:1,
                        stop:0 #556BFF, stop:1 #3A54F5);
            border: none; color: white; font-weight: 600;
        }
        QLineEdit, QPlainTextEdit {
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 8px;
            padding: 6px 8px;
            background: rgba(255,255,255,0.04);
        }
        QProgressBar {
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 8px;
            text-align: center;
            height: 20px;
        }
        QProgressBar::chunk {
            border-radius: 8px;
            background-color: #6ea1ff;
        }
        """)

    # ---- UI helpers ----
    def append_log(self, line: str):
        self.log_view.appendPlainText(line)
        self.log_view.verticalScrollBar().setValue(self.log_view.verticalScrollBar().maximum())

    def clear_log(self):
        self.log_view.setPlainText("")

    def pick_src(self):
        d = QtWidgets.QFileDialog.getExistingDirectory(self, "בחר תיקיית מקור", str(Path.home()))
        if d:
            self.src_edit.setText(d)

    def pick_dst(self):
        d = QtWidgets.QFileDialog.getExistingDirectory(self, "בחר תיקיית יעד", str(Path.home()))
        if d:
            self.dst_edit.setText(d)

    # ---- Copy flow ----
    def start_copy(self):
        src = Path(self.src_edit.text().strip())
        dst = Path(self.dst_edit.text().strip())
        if not src or not dst:
            QtWidgets.QMessageBox.warning(self, "חסר נתיב", "אנא בחר/י גם תיקיית מקור וגם תיקיית יעד.")
            return
        if src == dst:
            QtWidgets.QMessageBox.critical(self, "שגיאה", "תיקיית המקור והיעד אינן יכולות להיות זהות.")
            return

        mode_text = self.mode_combo.currentText()
        mode = "threads" if mode_text.startswith("Threads") else "processes"
        workers = int(self.workers_spin.value())
        quick = self.quick_mode_chk.isChecked()

        self.clear_log()
        self.append_log(f"מתחיל העתקה ({mode}, workers={workers}, quick={quick})…")
        self.progress.setValue(0)
        if quick:
            # מצב indeterminate
            self.progress.setMaximum(0)
            self.progress_lbl.setText("מעתיק... (ללא ספירה מוקדמת)")
        else:
            self.progress.setMaximum(1)
            self.progress_lbl.setText("סופר קבצים...")

        # Thread for worker object
        self._thread = QtCore.QThread(self)
        self._worker = FastCopyWorker(src, dst, self.overwrite_chk.isChecked(), mode, workers, quick)
        self._worker.moveToThread(self._thread)

        self._thread.started.connect(self._worker.start)
        self._worker.log.connect(self.append_log)
        self._worker.fatal.connect(self.on_fatal)
        self._worker.finished.connect(self.on_finished)
        self._worker.finished.connect(self._thread.quit)
        self._worker.finished.connect(self._worker.deleteLater)
        self._thread.finished.connect(self._thread.deleteLater)
        self._worker.progress.connect(self.on_progress)
        self._worker.total_known.connect(self.on_total_known)

        self.start_btn.setEnabled(False)
        self.cancel_btn.setEnabled(True)

        self._thread.start()

    def cancel_copy(self):
        if self._worker:
            self._worker.cancel()
            self.append_log("מנסה לבטל...")

    @QtCore.pyqtSlot(int)
    def on_total_known(self, total: int):
        if total <= 0:
            # Quick mode already set to indeterminate above
            return
        self.progress.setMaximum(max(1, total))
        self.progress.setValue(0)
        self.progress_lbl.setText(f"סך הכל קבצים: {total}")

    @QtCore.pyqtSlot(int, int)
    def on_progress(self, copied: int, total: int):
        if total <= 0:
            # indeterminate state
            self.progress.setMaximum(0)
            self.progress_lbl.setText(f"הועתקו: {copied} (מצב מהיר)")
        else:
            if self.progress.maximum() != total:
                self.progress.setMaximum(total)
            self.progress.setValue(copied)
            self.progress_lbl.setText(f"הועתקו: {copied} / {total}")

    @QtCore.pyqtSlot(str)
    def on_fatal(self, msg: str):
        self.append_log(f"❌ {msg}")
        QtWidgets.QMessageBox.critical(self, "שגיאה", msg)

    @QtCore.pyqtSlot(bool)
    def on_finished(self, success: bool):
        self.cancel_btn.setEnabled(False)
        self.start_btn.setEnabled(True)
        if success:
            self.progress_lbl.setText("הסתיים בהצלחה.")
        else:
            self.progress_lbl.setText("הסתיים (עם בעיות/ביטול).")
        # החזרת progress למצב רגיל
        if self.progress.maximum() == 0:
            self.progress.setMaximum(1)
            self.progress.setValue(1)


# ============================ Entrypoint ============================

def main():
    multiprocessing.freeze_support()  # תומך ב-Windows בעת שימוש ב-ProcessPool
    app = QtWidgets.QApplication(sys.argv)
    app.setLayoutDirection(QtCore.Qt.LayoutDirection.RightToLeft)
    win = MainWindow()
    win.setWindowIcon(QtGui.QIcon.fromTheme("folder"))
    win.show()
    sys.exit(app.exec())

if __name__ == "__main__":
    main()
