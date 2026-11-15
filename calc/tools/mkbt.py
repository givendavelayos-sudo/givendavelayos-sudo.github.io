import sys, json, os
SP = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SP)
import lt
t = json.load(open(os.path.join(SP, 'testsbt.json')))
cat = json.load(open(os.path.join(SP, 'catbt.json')))
emu, blank, missing = {}, [], []
for k in t:
    p = os.path.join(SP, 'emu', k + '.png')
    if not os.path.exists(p): missing.append(k); continue
    g = lt.dots(k)
    s = ''.join(''.join(str(v) for v in r) for r in g)
    if '1' not in s: blank.append(k); continue
    emu[k] = s
out = {'tests': {k: t[k] for k in emu}, 'emu': emu, 'cat': {k: cat[k] for k in emu}}
dest = sys.argv[1]
json.dump(out, open(dest, 'w'))
json.dump(blank, open(os.path.join(SP, 'blankbt.json'), 'w'))
print('captured', len(emu), 'blank', len(blank), 'missing', len(missing))
