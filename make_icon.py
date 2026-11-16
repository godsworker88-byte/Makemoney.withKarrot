from PIL import Image, ImageDraw
import math

INK=(38,34,32)      # #262220 charcoal
CREAM=(242,237,228) # #f2ede4

def rounded_mask(size, rad):
    m=Image.new('L',(size,size),0)
    d=ImageDraw.Draw(m)
    d.rounded_rectangle([0,0,size-1,size-1], radius=rad, fill=255)
    return m

def draw_icon(size):
    S=1024  # supersample
    img=Image.new('RGB',(S,S),INK)
    d=ImageDraw.Draw(img)
    cx=S//2
    w=int(S*0.055)          # stroke width
    # scale helper
    sc=S/512.0
    apex=(cx, int(205*sc))
    lsh=(int(150*sc), int(312*sc))
    rsh=(int(362*sc), int(312*sc))
    def line(a,b):
        d.line([a,b], fill=CREAM, width=w)
        r=w//2
        for p in (a,b):
            d.ellipse([p[0]-r,p[1]-r,p[0]+r,p[1]+r], fill=CREAM)
    # shoulders + bottom bar (hanger body)
    line(apex,lsh); line(apex,rsh); line(lsh,rsh)
    # neck + hook
    neck_top=(cx, int(176*sc))
    line(apex, neck_top)
    # hook: arc of a circle, open to the lower-left
    hr=int(30*sc); hc=(cx+hr, int(176*sc))
    bbox=[hc[0]-hr,hc[1]-hr,hc[0]+hr,hc[1]+hr]
    d.arc(bbox, start=90, end=330, fill=CREAM, width=w)
    # round the hook's lower end cap
    ex=hc[0]+hr*math.cos(math.radians(90)); ey=hc[1]+hr*math.sin(math.radians(90))
    r=w//2; d.ellipse([ex-r,ey-r,ex+r,ey+r], fill=CREAM)
    # downscale with rounded corners
    img=img.resize((size,size), Image.LANCZOS)
    mask=rounded_mask(size, int(size*0.22))
    out=Image.new('RGBA',(size,size),(0,0,0,0))
    out.paste(img,(0,0),mask)
    return out

for sz in (192,512):
    draw_icon(sz).save(f'icon-{sz}.png')
# maskable (full-bleed ink bg, no rounded corners, content in safe zone already ~60%)
def draw_maskable(size):
    im=draw_icon(size).convert('RGBA')
    bg=Image.new('RGBA',(size,size),INK+(255,))
    bg.paste(im,(0,0),im)
    return bg
draw_maskable(512).save('icon-512-maskable.png')
print('icons written')
