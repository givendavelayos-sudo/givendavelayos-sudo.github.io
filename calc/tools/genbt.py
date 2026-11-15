import json, random
R = random.Random(20261115)
T = {}   # name -> keys
CAT = {} # name -> category
cnt = {}

def add(cat, keys):
    cnt[cat] = cnt.get(cat, 0) + 1
    n = 'bt_%s_%d' % (cat, cnt[cat])
    T[n] = ' '.join(keys.split())
    CAT[n] = cat

def num(v):
    s = ('%g' % v) if not isinstance(v, str) else v
    neg = s.startswith('-')
    s = s.lstrip('-')
    ks = []
    for ch in s:
        ks.append('dot' if ch == '.' else ch)
    return ('neg ' if neg else '') + ' '.join(ks)

def rint(a, b): return R.randint(a, b)
def rdec(a, b, d=None):
    d = d if d is not None else R.choice([1, 2, 3])
    return round(R.uniform(a, b), d)
def rnum(a=1, b=999):
    return rint(a, b) if R.random() < 0.5 else rdec(a, b)

OPS = ['add', 'sub', 'mul', 'div']

# 1 arithmetic
for _ in range(50):
    k = rint(2, 4)
    parts = [num(rnum())]
    for _ in range(k - 1):
        parts += [R.choice(OPS), num(rnum())]
    if R.random() < 0.3 and len(parts) >= 3:
        parts = ['lp'] + parts[:3] + ['rp'] + parts[3:]
    add('arith', ' '.join(parts) + ' eq')

# 2 trig (degrees)
for f in ['sin', 'cos', 'tan']:
    for _ in range(17):
        v = rint(-720, 720) if R.random() < 0.5 else rdec(-360, 360)
        if f == 'tan' and v % 90 == 0 and (v // 90) % 2: v += 1
        add('trig', '%s %s eq' % (f, num(v)))

# 3 inverse trig
for f in ['sin', 'cos', 'tan']:
    for _ in range(12):
        v = rdec(-1, 1, 3) if f != 'tan' else rdec(-50, 50)
        add('invtrig', 'shift %s %s eq' % (f, num(v)))

# 4 hyperbolic
for m in range(1, 7):
    for _ in range(6):
        v = rdec(-3, 3) if m in (1, 2, 3) else (rdec(1.01, 20) if m == 5 else rdec(-0.99, 0.99, 3) if m == 6 else rdec(-20, 20))
        add('hyp', 'hyp %d %s eq' % (m, num(v)))

# 5 log / ln / exp
for _ in range(12): add('log', 'log %s eq' % num(rnum(1, 999) if R.random() < .5 else rdec(0.001, 5, 3)))
for _ in range(12): add('log', 'ln %s eq' % num(rnum(1, 999) if R.random() < .5 else rdec(0.001, 5, 3)))
for _ in range(12): add('exp', 'shift log %s eq' % num(rdec(-5, 8)))
for _ in range(12): add('exp', 'shift ln %s eq' % num(rdec(-10, 12)))

# 6 powers and roots
for _ in range(10): add('pow', 'sqrt %s eq' % num(rnum(1, 999)))
for _ in range(8): add('pow', '%s sq eq' % num(rdec(-99, 99)))
for _ in range(8): add('pow', '%s shift sq eq' % num(rdec(-30, 30)))
for _ in range(8): add('pow', 'shift sqrt %s eq' % num(rdec(-500, 500)))
for _ in range(8): add('pow', '%s pow %s eq' % (num(rdec(0.5, 20)), num(rdec(-4, 6, 2))))
for _ in range(6): add('pow', '%s inv eq' % num(rnum(1, 999)))

# 7 factorial / permutations / combinations
for _ in range(12): add('comb', '%s shift inv eq' % num(rint(0, 69)))
for _ in range(12):
    n = rint(2, 40); r = rint(0, n)
    add('comb', '%s shift mul %s eq' % (num(n), num(r)))
for _ in range(12):
    n = rint(2, 40); r = rint(0, n)
    add('comb', '%s shift div %s eq' % (num(n), num(r)))

# 8 polar / rectangular
for _ in range(12): add('polrec', 'shift add %s shift rp %s rp eq' % (num(rdec(-30, 30, 1)), num(rdec(-30, 30, 1))))
for _ in range(12): add('polrec', 'shift sub %s shift rp %s rp eq' % (num(rdec(0.5, 30, 1)), num(rdec(-180, 180, 1))))

# 9 fractions
for _ in range(36):
    a, b, c, d = rint(1, 20), rint(2, 20), rint(1, 20), rint(2, 20)
    add('frac', '%s frac %s right %s %s frac %s eq' % (num(a), num(b), R.choice(OPS), num(c), num(d)))

# 10 integrals
INT = [('alpha rp', 'X', 0, 4), ('alpha rp sq', 'X2', 0, 4), ('alpha rp shift sq', 'X3', 0, 3),
       ('sin alpha rp rp', 'sin', 0, 180), ('cos alpha rp rp', 'cos', 0, 180), ('ln alpha rp rp', 'ln', 1, 6)]
for _ in range(30):
    f, nm, lo0, hi0 = R.choice(INT)
    lo = rint(lo0, hi0 - 1) if hi0 - lo0 > 1 else lo0
    hi = rint(lo + 1, hi0)
    if nm in ('sin', 'cos'): lo = rint(0, 17) * 10; hi = lo + rint(1, 10) * 10
    add('integ', 'integ %s right %s right %s eq' % (f, num(lo), num(hi)))

# 11 derivatives
for _ in range(20):
    f, nm, lo0, hi0 = R.choice(INT)
    x0 = rint(1, 4) if nm not in ('sin', 'cos') else rint(0, 18) * 10
    add('diff', 'shift integ %s right %s eq' % (f, num(x0)))

# 12 unit conversions
CATS = [9, 7, 2, 5, 5, 2, 4, 2]
for _ in range(40):
    c = R.randrange(8); n = CATS[c]
    i = R.randrange(n); j = R.choice([x for x in range(n) if x != i])
    add('conv', '%s conv %s%seq %seq eq' % (num(rnum(1, 500)), 'down ' * c, 'right ' * i, 'right ' * ((j - i) % n)))

# 13 equations
def coefs(n, lo=-9, hi=9):
    out = []
    for _ in range(n):
        v = rint(lo, hi)
        out.append(num(v) + ' eq')
    return ' '.join(out)
for _ in range(24):
    a = rint(1, 9) * R.choice([1, -1])
    add('eqn', 'mode 5 down 1 %s %s%s' % (coefs(1, 1, 9) if a > 0 else 'neg ' + str(abs(a)) + ' eq', coefs(2), ' eq' * R.choice([1, 2])))
for _ in range(12):
    add('eqn', 'mode 5 down 2 %s eq%s' % (coefs(4, -9, 9).replace(' eq', ' eq', 1), ' eq' * R.choice([1, 2, 3])))
for _ in range(12):
    add('eqn', 'mode 5 1 %s eq%s' % (coefs(6), ' eq' * R.choice([0, 1])))
for _ in range(8):
    add('eqn', 'mode 5 2 %s eq%s' % (coefs(12), ' eq' * R.choice([0, 1, 2])))

# 14 STAT regression
TYPES = {'lin': 2, 'quad': 3, 'log': 4, 'eexp': 5, 'abexp': 6, 'pwr': 7, 'inv': 8}
for _ in range(35):
    tn = R.choice(list(TYPES))
    n = 5
    xs = R.sample(range(1, 10), n)
    ys = [rint(1, 20) for _ in range(n)]
    xk = ' '.join('%s eq' % num(x) for x in xs)
    yk = ' '.join('%s eq' % num(y) for y in ys)
    k = R.choice([1, 2, 3])
    add('statreg', 'mode 3 %d %s right up up up up up %s ac apps 8 %d eq' % (TYPES[tn], xk, yk, k))
for _ in range(12):
    n = rint(4, 7)
    xs = [rint(1, 99) for _ in range(n)]
    xk = ' '.join('%s eq' % num(x) for x in xs)
    add('stat1', 'mode 3 1 1 %s ac apps 5 %d eq' % (xk, R.choice([1, 2, 3, 4])))

# 15 matrices
def mats(): return ' '.join('%s eq' % num(rint(-9, 9)) for _ in range(4))
for _ in range(12):
    op = R.choice(['apps down 1 apps 3 eq', 'apps 3 mul apps 3 eq', 'apps 3 add apps 3 eq', 'apps 3 inv eq'])
    add('matrix', 'mode 7 1 down down 3 %s ac %s' % (mats(), op))

# 16 complex
def cx(): return 'lp %s %s %s eng rp' % (num(rint(-9, 9)), R.choice(['add', 'sub']), num(rint(1, 9)))
for _ in range(14): add('cplx', 'mode 2 %s %s %s eq' % (cx(), R.choice(['mul', 'div', 'add', 'sub']), cx()))
for _ in range(5): add('cplx', 'mode 2 abs %s eq' % cx())
for _ in range(5): add('cplx', 'mode 2 sqrt neg %s eq' % num(rint(1, 50)))

# 17 mixed expressions
PIECE = [lambda: 'sin %s rp' % num(rint(1, 89)), lambda: 'cos %s rp' % num(rint(1, 89)),
         lambda: 'tan %s rp' % num(rint(1, 80)), lambda: 'ln %s rp' % num(rint(2, 99)),
         lambda: 'log %s rp' % num(rint(2, 999)), lambda: 'sqrt %s right' % num(rint(2, 99)),
         lambda: '%s sq' % num(rint(2, 30)), lambda: num(rnum(1, 99))]
for _ in range(40):
    k = rint(2, 4)
    parts = [R.choice(PIECE)()]
    for _ in range(k - 1):
        parts += [R.choice(OPS), R.choice(PIECE)()]
    add('mixed', ' '.join(parts) + ' eq')

PRE = 'on ac ac shift 9 3 eq ac ac '
json.dump(T, open('testsbt.json', 'w'))
json.dump(CAT, open('catbt.json', 'w'))
names = list(T)
# chunk files of 20 tests
for ci in range(0, len(names), 20):
    chunk = names[ci:ci + 20]
    open('specbt_%02d.txt' % (ci // 20), 'w').write('; '.join('%s=%s%s' % (n, PRE, T[n]) for n in chunk))
print(len(T), cnt)
