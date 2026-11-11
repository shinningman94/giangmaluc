"""swap the inserted mc block (const MCX=... through window.__mc=...;) for new mc_index.js + mchar.js. swap_mc.py in out dir"""
import sys
src=open(sys.argv[1],encoding='utf-8').read(); D=sys.argv[3]
a=src.index('const MCX='); b=src.index('window.__mc={',a); b=src.index('\n',b)+1
mod=open(D+'/mc_index.js',encoding='utf-8').read()+open(D+'/mchar.js',encoding='utf-8').read()
if not mod.endswith('\n'): mod+='\n'
open(sys.argv[2],'w',encoding='utf-8').write(src[:a]+mod+src[b:])
print('ok',b-a,len(mod))
