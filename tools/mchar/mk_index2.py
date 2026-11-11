import json,sys,os
S=sys.argv[1]
d=json.load(open(S+'/mcout/mc.json'));m=json.load(open(S+'/up/b/manifest.json'))
parts={};R={}
for pid,e in d['parts'].items():
    j=S+'/mcout2/mc/'+pid+'.json'
    if not os.path.exists(j): print('missing',pid); continue
    n=json.load(open(j))
    if not n.get('f') and not n.get('s'):continue
    k=e['key'];sk=e.get('s') if n.get('s') else None
    if n.get('s') and not sk: sk=[2,17]
    parts[pid]=[k[0],k[1] if k[1] is not None else 0,1 if n.get('f') else 0]+(sk or [])
    enc=lambda rs:';'.join(','.join(map(str,r)) if r else '' for r in rs)
    if n.get('f'): R[pid]=enc(n['f'])
    if n.get('s'): R[pid+'_s']=enc(n['s'])
sets=[[o['id'],o['name_vi'],{k:v for k,v in d['sets'][o['id']]['parts'].items()},o['suggest']] for o in m['outfitSets']]
X={'fw':464,'fh':488,'k':2,
   'anims':[[a['id'],a['from'],a['n'],a['fps'],1 if a['loop'] else 0,1 if a['combat'] else 0] for a in d['anims']],
   'parts':parts,'sets':sets,
   'hair':[[h['id'],{'kiem_tien':'Kiếm tiên','thieu_nien':'Tóc rối','co_trang_nam':'Búi tó','co_trang_nu':'Song hoàn','bui':'Búi','duoi_ngua':'Đuôi ngựa','dai':'Dài thẳng'}.get(h['id'],h['name_vi'])] for h in m['hairStyles']],
   'hc':[[h['id'],h['name_vi'],h['hex']] for h in m['hairColors']],
   'eyes':[[h['id'],h['name_vi'],h['hex']] for h in m['eyeColors']],
   'skins':[[h['id'],h['name_vi'],h['hex']] for h in m['skins']],'r':R}
open(S+'/genw/mc_index.js','w').write('const MCX='+json.dumps(X,ensure_ascii=False,separators=(',',':'))+';\n')
print(len(parts),len(json.dumps(X)))
