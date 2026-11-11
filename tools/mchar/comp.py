import json,sys
from PIL import Image
D=sys.argv[1];d=json.load(open(D+'/mc.json'));P=d['parts']
def pid(base,g):
    return base+'__'+g if base+'__'+g in P else (base if base in P else None)
def layers(C):
    g=C['gender'];L=[]
    bases=['body_'+C['skin'],'arms_'+C['skin'],'hands_'+C['skin'],'face_binh_thuong_'+C['eyes'],'hair_%s_%s_back'%(C['hair'],C['color']),'hair_%s_%s_front'%(C['hair'],C['color'])]
    for slot,b in d['sets'][C['outfit']]['parts'].items():
        if slot!='weapon':bases.append(b)
    for b in bases:
        p=pid(b,g)
        if not p:print('miss',b);continue
        e=P[p]
        if e.get('f'):L.append((tuple(e['key']),p,0))
        if e.get('s'):L.append((tuple(e['s']),p+'_s',0))
    w=pid(C['weapon'],g);L.append((tuple(P[w]['key']),w,1))
    L.sort(key=lambda t:t[0]);return L
C=dict(gender="nu", skin="sang", eyes="nau", hair="co_trang_nu", color="lam", outfit="du_hiep", weapon="kiem_bua")
L=layers(C);F=d['frame'];out=Image.new('RGBA',(F['w']*16,F['h']*2),(40,40,55,255))
for row,aid in enumerate(['di_phai','chem_phai']):
    a=[x for x in d['anims'] if x['id']==aid][0]
    for i in range(8):
        k=a['from']+i;x,y=(k%F['cols'])*F['w'],(k//F['cols'])*F['h']
        for key,p,isw in L:
            if isw and not a['combat']:continue
            im=Image.open(D+'/mc/'+p+'.png').crop((x,y,x+F['w'],y+F['h']));out.alpha_composite(im,(i*F['w']*2,row*F['h']))
        ref=Image.open('%s/../up/a/du_hiep_nu/%s_alpha.png'%(D,aid)).crop((i*256+24,16,i*256+24+208,16+236));out.alpha_composite(ref,(i*F['w']*2+F['w'],row*F['h']))
out.resize((out.width//2,out.height//2)).save(D+'/../cmp.png')
