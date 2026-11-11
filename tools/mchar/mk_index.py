import json,sys
S=sys.argv[1]
d=json.load(open(S+'/mcout/mc.json'));m=json.load(open(S+'/up/b/manifest.json'))
F=d['frame']
parts={}
for pid,e in d['parts'].items():
    if not e.get('f') and not e.get('s'):continue
    k=e['key'];parts[pid]=[k[0],k[1] if k[1] is not None else 0,1 if e.get('f') else 0]+(e['s'] if e.get('s') else [])
sets=[[o['id'],o['name_vi'],{k:v for k,v in d['sets'][o['id']]['parts'].items()},o['suggest']] for o in m['outfitSets']]
X={'fw':F['w'],'fh':F['h'],'cols':F['cols'],
   'anims':[[a['id'],a['from'],a['n'],a['fps'],1 if a['loop'] else 0,1 if a['combat'] else 0] for a in d['anims']],
   'parts':parts,'sets':sets,
   'hair':[[h['id'],{'kiem_tien':'Kiếm tiên','thieu_nien':'Tóc rối','co_trang_nam':'Búi tó','co_trang_nu':'Song hoàn','bui':'Búi','duoi_ngua':'Đuôi ngựa','dai':'Dài thẳng'}.get(h['id'],h['name_vi'])] for h in m['hairStyles']],
   'hc':[[h['id'],h['name_vi'],h['hex']] for h in m['hairColors']],
   'eyes':[[h['id'],h['name_vi'],h['hex']] for h in m['eyeColors']],
   'skins':[[h['id'],h['name_vi'],h['hex']] for h in m['skins']]}
open(S+'/genw/mc_index.js','w').write('const MCX='+json.dumps(X,ensure_ascii=False,separators=(',',':'))+';\n')
print(len(json.dumps(X)))
