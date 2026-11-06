#!/usr/bin/env python3
"""Bảo vệ bản phát hành: làm rối mã JavaScript, khóa tên miền và mã hóa ảnh cho các file đã build.

    python3 tools/protect/protect.py web/index.html web/img ...

- Đối số là file .html  -> làm rối mã + gài khóa tên miền + shim giải mã ảnh (tools/protect/obf.js).
- Đối số là thư mục     -> mã hóa (XOR) mọi ảnh *.png trong đó: tải thẳng về chỉ ra file rác,
                           không mở được; shim trong game tự giải mã khi chạy.

Chỉ chạy trên file/thư mục đã build (web/, android assets, server/public). Ảnh nguồn trong img/
không bị đụng tới, nên các thread khác vẫn thêm/sửa ảnh bình thường.
Đặt PROTECT=0 để bỏ qua (thử nghiệm nhanh trên máy).
"""
import os, pathlib, shutil, subprocess, sys

HERE = pathlib.Path(__file__).resolve().parent
KEY = (HERE / 'imgkey.txt').read_text(encoding='utf-8').strip().encode('ascii')
MARKER = '.gms-enc'  # đánh dấu thư mục ảnh đã mã hóa, tránh mã hóa hai lần


def _fnv(name):
    h = 2166136261
    for c in name.encode('utf-8'):
        h = (h ^ c) & 0xffffffff
        h = (h * 16777619) & 0xffffffff
    return h


def _xor(data, name):
    # Giống hệt hàm dec() trong obf.js (XOR nên mã hóa và giải mã là một)
    h = _fnv(name)
    L = len(KEY)
    out = bytearray(data)
    for i in range(len(out)):
        out[i] = out[i] ^ KEY[i % L] ^ ((h >> ((i & 3) * 8)) & 0xff) ^ ((i * 73) & 0xff)
    return bytes(out)


def encrypt_images(folder):
    folder = pathlib.Path(folder)
    if not folder.is_dir():
        return 0
    if (folder / MARKER).exists():
        print('ảnh đã mã hóa từ trước, bỏ qua:', folder)
        return 0
    n = 0
    for p in sorted(folder.glob('*.png')):
        p.write_bytes(_xor(p.read_bytes(), p.name))
        n += 1
    (folder / MARKER).write_text('1')
    print('đã mã hóa', n, 'ảnh:', folder)
    return n


def obfuscate_html(files):
    node, npm = shutil.which('node'), shutil.which('npm')
    if not node or not npm:
        sys.exit('protect: cần node + npm để làm rối mã (hoặc đặt PROTECT=0 để bỏ qua)')
    if not (HERE / 'node_modules' / 'javascript-obfuscator').exists():
        subprocess.run([npm, 'ci', '--no-audit', '--no-fund', '--silent'], cwd=HERE, check=True)
    subprocess.run([node, '--max-old-space-size=4096', str(HERE / 'obf.js'), *files], check=True)


def protect(args):
    if os.environ.get('PROTECT', '1') == '0':
        print('protect: PROTECT=0, bỏ qua')
        return
    htmls, dirs = [], []
    for a in args:
        p = pathlib.Path(a)
        (dirs if p.is_dir() else htmls).append(str(p.resolve()))
    if htmls:
        obfuscate_html(htmls)
    for d in dirs:
        encrypt_images(d)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    protect(sys.argv[1:])
