// Làm rối mã (obfuscate) các <script> lớn trong file html và gài khóa tên miền vào bên trong.
// Gọi qua protect.py:  node obf.js <file.html> [...]
// Biến môi trường:
//   PROTECT_HOSTS  thêm tên miền được phép chạy game (cách nhau bởi dấu phẩy), ví dụ "mygame.vn,www.mygame.vn"
//   PROTECT_SEED   số cố định để bản build lặp lại y hệt (mặc định ngẫu nhiên mỗi lần build)
'use strict';
const fs = require('fs');
const O = require('javascript-obfuscator');

// Nơi bản chính thức được phép chạy. Bản sao đặt ở tên miền khác (hoặc lưu file về máy mở bằng file://)
// sẽ chỉ hiện thông báo và không chạy game. App Android chạy từ file:// nên được nhận ra qua AndroidApp.pkg().
const HOSTS = ['game.giangmaluc.workers.dev', 'shinningman94.github.io', 'localhost', '127.0.0.1']
  .concat((process.env.PROTECT_HOSTS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
const SUFFIX = ['.giangmaluc.workers.dev']; // bản xem trước của nhánh trên Cloudflare
const PKG = 'vn.vuaphapsu.game';
const HOME = 'https://game.giangmaluc.workers.dev';

const LOCK = `(function(){
var H=${JSON.stringify(HOSTS)},S=${JSON.stringify(SUFFIX)};
function ok(){try{var l=window.location,h=(l.hostname||'').toLowerCase();
if(l.protocol==='file:'){var a=window.AndroidApp;return !!(a&&a.pkg&&a.pkg()===${JSON.stringify(PKG)});}
if(H.indexOf(h)>=0)return true;for(var i=0;i<S.length;i++)if(h.length>S[i].length&&h.slice(-S[i].length)===S[i])return true;
return false;}catch(e){return false;}}
function no(){try{document.documentElement.innerHTML='<body style="margin:0;background:#120d18;color:#eee;font:20px sans-serif;text-align:center;padding:48px 16px">Đây là bản sao trái phép của <b>Giáng Ma Sư</b>.<br><br>Hãy chơi bản chính thức tại<br><a style="color:#f6c" href="${HOME}">${HOME.replace('https://', '')}</a></body>';}catch(e){}}
if(!ok()){no();throw new Error('');}
setTimeout(function(){if(!ok()){no();location.replace(${JSON.stringify(HOME)});}},45000+Math.random()*60000);
})();
`;

const OPTS = {
  compact: true,
  simplify: true,
  target: 'browser',
  identifierNamesGenerator: 'mangled-shuffled',
  renameGlobals: true,          // đổi cả tên hàm/biến toàn cục (G, B, drawBattle... thành tên vô nghĩa)
  stringArray: true,            // gom chuỗi vào một mảng xáo trộn, mã gọi qua chỉ số
  stringArrayThreshold: 1,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayIndexShift: true,
  stringArrayWrappersCount: 1,
  stringArrayWrappersType: 'variable',
  stringArrayEncoding: [],      // base64/rc4 làm game chậm gấp đôi (đã đo), nên không dùng
  controlFlowFlattening: false, // các lựa chọn dưới làm chậm vòng lặp game, tắt
  deadCodeInjection: false,
  selfDefending: false,
  debugProtection: false,
  transformObjectKeys: false,
  unicodeEscapeSequence: false,
  sourceMap: false,
  seed: +(process.env.PROTECT_SEED || 0),
};

const BANNER = '/* Giáng Ma Sư (c) shinningman94. Bản quyền thuộc về tác giả. Cấm sao chép, sửa đổi hoặc phát hành lại khi chưa được cho phép. */\n';
const MIN = 20000; // chỉ làm rối script của game, bỏ qua mấy dòng nhỏ như đăng ký service worker

for (const file of process.argv.slice(2)) {
  let html = fs.readFileSync(file, 'utf8');
  if (html.includes('Giáng Ma Sư (c) shinningman94')) { console.log('đã bảo vệ từ trước, bỏ qua:', file); continue; }
  const re = /<script>([\s\S]*?)<\/script>/g;
  let out = '', last = 0, n = 0, m;
  while ((m = re.exec(html))) {
    let code = m[1];
    out += html.slice(last, m.index);
    if (code.length >= MIN) {
      code = O.obfuscate(LOCK + code, OPTS).getObfuscatedCode();
      if (code.includes('</script')) throw new Error('mã sau khi làm rối chứa </script');
      code = BANNER + code;
      n++;
    }
    out += '<script>' + code + '</script>';
    last = re.lastIndex;
  }
  out += html.slice(last);
  if (!n) throw new Error('không thấy script game trong ' + file);
  fs.writeFileSync(file, out);
  console.log('đã làm rối', n, 'script:', file, (html.length / 1e6).toFixed(2) + 'MB ->', (out.length / 1e6).toFixed(2) + 'MB');
}
