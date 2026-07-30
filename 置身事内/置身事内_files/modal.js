/* 源自《置身事内》单文件版 - Modal */
/* 自动拆分生成，请勿手动调整章节归属 */

// ============== Modal ==============
function showModal(title, body, buttons, tag, type) {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;
  const titleEl = document.getElementById('modal-title');
  const bodyEl = document.getElementById('modal-body');
  if (!titleEl || !bodyEl) return;
  titleEl.textContent = title;
  bodyEl.innerHTML = body;
  const tagEl = document.getElementById('modal-tag');
  if (tagEl) {
    tagEl.textContent = tag || '';
    const tagColors = { danger: ['var(--red-light)', 'var(--red)'], warn: ['var(--orange-light)', 'var(--orange)'], success: ['var(--green-light)', 'var(--green)'], corruption: ['var(--purple-light)', 'var(--purple)'], info: ['var(--accent-light)', 'var(--accent)'] };
    const [bg, fg] = tagColors[type] || tagColors.info;
    tagEl.style.background = bg; tagEl.style.color = fg;
  }
  const footer = document.getElementById('modal-footer');
  if (!footer) return;
  footer.innerHTML = '';
  for (const btn of buttons) {
    const el = document.createElement('button');
    el.textContent = btn.text;
    el.className = `btn-${btn.color || 'gray'}`;
    el.onclick = btn.action;
    footer.appendChild(el);
  }
  overlay.classList.add('active');
}
function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.classList.remove('active');
}

