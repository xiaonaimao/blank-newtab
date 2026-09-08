const KEY = 'links_v2';
const DEFAULTS = [
  { name: '哔哩哔哩', url: 'https://www.bilibili.com', icon: null },
  { name: '知乎', url: 'https://www.zhihu.com', icon: null },
  { name: 'GitHub', url: 'https://github.com', icon: null },
  { name: '京东', url: 'https://www.jd.com', icon: null },
];
let links;
try { links = JSON.parse(localStorage.getItem(KEY)) || DEFAULTS.slice(); }
catch (e) { links = DEFAULTS.slice(); }

const grid = document.getElementById('grid');
let editing = false;
let modalIndex = -1; // -1 = 新增
let pendingIcon = null; // 本轮弹窗里上传的 dataURL
let lastFile = null; // 本轮弹窗里上传的原始文件（切换处理方式时重绘用）

// 按 fit 模式把图片画进 128x128 画布
// contain: 等比缩放完整显示（留边）| stretch: 拉伸填满 | cover: 居中裁剪
function drawFitted(ctx, img, fit) {
  const S = 128;
  if (fit === 'stretch') {
    ctx.drawImage(img, 0, 0, S, S);
  } else if (fit === 'cover') {
    const s = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, S, S);
  } else { // contain（默认）
    const k = Math.min(S / img.width, S / img.height);
    ctx.drawImage(img, (S - img.width * k) / 2, (S - img.height * k) / 2, img.width * k, img.height * k);
  }
}
function redrawPending() {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    drawFitted(c.getContext('2d'), img, document.getElementById('fFit').value);
    pendingIcon = c.toDataURL('image/png');
  };
  img.src = URL.createObjectURL(lastFile);
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(links)); } catch (e) { alert('保存失败：数据过大'); }
}
function normalize(u) {
  u = (u || '').trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u;
}
function originOf(u) { try { return new URL(u).origin; } catch (e) { return ''; } }
function hueOf(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

function render() {
  grid.textContent = '';
  links.forEach((l, i) => {
    const tile = document.createElement('div');
    tile.className = 'tile';

    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    if (l.icon) {
      const img = document.createElement('img');
      img.src = l.icon;
      thumb.appendChild(img);
    } else {
      const img = document.createElement('img');
      img.src = originOf(l.url) + '/favicon.ico';
      img.onerror = () => {
        const lt = document.createElement('div');
        lt.className = 'letter';
        lt.style.background = 'hsl(' + hueOf(l.name) + ',45%,55%)';
        lt.textContent = (l.name || '?').trim().charAt(0).toUpperCase();
        img.replaceWith(lt);
      };
      thumb.appendChild(img);
    }

    const name = document.createElement('div');
    name.className = 'tname';
    name.textContent = l.name;

    const del = document.createElement('button');
    del.className = 'op';
    del.textContent = '×';
    del.title = '删除';
    del.onclick = (ev) => {
      ev.stopPropagation();
      if (confirm('删除「' + l.name + '」？')) {
        links.splice(i, 1);
        save(); render();
      }
    };

    tile.appendChild(thumb);
    tile.appendChild(name);
    tile.appendChild(del);
    tile.onclick = () => {
      if (editing) openModal(i);
      else window.location.href = l.url;
    };
    grid.appendChild(tile);
  });

  // 常驻"+"：与图标同尺寸，永远排在最后
  const add = document.createElement('div');
  add.id = 'addTile';
  const plus = document.createElement('div');
  plus.className = 'plus';
  plus.textContent = '+';
  add.appendChild(plus);
  add.onclick = () => openModal(-1);
  grid.appendChild(add);
}

function openModal(i) {
  modalIndex = i;
  pendingIcon = null;
  lastFile = null;
  const l = i >= 0 ? links[i] : { name: '', url: '', icon: null };
  document.getElementById('fName').value = l.name;
  document.getElementById('fUrl').value = l.url;
  document.getElementById('fIcon').value = '';
  document.getElementById('fFit').value = l.fit || 'contain';
  document.getElementById('delBtn').style.display = i >= 0 ? '' : 'none';
  document.getElementById('mask').classList.add('show');
  document.getElementById('fName').focus();
}
function closeModal() {
  document.getElementById('mask').classList.remove('show');
}

document.getElementById('saveBtn').onclick = () => {
  const name = document.getElementById('fName').value.trim();
  const url = normalize(document.getElementById('fUrl').value);
  if (!name || !url) { alert('名称和网址都要填'); return; }
  const item = {
    name, url,
    icon: pendingIcon !== null ? pendingIcon : (modalIndex >= 0 ? links[modalIndex].icon : null),
    fit: document.getElementById('fFit').value,
  };
  if (modalIndex >= 0) links[modalIndex] = item;
  else links.push(item);
  save(); render(); closeModal();
};
document.getElementById('cancelBtn').onclick = closeModal;
document.getElementById('delBtn').onclick = () => {
  if (confirm('删除「' + links[modalIndex].name + '」？')) {
    links.splice(modalIndex, 1);
    save(); render(); closeModal();
  }
};
document.getElementById('mask').addEventListener('click', (e) => {
  if (e.target === document.getElementById('mask')) closeModal();
});
document.getElementById('fIcon').onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  lastFile = file;
  redrawPending();
};
document.getElementById('fFit').onchange = () => {
  if (lastFile) redrawPending(); // 已传图后切换处理方式，实时重绘
};

// 编辑模式开关
const modeBtn = document.getElementById('modeBtn');
function toggleEdit(force) {
  editing = (force !== undefined) ? force : !editing;
  document.body.classList.toggle('editing', editing);
  modeBtn.textContent = editing ? '✓' : '✎';
  modeBtn.title = editing ? '完成编辑' : '编辑快捷方式';
}
modeBtn.onclick = () => toggleEdit();
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    if (editing) toggleEdit(false);
  }
});

render();
