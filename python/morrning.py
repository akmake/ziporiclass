# rubiks_visual_solver.py
# מערכת ויזואלית תלת־ממד לקוביית רוביק עם סקרמבל, תנועות, "פתרון" ע"י Undo,
# HUD עשיר בעברית (עמיד ליוניקוד), חלקיקי ניצוץ, רקע חי, ומחוות עכבר.
# תלויות: pygame, PyOpenGL, PyOpenGL_accelerate
# בדוק בפייתון 3.11+ (כולל 3.13).

import sys
import math
import random
from dataclasses import dataclass
from typing import List, Tuple, Optional

import pygame
from pygame.locals import *
# נעדיף freetype עבור עברית/יוניקוד; אם אין, ניפול ל-pygame.font
try:
    import pygame.freetype as ft
    HAS_FT = True
except Exception:
    HAS_FT = False

from OpenGL.GL import *
from OpenGL.GLU import *

# ==========================
# צבעים, קבועים, עזר
# ==========================

COLORS = {
    'U': (0.95, 0.95, 0.95),  # לבן
    'R': (0.90, 0.10, 0.10),  # אדום
    'F': (0.10, 0.70, 0.10),  # ירוק
    'D': (0.98, 0.90, 0.10),  # צהוב
    'L': (0.98, 0.55, 0.10),  # כתום
    'B': (0.10, 0.30, 0.95),  # כחול
    'K': (0.07, 0.07, 0.07),  # שחור למסגרות
}

FACES = ['U', 'R', 'F', 'D', 'L', 'B']

# ציור
STICKER_SIZE = 0.96
GAP = 0.06
CUBE_HALF = 1.5
LINE_W = 2.0

# אנימציה ותצוגה
DEFAULT_FPS = 60

def clamp(v, lo, hi):
    return max(lo, min(hi, v))

def ease_out_cubic(t):  # t in [0,1]
    return 1 - pow(1 - t, 3)

def ease_in_out_quad(t):
    return 2*t*t if t < 0.5 else 1 - pow(-2*t + 2, 2)/2

# ==========================
# מצב הקובייה והמהלכים
# ==========================

def rotate_face_cw(face):
    return [[face[2 - j][i] for j in range(3)] for i in range(3)]

def rotate_face_ccw(face):
    return [[face[j][2 - i] for j in range(3)] for i in range(3)]

@dataclass
class CubeState:
    U: List[List[str]]
    R: List[List[str]]
    F: List[List[str]]
    D: List[List[str]]
    L: List[List[str]]
    B: List[List[str]]

    @staticmethod
    def solved():
        return CubeState(
            U=[[ 'U' for _ in range(3)] for _ in range(3)],
            R=[[ 'R' for _ in range(3)] for _ in range(3)],
            F=[[ 'F' for _ in range(3)] for _ in range(3)],
            D=[[ 'D' for _ in range(3)] for _ in range(3)],
            L=[[ 'L' for _ in range(3)] for _ in range(3)],
            B=[[ 'B' for _ in range(3)] for _ in range(3)],
        )

    def copy(self):
        return CubeState(
            U=[row[:] for row in self.U],
            R=[row[:] for row in self.R],
            F=[row[:] for row in self.F],
            D=[row[:] for row in self.D],
            L=[row[:] for row in self.L],
            B=[row[:] for row in self.B],
        )

# --- מהלכים ---

def move_U(s: CubeState):
    s.U = rotate_face_cw(s.U)
    s.F[0], s.R[0], s.B[0], s.L[0] = s.L[0][:], s.F[0][:], s.R[0][:], s.B[0][:]

def move_U_prime(s: CubeState):
    s.U = rotate_face_ccw(s.U)
    s.F[0], s.R[0], s.B[0], s.L[0] = s.R[0][:], s.B[0][:], s.L[0][:], s.F[0][:]

def move_D(s: CubeState):
    s.D = rotate_face_cw(s.D)
    s.F[2], s.L[2], s.B[2], s.R[2] = s.R[2][:], s.F[2][:], s.L[2][:], s.B[2][:]

def move_D_prime(s: CubeState):
    s.D = rotate_face_ccw(s.D)
    s.F[2], s.L[2], s.B[2], s.R[2] = s.L[2][:], s.B[2][:], s.R[2][:], s.F[2][:]

def move_R(s: CubeState):
    s.R = rotate_face_cw(s.R)
    colU = [s.U[i][2] for i in range(3)]
    colF = [s.F[i][2] for i in range(3)]
    colD = [s.D[i][2] for i in range(3)]
    colB = [s.B[i][0] for i in range(3)]
    for i in range(3):
        s.U[i][2] = s.F[i][2]
        s.F[i][2] = s.D[i][2]
        s.D[i][2] = colB[2 - i]
        s.B[i][0] = colU[2 - i]

def move_R_prime(s: CubeState):
    s.R = rotate_face_ccw(s.R)
    colU = [s.U[i][2] for i in range(3)]
    colF = [s.F[i][2] for i in range(3)]
    colD = [s.D[i][2] for i in range(3)]
    colB = [s.B[i][0] for i in range(3)]
    for i in range(3):
        s.U[i][2] = colB[2 - i]
        s.F[i][2] = colU[i]
        s.D[i][2] = colF[i]
        s.B[i][0] = colD[2 - i]

def move_L(s: CubeState):
    s.L = rotate_face_cw(s.L)
    colU = [s.U[i][0] for i in range(3)]
    colF = [s.F[i][0] for i in range(3)]
    colD = [s.D[i][0] for i in range(3)]
    colB = [s.B[i][2] for i in range(3)]
    for i in range(3):
        s.U[i][0] = colB[2 - i]
        s.F[i][0] = colU[i]
        s.D[i][0] = colF[i]
        s.B[i][2] = colD[2 - i]

def move_L_prime(s: CubeState):
    s.L = rotate_face_ccw(s.L)
    colU = [s.U[i][0] for i in range(3)]
    colF = [s.F[i][0] for i in range(3)]
    colD = [s.D[i][0] for i in range(3)]
    colB = [s.B[i][2] for i in range(3)]
    for i in range(3):
        s.U[i][0] = colF[i]
        s.F[i][0] = colD[i]
        s.D[i][0] = colB[2 - i]
        s.B[i][2] = colU[2 - i]

def move_F(s: CubeState):
    s.F = rotate_face_cw(s.F)
    rowU = s.U[2][:]
    colR = [s.R[i][0] for i in range(3)]
    rowD = s.D[0][:]
    colL = [s.L[i][2] for i in range(3)]
    s.U[2] = colL[::-1]
    for i in range(3):
        s.R[i][0] = rowU[i]
    s.D[0] = colR[::-1]
    for i in range(3):
        s.L[i][2] = rowD[i]

def move_F_prime(s: CubeState):
    s.F = rotate_face_ccw(s.F)
    rowU = s.U[2][:]
    colR = [s.R[i][0] for i in range(3)]
    rowD = s.D[0][:]
    colL = [s.L[i][2] for i in range(3)]
    s.U[2] = [colR[i] for i in range(3)]
    for i in range(3):
        s.R[i][0] = rowD[i]
    s.D[0] = [colL[2 - i] for i in range(3)]
    for i in range(3):
        s.L[i][2] = rowU[i]

def move_B(s: CubeState):
    s.B = rotate_face_cw(s.B)
    rowU = s.U[0][:]
    colR = [s.R[i][2] for i in range(3)]
    rowD = s.D[2][:]
    colL = [s.L[i][0] for i in range(3)]
    s.U[0] = [colR[i] for i in range(3)][::-1]
    for i in range(3):
        s.R[i][2] = rowD[i]
    s.D[2] = [colL[i] for i in range(3)][::-1]
    for i in range(3):
        s.L[i][0] = rowU[i]

def move_B_prime(s: CubeState):
    s.B = rotate_face_ccw(s.B)
    rowU = s.U[0][:]
    colR = [s.R[i][2] for i in range(3)]
    rowD = s.D[2][:]
    colL = [s.L[i][0] for i in range(3)]
    s.U[0] = [colL[i] for i in range(3)]
    for i in range(3):
        s.R[i][2] = rowU[i]
    s.D[2] = [colR[i] for i in range(3)]
    for i in range(3):
        s.L[i][0] = rowD[i]

def move_double(fn, s: CubeState):
    fn(s); fn(s)

MOVE_FUNCS = {
    'U' : move_U,  "U'": move_U_prime, 'U2': lambda s: move_double(move_U, s),
    'D' : move_D,  "D'": move_D_prime, 'D2': lambda s: move_double(move_D, s),
    'R' : move_R,  "R'": move_R_prime, 'R2': lambda s: move_double(move_R, s),
    'L' : move_L,  "L'": move_L_prime, 'L2': lambda s: move_double(move_L, s),
    'F' : move_F,  "F'": move_F_prime, 'F2': lambda s: move_double(move_F, s),
    'B' : move_B,  "B'": move_B_prime, 'B2': lambda s: move_double(move_B, s),
}

def invert_move(m: str) -> str:
    if m.endswith("2"): return m
    return m[:-1] if m.endswith("'") else m + "'"

# ==========================
# רינדור
# ==========================

def draw_square(color, verts):
    glColor3f(*color)
    glBegin(GL_QUADS)
    for v in verts: glVertex3f(*v)
    glEnd()

def draw_border(verts):
    glColor3f(*COLORS['K'])
    glLineWidth(LINE_W)
    glBegin(GL_LINE_LOOP)
    for v in verts: glVertex3f(*v)
    glEnd()

def vadd(a,b): return (a[0]+b[0], a[1]+b[1], a[2]+b[2])
def vscale(a,s): return (a[0]*s, a[1]*s, a[2]*s)

def face_plane(face_char):
    H = CUBE_HALF
    if face_char == 'U':
        normal=(0,1,0); base=(0,H,0);    axis_u=(1,0,0);  axis_v=(0,0,-1)
    elif face_char == 'D':
        normal=(0,-1,0); base=(0,-H,0);  axis_u=(1,0,0);  axis_v=(0,0,1)
    elif face_char == 'F':
        normal=(0,0,1); base=(0,0,H);    axis_u=(1,0,0);  axis_v=(0,-1,0)
    elif face_char == 'B':
        normal=(0,0,-1); base=(0,0,-H);  axis_u=(-1,0,0); axis_v=(0,-1,0)
    elif face_char == 'R':
        normal=(1,0,0); base=(H,0,0);    axis_u=(0,0,-1); axis_v=(0,-1,0)
    elif face_char == 'L':
        normal=(-1,0,0); base=(-H,0,0);  axis_u=(0,0,1);  axis_v=(0,-1,0)
    else:
        normal=(0,0,0); base=(0,0,0); axis_u=(1,0,0); axis_v=(0,1,0)
    return normal, base, axis_u, axis_v

def draw_face(face_char: str, face_grid: List[List[str]]):
    _, base, axis_u, axis_v = face_plane(face_char)
    cell = (STICKER_SIZE - GAP) / 3.0
    for r in range(3):
        for c in range(3):
            color = COLORS[face_grid[r][c]]
            du = (c - 1) * cell
            dv = (r - 1) * cell
            center = vadd(base, vadd(vscale(axis_u, du), vscale(axis_v, dv)))
            half = cell/2 - GAP/2
            p1 = vadd(center, vadd(vscale(axis_u, -half), vscale(axis_v, -half)))
            p2 = vadd(center, vadd(vscale(axis_u,  half), vscale(axis_v, -half)))
            p3 = vadd(center, vadd(vscale(axis_u,  half), vscale(axis_v,  half)))
            p4 = vadd(center, vadd(vscale(axis_u, -half), vscale(axis_v,  half)))
            verts = [p1,p2,p3,p4]
            draw_square(color, verts)
            draw_border(verts)

def draw_cube(state: CubeState):
    draw_face('U', state.U)
    draw_face('R', state.R)
    draw_face('F', state.F)
    draw_face('D', state.D)
    draw_face('L', state.L)
    draw_face('B', state.B)

# ==========================
# HUD וטקסט (עמיד לעברית)
# ==========================

class TextRenderer:
    def __init__(self, size=18):
        self.size = size
        self.ft_font = None
        self.pg_font = None
        self._init_fonts()

    def _try_ft(self, name, sz):
        if not HAS_FT: return None
        try:
            f = ft.SysFont(name, sz, bold=False)
            r = f.get_rect("בדיקה טקסט")
            if r.width > 0: return f
        except Exception:
            pass
        return None

    def _try_pg(self, name, sz):
        try:
            f = pygame.font.SysFont(name, sz)
            if f.size("בדיקה טקסט")[0] > 0: return f
        except Exception:
            pass
        return None

    def _init_fonts(self):
        pygame.font.init()
        candidates = ["Noto Sans Hebrew", "Rubik", "Arial", "Segoe UI", "Tahoma"]
        # נסה freetype
        for nm in candidates:
            ftf = self._try_ft(nm, self.size)
            if ftf:
                self.ft_font = ftf
                return
        # נפילה ל-pygame.font
        for nm in candidates:
            pgf = self._try_pg(nm, self.size)
            if pgf:
                self.pg_font = pgf
                return
        # אחרון
        if HAS_FT:
            self.ft_font = ft.Font(None, self.size)
        else:
            self.pg_font = pygame.font.Font(None, self.size)

    def render(self, surface, text, pos, color=(235,235,240), shadow=True):
        x,y = pos
        if self.ft_font:
            if shadow:
                self.ft_font.render_to(surface, (x+1,y+1), text, (0,0,0,100))
            self.ft_font.render_to(surface, (x,y), text, color)
        else:
            # pygame.font
            try:
                s = self.pg_font.render(text, True, color)
            except pygame.error:
                # הסרת תווים בעייתיים להצגה ולא להפיל את התוכנית
                safe = text.encode("ascii","ignore").decode() or "."
                s = self.pg_font.render(safe, True, color)
            if shadow:
                sh = self.pg_font.render(text, True, (0,0,0))
                surface.blit(sh, (x+1,y+1))
            surface.blit(s, (x,y))

# ==========================
# חלקיקים פשוטים לניצוץ
# ==========================

class Particle:
    def __init__(self):
        self.reset()

    def reset(self, around=(0,0,0)):
        ax, ay, az = around
        # מיקום קרוב לקובייה
        self.x = ax + random.uniform(-2.2, 2.2)
        self.y = ay + random.uniform(-2.2, 2.2)
        self.z = az + random.uniform(-2.2, 2.2)
        self.vy = random.uniform(0.002, 0.01)
        self.life = random.uniform(1.0, 2.5)
        self.size = random.uniform(0.01, 0.04)
        self.color = (random.uniform(0.7,1.0), random.uniform(0.2,0.6), random.uniform(0.8,1.0))
        self.alive = True

    def update(self, dt):
        if not self.alive: return
        self.y += self.vy * dt
        self.life -= 0.001 * dt
        if self.life <= 0:
            self.alive = False

    def draw(self):
        if not self.alive: return
        glPointSize(max(1.0, self.size*300))
        glBegin(GL_POINTS)
        glColor4f(self.color[0], self.color[1], self.color[2], clamp(self.life/2.5, 0.15, 0.9))
        glVertex3f(self.x, self.y, self.z)
        glEnd()

# ==========================
# בקר, סקרמבל, תור מהלכים
# ==========================

class RubiksController:
    def __init__(self):
        self.state = CubeState.solved()
        self.history: List[str] = []  # היסטוריית מהלכים (לפתרון Undo)
        self.queue: List[str] = []    # תור ביצוע אנימטיבי
        self.last_scramble: List[str] = []

    def do_move(self, m: str, record=True):
        MOVE_FUNCS[m](self.state)
        if record:
            self.history.append(m)

    def do_moves(self, moves: List[str], record=True):
        for m in moves:
            self.do_move(m, record=record)

    def invert_history(self) -> List[str]:
        return [invert_move(m) for m in reversed(self.history)]

    def enqueue(self, moves: List[str], clear_queue=False):
        if clear_queue: self.queue.clear()
        self.queue.extend(moves)

    def scramble(self, length=25):
        basics = ['U','D','L','R','F','B']
        suffixes = ['', "'", '2']
        moves = []
        prev_axis = None
        for _ in range(length):
            while True:
                f = random.choice(basics)
                suf = random.choice(suffixes)
                m = f + suf
                axis = 'UD' if f in ['U','D'] else ('LR' if f in ['L','R'] else 'FB')
                if axis != prev_axis:
                    prev_axis = axis
                    moves.append(m)
                    break
        # נתחיל מאיפוס כדי שהיסטוריית הפתרון תהיה בדיוק הסקרמבל
        self.reset()
        self.do_moves(moves, record=True)
        self.last_scramble = moves[:]
        return moves

    def reset(self):
        self.state = CubeState.solved()
        self.history.clear()
        self.queue.clear()

# ==========================
# מצלמה וקלט
# ==========================

class Camera:
    def __init__(self):
        self.rot_x = 28
        self.rot_y = -40
        self.distance = 6.3
        self._dragging = False
        self._last = (0,0)
        self.auto_orbit = True
        self.orbit_speed = 0.12

    def apply(self):
        glTranslatef(0, 0, -self.distance)
        glRotatef(self.rot_x, 1, 0, 0)
        glRotatef(self.rot_y, 0, 1, 0)

    def update_auto(self, dt):
        if self.auto_orbit:
            self.rot_y += self.orbit_speed * dt

    def mouse_down(self, pos):
        self._dragging = True
        self._last = pos
        self.auto_orbit = False

    def mouse_up(self):
        self._dragging = False

    def mouse_motion(self, pos):
        if not self._dragging: return
        dx = pos[0] - self._last[0]
        dy = pos[1] - self._last[1]
        self.rot_y += dx * 0.3
        self.rot_x = clamp(self.rot_x + dy * 0.3, -89, 89)
        self._last = pos

    def mouse_wheel(self, delta):
        self.distance = clamp(self.distance - delta*0.4, 3.5, 12.0)

# ==========================
# אפליקציה
# ==========================

class App:
    def __init__(self, width=1100, height=800):
        pygame.init()
        pygame.display.set_caption("קוביית רוביק – הדמיה חיה (Undo Solver)")
        pygame.display.set_mode((width, height), DOUBLEBUF | OPENGL)
        self.clock = pygame.time.Clock()
        self.width = width
        self.height = height

        # OpenGL בסיסי
        glEnable(GL_DEPTH_TEST)
        glEnable(GL_MULTISAMPLE)
        glEnable(GL_BLEND)
        glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA)
        glClearColor(0.06, 0.06, 0.09, 1.0)

        gluPerspective(45, (width/height), 0.1, 100.0)

        self.controller = RubiksController()
        self.camera = Camera()
        self.txt = TextRenderer(size=18)

        # אנימציית מהלכים
        self.anim_move: Optional[str] = None
        self.anim_elapsed = 0.0
        self.anim_duration_ms = 220  # ניתן לשינוי עם A
        self.animating_whole_cube = True  # פשטות: סיבוב כללי
        self.last_dt = 0

        # חלקיקים
        self.particles = [Particle() for _ in range(160)]

        # UI מצבים
        self.show_help = True
        self.wireframe = False

    # --------- ציורי רקע/קרקע/מסגרת ---------

    def draw_background_quad(self):
        # גרדיאנט אופקי/אלכסוני
        glDisable(GL_DEPTH_TEST)
        glMatrixMode(GL_PROJECTION)
        glPushMatrix()
        glLoadIdentity()
        glOrtho(0, 1, 0, 1, -1, 1)
        glMatrixMode(GL_MODELVIEW)
        glPushMatrix()
        glLoadIdentity()

        glBegin(GL_QUADS)
        glColor3f(0.05, 0.06, 0.11)
        glVertex2f(0,0)
        glVertex2f(1,0)
        glColor3f(0.10, 0.11, 0.20)
        glVertex2f(1,1)
        glVertex2f(0,1)
        glEnd()

        glPopMatrix()
        glMatrixMode(GL_PROJECTION)
        glPopMatrix()
        glMatrixMode(GL_MODELVIEW)
        glEnable(GL_DEPTH_TEST)

    def draw_ground_shadow(self):
        # דיסק כהה מתחת לקובייה
        glPushMatrix()
        glTranslatef(0, -1.9, 0)
        glRotatef(90, 1, 0, 0)
        glColor4f(0,0,0,0.25)
        glBegin(GL_TRIANGLE_FAN)
        glVertex3f(0,0,0)
        for i in range(64):
            ang = i/64 * math.tau
            glVertex3f(math.cos(ang)*2.2, math.sin(ang)*2.2, 0)
        glEnd()
        glPopMatrix()

    # --------- HUD ---------

    def draw_panel(self, rect, alpha=110):
        x,y,w,h = rect
        surf = pygame.Surface((w,h), pygame.SRCALPHA)
        pygame.draw.rect(surf, (20,25,35,alpha), (0,0,w,h), border_radius=14)
        pygame.display.get_surface().blit(surf, (x,y))

    def draw_hud(self, fps):
        screen = pygame.display.get_surface()
        # פאנל עליון
        self.draw_panel((10, 10, self.width-20, 88), alpha=90)
        pad = 18
        self.txt.render(screen, "SPACE=סקרמבל   S=פתרון(Undo)   C=איפוס   A=מהירות אנימציה   W=Wireframe   H=עזרה   עכבר=סיבוב/זום", (20, 18))
        self.txt.render(screen, f"מהלכים בהיסטוריה: {len(self.controller.history)} | בתור: {len(self.controller.queue)} | אנימציה: {self.anim_duration_ms}ms | FPS: {int(fps)}", (20, 42))
        if self.controller.last_scramble:
            scr = " ".join(self.controller.last_scramble[:24])
            self.txt.render(screen, f"סקרמבל אחרון: {scr}{' ...' if len(self.controller.last_scramble)>24 else ''}", (20, 66))

        # פאנל תחתון (עזרה)
        if self.show_help:
            h = 120
            self.draw_panel((10, self.height - h - 10, self.width-20, h), alpha=90)
            y = self.height - h
            lines = [
                "תנועות: U/D/L/R/F/B (Shift+אות = גרש), וחיצים לסיבוב מצלמה.",
                "גלגלת עכבר לזום. חיצים/גרירה ללכידת זווית.",
                "פתרון Undo מחזיר את כל המהלכים שנעשו דרך המערכת (כולל הסקרמבל) — פתרון מלא לסקרמבל הנוכחי.",
            ]
            yy = y + 10
            for ln in lines:
                self.txt.render(screen, ln, (20, yy))
                yy += 26

        # פס התקדמות קטן בזמן מהלך
        if self.anim_move is not None:
            prog = clamp(self.anim_elapsed / self.anim_duration_ms, 0.0, 1.0)
            prog = ease_out_cubic(prog)
            bar_w = int((self.width - 40) * prog)
            pygame.draw.rect(screen, (60,180,250,220), (20, 102, bar_w, 6), border_radius=3)

    # --------- קלט ---------

    def process_input(self):
        for event in pygame.event.get():
            if event.type == QUIT:
                pygame.quit(); sys.exit(0)
            elif event.type == KEYDOWN:
                mod = pygame.key.get_mods()
                shift = (mod & KMOD_SHIFT) != 0
                if event.key == K_ESCAPE:
                    pygame.quit(); sys.exit(0)
                elif event.key == K_SPACE:
                    self.controller.scramble(25)
                elif event.key == K_s:
                    sol = self.controller.invert_history()
                    self.controller.enqueue(sol, clear_queue=True)
                    self.controller.history.clear()
                elif event.key == K_c:
                    self.controller.reset()
                elif event.key == K_a:
                    # מהיר/איטי
                    self.anim_duration_ms = 90 if self.anim_duration_ms == 220 else 220
                elif event.key == K_h:
                    self.show_help = not self.show_help
                elif event.key == K_w:
                    self.wireframe = not self.wireframe
                    glPolygonMode(GL_FRONT_AND_BACK, GL_LINE if self.wireframe else GL_FILL)
                elif event.key in (K_LEFT, K_RIGHT, K_UP, K_DOWN):
                    if event.key == K_LEFT:  self.camera.rot_y -= 7
                    if event.key == K_RIGHT: self.camera.rot_y += 7
                    if event.key == K_UP:    self.camera.rot_x -= 7
                    if event.key == K_DOWN:  self.camera.rot_x += 7
                else:
                    keymap = {K_u:'U', K_d:'D', K_l:'L', K_r:'R', K_f:'F', K_b:'B'}
                    if event.key in keymap:
                        m = keymap[event.key] + ("'" if shift else "")
                        self.controller.enqueue([m])
            elif event.type == MOUSEBUTTONDOWN:
                if event.button == 1:
                    self.camera.mouse_down(event.pos)
                elif event.button == 4:  # גלגלת למעלה
                    self.camera.mouse_wheel(+1)
                elif event.button == 5:  # גלגלת למטה
                    self.camera.mouse_wheel(-1)
            elif event.type == MOUSEBUTTONUP:
                if event.button == 1:
                    self.camera.mouse_up()
            elif event.type == MOUSEMOTION:
                self.camera.mouse_motion(event.pos)

    # --------- אנימציית מהלך ---------

    def start_next_animation_if_needed(self):
        if self.anim_move is None and self.controller.queue:
            self.anim_move = self.controller.queue.pop(0)
            self.anim_elapsed = 0.0

    def advance_animation(self, dt_ms):
        if self.anim_move is None: return
        self.anim_elapsed += dt_ms
        t = clamp(self.anim_elapsed / self.anim_duration_ms, 0.0, 1.0)
        if t >= 1.0 - 1e-3:
            # השלם את המהלך בפועל (ה-state כבר יתעדכן)
            MOVE_FUNCS[self.anim_move](self.controller.state)
            self.controller.history.append(self.anim_move)
            self.anim_move = None
            self.anim_elapsed = 0.0

    def apply_animation_rotation(self):
        if self.anim_move is None: return
        # פשטות: מסובב את כל הקובייה סביב ציר כללי כדי לתת תחושת תנועה.
        axis_map = {
            'U': (0,1,0), "U'": (0,1,0), 'U2': (0,1,0),
            'D': (0,-1,0), "D'": (0,-1,0), 'D2': (0,-1,0),
            'R': (1,0,0), "R'": (1,0,0), 'R2': (1,0,0),
            'L': (-1,0,0), "L'": (-1,0,0), 'L2': (-1,0,0),
            'F': (0,0,1), "F'": (0,0,1), 'F2': (0,0,1),
            'B': (0,0,-1), "B'": (0,0,-1), 'B2': (0,0,-1),
        }
        ax = axis_map[self.anim_move]
        # יעד: 90 או 180 מעלות; כיוון לפי גרש
        target = 180.0 if self.anim_move.endswith("2") else 90.0
        sign = -1.0 if self.anim_move.endswith("'") else 1.0
        t = clamp(self.anim_elapsed / self.anim_duration_ms, 0.0, 1.0)
        ang = ease_in_out_quad(t) * target * sign
        glRotatef(ang, ax[0], ax[1], ax[2])

    # --------- לולאת הציור ---------

    def draw_scene(self, dt_ms):
        # רקע דו־ממדי
        self.draw_background_quad()

        # 3D
        glClear(GL_DEPTH_BUFFER_BIT)
        glPushMatrix()
        self.camera.apply()
        self.camera.update_auto(dt_ms)

        # צל/קרקע
        self.draw_ground_shadow()

        # חלקיקים
        for p in self.particles:
            if not p.alive:
                p.reset()
            p.update(dt_ms)
            p.draw()

        # תאורה מזויפת קלה (שינוי בהירות לפי זווית)
        glEnable(GL_POLYGON_OFFSET_FILL)
        glPolygonOffset(1.0, 1.0)

        # סיבוב אנימציית מהלך
        glPushMatrix()
        self.apply_animation_rotation()

        # ציור הקובייה
        draw_cube(self.controller.state)
        glPopMatrix()

        glDisable(GL_POLYGON_OFFSET_FILL)
        glPopMatrix()

        # HUD
        self.draw_hud(self.clock.get_fps())
        pygame.display.flip()

    # --------- ריצה ---------

    def run(self):
        while True:
            dt_ms = self.clock.tick(DEFAULT_FPS)
            self.last_dt = dt_ms
            self.process_input()
            self.start_next_animation_if_needed()
            self.advance_animation(dt_ms)
            self.draw_scene(dt_ms)

# ==========================
# main
# ==========================

def main():
    try:
        App().run()
    except Exception as e:
        # הדפסה ידידותית — בלי להפיל את חלון המסוף בשקט
        print("אירעה שגיאה:", e)
        try:
            pygame.quit()
        except Exception:
            pass

if __name__ == "__main__":
    main()
