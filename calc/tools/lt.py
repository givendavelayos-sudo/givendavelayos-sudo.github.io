import sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pylib'))
from PIL import Image
EMU = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'emu')
def dots(name):
    im = Image.open(os.path.join(EMU, name + '.png')).convert('L'); p = im.load(); W, H = im.size
    return [[1 if p[1 + 2*i, 14 + 2*j] < 128 else 0 for i in range(105)] for j in range(32)]
def strip(name):
    im = Image.open(os.path.join(EMU, name + '.png')).convert('L'); p = im.load(); W, H = im.size
    return [[1 if p[x, y] < 128 else 0 for x in range(W)] for y in range(0, 14)]
def crop(g, r, c, h, w):
    return [''.join('#' if g[r+y][c+x] else '.' for x in range(w)) for y in range(h)]
def show(g, r0=0, r1=32, c0=0, c1=105):
    for j in range(r0, r1): print('%2d ' % j + ''.join('#' if v else '.' for v in g[j][c0:c1]))
