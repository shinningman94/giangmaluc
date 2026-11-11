import json, base64, io, sys
from PIL import Image
sys.path.insert(0, '.')
import scene
od='out3'; man=json.load(open(f'{od}/manifest.json',encoding='utf-8'))
def b64(path): return 'data:image/png;base64,'+base64.b64encode(open(path,'rb').read()).decode()
parts=[{'id':p['id'],'base':p['base'],'slot':p['slot'],'slot_vi':p['slot_vi'],'name':p['name_vi'],'layer':p['sortingLayer'],
        'li':p['sortingLayerIndex'],'order':p['orderInLayer'],'links':p.get('links') or [],'src':b64(f"{od}/{p['file']}"),
        **({'vsrc':b64(f"{od}/{p['viewSheet']}")} if p.get('viewSheet') else {})} for p in man['parts']]
bg=scene.background(); buf=io.BytesIO(); bg.save(buf,'PNG')
nm=lambda L:[{'id':x['id'],'name':x['name_vi'],**({'hex':x['hex']} if 'hex' in x else {})} for x in L]
data={'frame':man['frame'],'cols':man['sheet']['cols'],'frames':man['frames'],
      'anims':[{'id':a['id'],'name':a['name_vi'],'fps':a['fps'],'loop':a['loop'],'frames':a['frames']} for a in man['animations']],
      'poses':[{'id':p['id'],'name':p['name_vi'],'frame':p['frame']} for p in man['poses']],
      'parts':parts,'sets':[{'id':s['id'],'name':s['name_vi'],'parts':s['parts'],'suggest':s.get('suggest')} for s in man['outfitSets']],
      'skins':nm(man['skins']),'eyes':nm(man['eyeColors']),'expressions':nm(man['expressions']),'hairStyles':nm(man['hairStyles']),'hairColors':nm(man['hairColors']),
      'sceneBg':'data:image/png;base64,'+base64.b64encode(buf.getvalue()).decode()}
t=open('preview3_template.html',encoding='utf-8').read()
t=t.replace('__SPEC__',f"Nam / Nữ · 9 biểu cảm<br>xoay 360° (8 hướng) · 6 tư thế · 6 hoạt ảnh<br>{len(man['outfitSets'])} bộ cổ trang · sheet 8×4 khung 128×256")
open('tu-do-nhan-vat.html','w',encoding='utf-8').write(t.replace('/*DATA*/null',json.dumps(data,ensure_ascii=False)))
print(len(parts))
