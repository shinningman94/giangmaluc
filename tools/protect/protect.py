#!/usr/bin/env python3
"""Bảo vệ bản phát hành: làm rối mã JavaScript và khóa tên miền cho các file html đã build.

    python3 tools/protect/protect.py web/index.html server/public/index.html ...

Chỉ chạy trên file đã build (web/, android assets, server/public). File nguồn vua-phap-su.html
không bao giờ bị đụng tới, nên các thread khác vẫn sửa game bình thường.
Đặt PROTECT=0 để bỏ qua (thử nghiệm nhanh trên máy).
"""
import os, pathlib, shutil, subprocess, sys

HERE = pathlib.Path(__file__).resolve().parent


def protect(files):
    files = [str(pathlib.Path(f).resolve()) for f in files]
    if os.environ.get('PROTECT', '1') == '0':
        print('protect: PROTECT=0, bỏ qua')
        return
    node, npm = shutil.which('node'), shutil.which('npm')
    if not node or not npm:
        sys.exit('protect: cần node + npm để làm rối mã (hoặc đặt PROTECT=0 để bỏ qua)')
    if not (HERE / 'node_modules' / 'javascript-obfuscator').exists():
        subprocess.run([npm, 'ci', '--no-audit', '--no-fund', '--silent'], cwd=HERE, check=True)
    subprocess.run([node, '--max-old-space-size=4096', str(HERE / 'obf.js'), *files], check=True)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    protect(sys.argv[1:])
