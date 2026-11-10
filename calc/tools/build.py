# Builds calc/lcddata.js from emulator LCD captures in emu/.
import json, sys
from lt import dots, strip

OUT = sys.argv[1]
W, H = 105, 32

def rowbits(g, r, c, w):
    return [sum((1 << (w - 1 - x)) if g[r + y][c + x] else 0 for x in range(w)) for y in range(len(r) if isinstance(r, list) else 1)]

def cell(g, r, c, h, w=6):
    out = []
    for y in range(h):
        v = 0
        for x in range(w):
            if 0 <= c + x < W and 0 <= r + y < H and g[r + y][c + x]: v |= 1 << (w - 1 - x)
        out.append(v)
    return out

def best_col0(g, r, h, text, lo, hi):
    """Pick the text start column whose gap columns (6k+5) are emptiest."""
    best = None
    for c0 in range(lo, hi + 1):
        bad = 0
        for k in range(len(text)):
            x = c0 + 6 * k + 5
            if 0 <= x < W: bad += sum(g[r + y][x] for y in range(h))
            x = c0 + 6 * k - 1
            if k == 0 and 0 <= x < W: bad += sum(g[r + y][x] for y in range(h))
        if best is None or bad < best[0]: best = (bad, c0)
    return best[1]

def first_dark(g, r, h, c=0):
    for x in range(c, W):
        if any(g[r + y][x] for y in range(h)): return x
    return None

def extract(font, sources, h, fixed=None):
    clash = []
    for img, r, text, *rest in sources:
        g = dots(img)
        start = rest[0] if rest else 0
        cursor_end = text.endswith('|')
        if cursor_end: text = text[:-1]
        if rest: c0 = rest[0]
        elif fixed is not None: c0 = fixed
        else:
            fd = first_dark(g, r, h, start)
            c0 = best_col0(g, r, h, text, fd - 4, fd)
        for k, ch in enumerate(text):
            if ch == ' ': continue
            gl = cell(g, r, c0 + 6 * k, h)
            if cursor_end and k == len(text) - 1: gl = [v & ~1 for v in gl]
            if ch in font and font[ch] != gl: clash.append((ch, img)); continue
            font[ch] = gl
    return clash

# ---- big 5x9 font (input/result lines). '|' at end = cursor follows (drop gap col)
F9 = {}
c = extract(F9, [
    ('t02', 0, '0.1234'), ('t07', 0, '123456789×1000'), ('L1', 0, '456789.+-×÷|'),
    ('L4', 0, 'sin(cos(tan(|'), ('L8', 0, 'ABCDEFXYM|'), ('t13', 0, '5ℙ2'), ('L10', 0, 'i~Rand(ℙℂ°|'),
    ('x1', 0, 'Mod(−23,5'), ('x2', 0, 'Q…r(35,10'), ('x3', 0, 'Max(3,sin(30),c⊳'), ('x7', 0, 'LCM(15,27,39'),
    ('x8', 0, 'Round(1÷3'), ('x9', 0, 'sinh(2.5'), ('x12', 0, '5!'), ('t14', 0, 'Pol(3,4)'), ('i2', 0, 'AnsM+'),
    ('f2', 0, 'LCM(GCD(|'), ('t12', 0, '1°30°'), ('z6', 0, 'Arg(Conjg(Real(|'), ('z7', 0, 'Imag(▶r∠θ▶a+bⅈ|'),
    ('z4', 0, '2+3ⅈ|'), ('L13', 0, '=:'), ('q1', 0, 'Det(Trn(Ide(|'), ('q2', 0, 'Adj(Inv(MatAns|'),
    ('q3', 0, 'VctA▪VctAns|'), ('q4', 0, 'andorxorxnor|'), ('q5', 0, 'Not(Neg(dhbo|'), ('q8', 0, 'minXmaxXP(|'),
    ('t24c', 0, 'Start?'), ('t24d', 0, 'End?'), ('t24e', 0, 'Step?'), ('t24a', 0, 'f(X)=|'),
    ('t14', 21, 'r=5,θ=53.130102▶'), ('q7', 0, ''), ('q6', 0, 'Σ'), ('L2', 2, 'Ansᴇπℯ%!', 14), ('L2', 2, '⊲', 6),
    ('t25a', 0, '12'),
], 9, fixed=6)
print('F9 clashes', c, file=sys.stderr)
g = dots('t12')
fd = first_dark(g, 21, 9, 40); c0 = best_col0(g, 21, 9, "1°30'0\"", fd - 4, fd)
for k, ch in enumerate("1º30'0\""): F9.setdefault(ch, cell(g, 21, c0 + 6 * k, 9))

# ---- small 5x6 font (menus, fractions, exponents); 8 rows incl. descender
S = lambda img, rows, *segs: [(img, r, t, st) for r, (t, st) in zip(rows, segs)]
F6 = {}
src6 = []
def menu(img, lines):
    for i, line in enumerate(lines):
        if line is None: continue
        if isinstance(line, tuple): line = line[0].ljust(8) + line[1]
        src6.append((img, 8 * i, line))
menu('m15a', [('1:COMP', '2:CPLX'), ('3:STAT', '4:BASE'), ('5:EQN', '6:TABLE'), ('7:MATX', '8:VCTR')])
menu('m16a', [('1:Maths', '2:Line'), ('3:Deg', '4:Rad'), ('5:Gra', '6:Fix'), ('7:Sci', '8:Norm')])
menu('m16b', [('1:ab/c', '2:d/c'), ('3:CPLX', '4:STAT'), '5:Disp'])
menu('t20a', [('1:SD', '2:Lin'), ('3:Quad', '4:Log'), None, ('7:Pwr', '8:Inv')])
menu('t21a', ['1:2 unknown EQN', '2:3 unknown EQN', '3:4 unknown EQN'])
menu('t21b', ['1:Quad  EQN', '2:Cubic EQN', '3:Quart EQN'])
menu('y13', [('1:Type', '2:Data'), ('3:Edit', '4:S-SUM'), ('5:S-VAR', '6:S-PTS'), ('7:Distr', '8:Reg')])
menu('y1', [('1:Dim', '2:Data'), ('3:MatA', '4:MatB'), ('5:MatC', '6:MatD'), '7:MatAns'])
menu('y2', [('1:Det', '2:Trn'), ('3:Ide', '4:AdJ'), '5:Inv'])
menu('y9', [('1:and', '2:or'), ('3:xor', '4:xnor'), ('5:Not', '6:Neg')])
menu('y10', [('1:d', '2:h'), ('3:b', '4:o')])
menu('n15', [None, ('3:med', '4:mode'), ('5:Q1', '6:Q3'), '7:R'])
menu('t26b', [None, ('3:Arg', '4:Conjg'), ('5:Real', '6:Imag')])
menu('t28', ['Clear?', '1:Setup 2:Memory', '3:All'])
menu('n9', ['Clear Memory?'])
menu('n10', ['Reset All?'])
menu('n8', ['Clear Setup?'])
menu('t09', ['Syntax ERROR', None, None, None])
menu('t10', ['Math ERROR'])
menu('n4', ['Complex Result?'])
menu('n5', ['Frequency?', ('1:ON', '2:OFF')])
menu('n6', ['Decimal Point?', ('1:Dot', '2:Comma')])
menu('n7', ['CONTRAST', None, 'LIGHT'])
menu('n1', ['Fix 0~9?']); menu('n2', ['Sci 0~9?']); menu('n3', ['Norm 1~2?'])
menu('n17', ['MatA(m×n) m×n?', ('1:4×4', '2:4×3'), ('3:4×2', '4:4×1')])
menu('n21', ['VctA(m) m?', ('1:3', '2:2')])
menu('i11', ['Vector?', ('1:VctA', '2:VctB'), ('3:VctC', '4:VctD')])
menu('t23a', ['Matrix?'])
menu('y21', [('1:Ins', '2:Del-A')])
c = extract(F6, src6, 8, fixed=6)
print('F6 clashes', c, file=sys.stderr)
# fraction digits (results) — rows 15 / 24 in t02, t08
for img, r, t, st in [('t02', 15, '617', 70), ('t02', 24, '5000', 70), ('t08', 24, '1000', 70), ('t11b', 19, '3', 60)]:
    extract(F6, [(img, r, t, st)], 6)
# F5 digits for the C-VALUE item number (cols 84 and 90, rows 0-4)
F5 = {}
for n in range(1, 80):
    gg = dots('c%02d' % n); s = '%02d' % n
    for k, ch in enumerate(s): F5.setdefault(ch, cell(gg, 0, 84 + 6 * k, 5))

# ---- static screens (dots only)
SCREENS = dict(mode='m15a', setup1='m16a', setup2='m16b', apps_COMP='m17a', hyp='L6', clr='t28', fix='n1', sci='n2',
               norm='n3', cplxSet='n4', freqSet='n5', dispSet='n6', contrast='n7', clrSetup='n8', clrMem='n9',
               clrAll='n10', complete='i9', drg='n11', statType='t20a', apps_STAT_SD='n12', apps_STAT='y13',
               sum_SD='n13', sum='y15', var_SD='n14', var='y16', pts_SD='n15', pts='y17', distr='y18', reg='y19',
               reg_Quad='n16', statEdit='y21', eqn1='t21a', eqn2='t21b', apps_MATX1='y1', apps_MATX2='y2',
               matPick='t23a', apps_VCTR='y7', vecPick='i11', apps_CPLX='t26b', apps_BASE1='y9', apps_BASE2='y10',
               synErr='t09', mathErr='t10')
def pack(g, r0=0, r1=H):
    return ''.join('%027x' % int(''.join('1' if v else '0' for v in g[r]) + '000', 2) for r in range(r0, r1))
scr = {k: pack(dots(v)) for k, v in SCREENS.items()}

# ---- indicator icons from the 1px strip (rows 1..12, x in px)
ICONS = {}
def icon(name, img, x0, x1):
    s = strip(img)
    ICONS[name] = [x0, x1 - x0 + 1, [int(''.join('1' if s[y][x] else '0' for x in range(x0, x1 + 1)), 2) for y in range(1, 13)]]
for a in [('S', 't27', 1, 7), ('A', 'ia', 8, 14), ('M', 'i2', 16, 22), ('STO', 'i3', 26, 38), ('RCL', 'i4', 41, 54),
          ('STAT', 'y12', 58, 76), ('CPLX', 't26', 59, 77), ('MATX', 't23d', 67, 89), ('VCTR', 'i11b', 72, 89),
          ('EQN', 't22b', 75, 90), ('D', 'lcd0', 93, 99), ('R', 'i5', 100, 106), ('G', 'i6', 107, 113),
          ('FIX', 'i7', 114, 125), ('SCI', 'i8', 128, 138), ('LINE', 't20c', 142, 158), ('up', 't01a', 180, 194),
          ('down', 'm16a', 180, 194), ('updown', 'm18a', 180, 194), ('Disp', 'i10', 195, 211)]:
    icon(*a)

# ---- C-VALUE pages: symbol band rows 8..16, and underline x-range per item
starts = [1, 6, 12, 16, 21, 27, 32, 37, 42, 46, 51, 55, 60, 64, 68, 72, 76, 80]
def uline(g, r):
    cs = [i for i in range(W) if g[r][i]]
    return [min(cs), max(cs)] if cs else None
kp = []
for p in range(17):
    g = dots('c%02d' % starts[p])
    rows = [list(r) for r in g[8:17]]
    items = [uline(dots('c%02d' % n), 17) for n in range(starts[p], starts[p + 1])]
    kp.append({'bits': pack(g, 8, 17), 'items': items})
gk = dots('k01')
ktitle = pack([[v if x < 80 else 0 for x, v in enumerate(r)] for r in gk], 0, 7)

# ---- CONVT pages: title rows 0..6, units rows 10..30, words found by gaps of 3+ blank columns
def words(g, r0, r1):
    out, x = [], 0
    cols = [any(g[y][i] for y in range(r0, r1)) for i in range(W)]
    while x < W:
        if not cols[x]: x += 1; continue
        e = x
        while e < W and (cols[e] or any(cols[e:e + 3])): e += 1
        out.append([x, e - 1]); x = e
    return out
up = []
for i in range(1, 9):
    g = dots('u%d' % i)
    items = [[0] + w for w in words(g, 10, 16)] + [[1] + w for w in words(g, 21, 27)]
    up.append({'title': pack(g, 0, 7), 'units': pack(g, 10, 31), 'items': items})

X10 = cell(dots('t06'), 25, 78, 5, 11)
FXL = cell(dots('t24a'), 0, 6, 9, 30)             # "f(X)=" label of TABLE mode
gq = dots('t22a'); EQH = {}
for ch, (a, z) in zip('abc', [w for w in words(gq, 0, 5) if w[0] > 15]):
    EQH[ch] = [a, cell(gq, 0, a, 5, z - a + 1), z - a + 1]  # EQN column headers
js = '// Generated from Canon emulator captures by build.py — dot data for the pixel LCD.\n'
js += 'export const F9 = ' + json.dumps(F9, ensure_ascii=False, separators=(',', ':')) + ';\n'
js += 'export const F6 = ' + json.dumps(F6, ensure_ascii=False, separators=(',', ':')) + ';\n'
js += 'export const FXL = ' + json.dumps(FXL) + ';\n'
js += 'export const EQH = ' + json.dumps(EQH) + ';\n'
js += 'export const X10 = ' + json.dumps(X10) + ';\n'
F4 = {}
for img, t in [('n18', 'MatA:4X3'), ('n22', 'VctA:2')]:
    g4 = dots(img); fd = first_dark(g4, 0, 4); c0 = best_col0(g4, 0, 4, t, fd - 4, fd)
    for k, ch in enumerate(t): F4.setdefault(ch, cell(g4, 0, c0 + 6 * k, 4))
js += 'export const F4 = ' + json.dumps(F4) + ';\n'
js += 'export const FXH = ' + json.dumps(cell(dots('t24f'), 0, 47, 5, 18)) + ';\n'
js += 'export const X10N = ' + json.dumps(cell(dots('c01'), 25, 78, 5, 11)) + ';\n'
js += 'export const F5 = ' + json.dumps(F5, separators=(',', ':')) + ';\n'
js += 'export const SCREENS = ' + json.dumps(scr, separators=(',', ':')) + ';\n'
js += 'export const ICONS = ' + json.dumps(ICONS, separators=(',', ':')) + ';\n'
js += 'export const KPAGES = ' + json.dumps(kp, separators=(',', ':')) + ';\n'
js += 'export const KTITLE = ' + json.dumps(ktitle) + ';\n'
js += 'export const UPAGES = ' + json.dumps(up, separators=(',', ':')) + ';\n'
open(OUT, 'w', encoding='utf-8').write(js)
print('F9', ''.join(sorted(F9)), file=sys.stderr)
print('F6', ''.join(sorted(F6)), file=sys.stderr)
print('bytes', len(js.encode()), file=sys.stderr)
