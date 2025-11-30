#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import shutil
import threading
import multiprocessing
from pathlib import Path
from dataclasses import dataclass
from typing import Optional, Tuple, Iterable, List

from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed

import tkinter as tk
from tkinter import ttk, filedialog, messagebox

EXCLUDED_DIR_NAME = "node_modules"

# =========================== COPY JOB ===========================

@dataclass
class CopyJob:
    src: str
    dst: str
    overwrite: bool

def copy_file_job(job: CopyJob) -> Tuple[bool, str, str, Optional[str]]:
    try:
        src_path = Path(job.src)
        dst_path = Path(job.dst)

        if dst_path.exists() and not job.overwrite:
            return True, job.src, job.dst, None

        if src_path.is_symlink():
            try:
                real = src_path.resolve(strict=True)
                if real.is_file():
                    shutil.copy2(real, dst_path)
                return True, job.src, job.dst, None
            except Exception as e:
                return False, job.src, job.dst, f"symlink error: {e}"

        shutil.copy2(src_path, dst_path)
        return True, job.src, job.dst, None

    except Exception as e:
        return False, job.src, job.dst, str(e)


# =========================== WORKER ===========================

class FastCopyWorker:
    def __init__(self, src: Path, dst: Path, overwrite: bool, mode: str,
                 workers: int, quick_mode: bool, ui_callback):
        self.src = src
        self.dst = dst
        self.overwrite = overwrite
        self.mode = mode
        self.workers = max(1, workers)
        self.quick_mode = quick_mode
        self._cancel = False
        self.ui = ui_callback

    def cancel(self):
        self._cancel = True

    def start(self):
        try:
            if not self.src.exists():
                self.ui.fatal("תיקיית המקור לא קיימת.")
                self.ui.finished(False)
                return

            if not self.src.is_dir():
                self.ui.fatal("המקור אינו תיקייה.")
                self.ui.finished(False)
                return

            if str(self.dst.resolve()).startswith(str(self.src.resolve()) + os.sep):
                self.ui.fatal("תיקיית היעד בתוך תיקיית המקור.")
                self.ui.finished(False)
                return

            self.dst.mkdir(parents=True, exist_ok=True)

            # QUICK
            if self.quick_mode:
                self.ui.log("מצב מהיר: מתחיל ללא ספירה מוקדמת.")
                jobs_iter = self._collect_jobs(self.src, self.dst)
                success = self._execute_streaming(jobs_iter)
                self.ui.finished(success)
                return

            # ACCURATE
            self.ui.log("מצב מדויק: סופר קבצים…")
            jobs = list(self._collect_jobs(self.src, self.dst))
            total = len(jobs)
            self.ui.total_known(total)
            self.ui.log(f"נמצאו {total} קבצים.")

            success = self._execute_jobs(jobs, total)
            self.ui.finished(success)

        except Exception as e:
            self.ui.fatal(f"שגיאה: {e}")
            self.ui.finished(False)

    def _collect_jobs(self, src: Path, dst: Path) -> Iterable[CopyJob]:
        for root, dirs, files in os.walk(src, topdown=True, followlinks=False):
            if self._cancel:
                break

            # Skip node_modules
            dirs[:] = [d for d in dirs if d != EXCLUDED_DIR_NAME]

            root_path = Path(root)
            rel = root_path.relative_to(src)
            target_dir = dst / rel
            target_dir.mkdir(parents=True, exist_ok=True)

            for f in files:
                if self._cancel:
                    break
                yield CopyJob(str(root_path / f), str(target_dir / f), self.overwrite)

    def _get_executor(self):
        if self.mode == "processes":
            return ProcessPoolExecutor(
                max_workers=self.workers,
                mp_context=multiprocessing.get_context("spawn")
            )
        return ThreadPoolExecutor(max_workers=self.workers)

    def _execute_jobs(self, jobs: List[CopyJob], total: int):
        copied = 0
        errors = 0

        with self._get_executor() as ex:
            futures = [ex.submit(copy_file_job, job) for job in jobs]

            for fut in as_completed(futures):
                if self._cancel:
                    self.ui.log("בוטל על ידי המשתמש.")
                    return False

                ok, s, d, err = fut.result()

                if not ok:
                    errors += 1
                    self.ui.log(f"שגיאה: {s} → {d}: {err}")

                copied += 1
                self.ui.progress(copied, total)

        if errors:
            self.ui.log(f"סיום עם {errors} שגיאות.")
            return False

        self.ui.log("הסתיים בהצלחה.")
        return True

    def _execute_streaming(self, jobs_iter: Iterable[CopyJob]):
        copied = 0
        errors = 0
        inflight = set()

        with self._get_executor() as ex:
            for job in jobs_iter:
                if self._cancel:
                    break

                fut = ex.submit(copy_file_job, job)
                inflight.add(fut)

                done = [f for f in inflight if f.done()]
                for f in done:
                    inflight.remove(f)
                    ok, s, d, err = f.result()
                    if not ok:
                        errors += 1
                        self.ui.log(f"שגיאה: {s} → {d}: {err}")

                    copied += 1
                    self.ui.progress(copied, 0)

            for f in as_completed(inflight):
                ok, s, d, err = f.result()
                if not ok:
                    errors += 1
                copied += 1
                self.ui.progress(copied, 0)

        if errors:
            self.ui.log(f"סיום עם {errors} שגיאות.")
            return False

        self.ui.log("הסתיים בהצלחה.")
        return True


# =========================== UI ===========================

class TkUI:
    def __init__(self, root):
        self.root = root
        root.title("מעתיק תיקיות — Tk Edition")
        root.geometry("850x600")

        self.src_var = tk.StringVar()
        self.dst_var = tk.StringVar()

        frm = ttk.Frame(root, padding=10)
        frm.pack(fill="both", expand=True)

        # Paths
        ttk.Label(frm, text="תיקיית מקור:").grid(row=0, column=0, sticky="w")
        ttk.Entry(frm, textvariable=self.src_var, width=60).grid(row=0, column=1, sticky="we")
        ttk.Button(frm, text="בחר", command=self.pick_src).grid(row=0, column=2)

        ttk.Label(frm, text="תיקיית יעד:").grid(row=1, column=0, sticky="w")
        ttk.Entry(frm, textvariable=self.dst_var, width=60).grid(row=1, column=1, sticky="we")
        ttk.Button(frm, text="בחר", command=self.pick_dst).grid(row=1, column=2)

        # Options
        self.overwrite_var = tk.BooleanVar()
        self.quick_var = tk.BooleanVar(value=True)

        ttk.Checkbutton(frm, text="Overwrite", variable=self.overwrite_var).grid(row=2, column=0, sticky="w")
        ttk.Checkbutton(frm, text="Quick Mode", variable=self.quick_var).grid(row=2, column=1, sticky="w")

        ttk.Label(frm, text="מוד:").grid(row=3, column=0, sticky="w")
        self.mode_cb = ttk.Combobox(frm, values=["threads", "processes"], width=10)
        self.mode_cb.set("threads")
        self.mode_cb.grid(row=3, column=1)

        ttk.Label(frm, text="מס' עובדים:").grid(row=3, column=2, sticky="w")
        self.workers_var = tk.IntVar(value=8)
        ttk.Entry(frm, textvariable=self.workers_var, width=5).grid(row=3, column=3)

        # Progress
        self.prog_lbl = ttk.Label(frm, text="מוכן")
        self.prog_lbl.grid(row=4, column=0, sticky="w")

        self.prog_bar = ttk.Progressbar(frm, length=400)
        self.prog_bar.grid(row=4, column=1, columnspan=3, sticky="we")

        # Buttons
        ttk.Button(frm, text="התחל", command=self.start_copy).grid(row=5, column=1)
        self.cancel_btn = ttk.Button(frm, text="בטל", command=self.cancel_copy, state="disabled")
        self.cancel_btn.grid(row=5, column=2)

        # Log
        self.log_box = tk.Text(frm, height=15, font=("Consolas", 10))
        self.log_box.grid(row=6, column=0, columnspan=4, sticky="nsew")

        frm.rowconfigure(6, weight=1)
        frm.columnconfigure(1, weight=1)

        self.worker = None
        self.thread = None

    # ======== Worker callbacks: no name conflicts ========

    def log(self, text: str):
        self.log_box.insert("end", text + "\n")
        self.log_box.see("end")

    def fatal(self, msg: str):
        self.log("❌ " + msg)
        messagebox.showerror("שגיאה", msg)

    def total_known(self, total: int):
        self.prog_bar.configure(maximum=total, value=0)
        self.prog_lbl.config(text=f"סך הכל: {total}")

    def progress(self, copied: int, total: int):
        if total <= 0:
            self.prog_bar.configure(mode="indeterminate")
            self.prog_lbl.config(text=f"{copied} קבצים (מצב מהיר)")
        else:
            self.prog_bar.configure(mode="determinate", maximum=total, value=copied)
            self.prog_lbl.config(text=f"{copied}/{total}")

    def finished(self, success: bool):
        self.cancel_btn.configure(state="disabled")
        self.thread = None

        if success:
            self.prog_lbl.config(text="הסתיים בהצלחה")
        else:
            self.prog_lbl.config(text="הסתיים (שגיאות / ביטול)")

    # ======== UI Actions ========

    def pick_src(self):
        d = filedialog.askdirectory()
        if d:
            self.src_var.set(d)

    def pick_dst(self):
        d = filedialog.askdirectory()
        if d:
            self.dst_var.set(d)

    def start_copy(self):
        src = Path(self.src_var.get().strip())
        dst = Path(self.dst_var.get().strip())

        if not src or not dst:
            messagebox.showwarning("שגיאה", "חייב לבחור גם מקור וגם יעד")
            return
        if src == dst:
            messagebox.showerror("שגיאה", "התיקיות זהות")
            return

        # clear log
        self.log_box.delete("1.0", "end")

        mode = self.mode_cb.get()
        workers = int(self.workers_var.get())
        quick = self.quick_var.get()

        self.worker = FastCopyWorker(src, dst, self.overwrite_var.get(),
                                     mode, workers, quick, self)

        self.thread = threading.Thread(target=self.worker.start, daemon=True)
        self.thread.start()

        self.cancel_btn.configure(state="normal")

    def cancel_copy(self):
        if self.worker:
            self.worker.cancel()
            self.log("מנסה לבטל...")


# =========================== MAIN ===========================

def main():
    multiprocessing.freeze_support()
    root = tk.Tk()
    app = TkUI(root)
    root.mainloop()

if __name__ == "__main__":
    main()
