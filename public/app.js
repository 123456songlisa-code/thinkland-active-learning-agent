const state = {
  materials: [],
  currentMaterial: null,
  analysis: null,
  hintLevel: 0,
  sessions: JSON.parse(localStorage.getItem('thinkland:sessions') || '[]'),
  reviewCards: JSON.parse(localStorage.getItem('thinkland:reviews') || '[]')
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || '请求失败');
  return payload;
}

function saveState() {
  localStorage.setItem('thinkland:sessions', JSON.stringify(state.sessions));
  localStorage.setItem('thinkland:reviews', JSON.stringify(state.reviewCards));
  updateBadges();
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function setJourney(step) {
  $$('.journey-step').forEach((item, index) => item.classList.toggle('active', index <= step));
}

async function loadMaterials() {
  const { materials } = await api('/api/materials');
  state.materials = materials;
  renderMaterialOptions();
  await selectMaterial(materials[0].id);
}

async function selectMaterial(id) {
  const { material } = await api(`/api/materials/${id}`);
  state.currentMaterial = material;
  state.analysis = null;
  state.hintLevel = 0;
  $('#materialTitle').textContent = material.title;
  $('#materialSubject').textContent = material.subject;
  $('#materialLevel').textContent = material.level;
  $('#materialDuration').textContent = `约 ${material.duration} 分钟`;
  $('#materialIntro').textContent = material.intro;
  $('#materialContent').textContent = material.content;
  $('#retellingInput').value = '';
  $('#charCounter').textContent = '0 字';
  $('#retellSection').classList.add('hidden');
  $('#analysisSection').classList.add('hidden');
  $('#materialModal').classList.add('hidden');
  setJourney(0);
  renderMaterialOptions();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderMaterialOptions() {
  $('#materialOptions').innerHTML = state.materials.map((material) => `
    <button class="material-option ${state.currentMaterial?.id === material.id ? 'selected' : ''}" data-material-id="${material.id}">
      <span><strong>${escapeHtml(material.title)}</strong><small>${escapeHtml(material.intro)}</small></span>
      <span class="pill">${escapeHtml(material.subject)} · ${escapeHtml(material.level)}</span>
    </button>
  `).join('');
  $$('.material-option').forEach((button) => button.addEventListener('click', () => selectMaterial(button.dataset.materialId)));
}

function beginRetelling() {
  $('#retellSection').classList.remove('hidden');
  $('#analysisSection').classList.add('hidden');
  setJourney(1);
  $('#retellSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => $('#retellingInput').focus(), 420);
}

async function analyze() {
  const retelling = $('#retellingInput').value.trim();
  const button = $('#analyzeButton');
  button.disabled = true;
  button.textContent = '导师正在整理你的讲述…';
  try {
    const result = await api('/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ materialId: state.currentMaterial.id, retelling })
    });
    state.analysis = result.analysis;
    state.hintLevel = 0;
    recordSession(retelling);
    renderAnalysis();
    setJourney(2);
    $('#analysisSection').classList.remove('hidden');
    $('#analysisSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    showToast(error.message);
  } finally {
    button.disabled = false;
    button.innerHTML = '<span>✦</span> 请导师听我讲';
  }
}

function recordSession(retelling) {
  state.sessions.unshift({
    id: Date.now(),
    materialId: state.currentMaterial.id,
    materialTitle: state.currentMaterial.title,
    subject: state.currentMaterial.subject,
    coverage: state.analysis.coverage,
    hintLevel: 0,
    gaps: state.analysis.gaps,
    retelling,
    createdAt: new Date().toISOString()
  });
  state.sessions = state.sessions.slice(0, 20);
  saveState();
}

function renderAnalysis() {
  const analysis = state.analysis;
  $('#coverageScore').textContent = analysis.coverage;
  $('#scoreRing').style.setProperty('--score', analysis.coverage);
  $('#feedbackTitle').textContent = analysis.coverage >= 85 ? '讲得完整，还能继续迁移' : '你已经完成主动讲述';
  $('#feedbackText').textContent = analysis.feedback;
  $('#coachTitle').textContent = analysis.coach.title;
  $('#coachQuestion').textContent = analysis.coach.question;
  $('#hintBox').classList.add('hidden');
  $('#hintButton').disabled = false;
  $('#hintButton').textContent = '给我一点点提示';
  renderDependency();

  const stateLabels = { covered: ['✓', '已讲清'], partial: ['·', '提到了'], missing: ['!', '待补充'] };
  $('#conceptMap').innerHTML = analysis.concepts.map((concept) => {
    const [symbol, status] = stateLabels[concept.status];
    const detail = concept.status === 'covered'
      ? `已覆盖：${concept.matchedKeywords.join('、')}`
      : `可以补充：${concept.missingKeywords.join('、')}`;
    return `<div class="concept-row ${concept.status}"><span class="concept-state">${symbol}</span><strong>${escapeHtml(concept.label)}</strong><p>${escapeHtml(detail)}</p><span class="concept-score">${status}</span></div>`;
  }).join('');

  if (analysis.misconceptions.length) {
    $('#misconceptionBox').classList.remove('hidden');
    $('#misconceptionBox').innerHTML = `<strong>发现一个可能的理解偏差</strong><br>${analysis.misconceptions.map(escapeHtml).join('<br>')}`;
  } else {
    $('#misconceptionBox').classList.add('hidden');
  }
}

function showNextHint() {
  if (!state.analysis) return;
  const hints = state.analysis.coach.hints;
  state.hintLevel = Math.min(state.hintLevel + 1, hints.length);
  $('#hintBox').classList.remove('hidden');
  $('#hintBox').innerHTML = `<strong>第 ${state.hintLevel} 级帮助</strong><br>${escapeHtml(hints[state.hintLevel - 1])}`;
  $('#hintButton').textContent = state.hintLevel >= hints.length ? '已经是最后一级帮助' : '还需要多一点提示';
  $('#hintButton').disabled = state.hintLevel >= hints.length;
  const current = state.sessions[0];
  if (current) current.hintLevel = state.hintLevel;
  saveState();
  renderDependency();
}

function renderDependency() {
  const labels = ['尚未使用提示', '轻提示', '关键词提示', '局部笔记', '导师示范'];
  $('#dependencyLabel').textContent = labels[state.hintLevel];
  $$('.dependency-scale span').forEach((item, index) => item.classList.toggle('active', index <= state.hintLevel));
}

async function scheduleReview() {
  if (!state.analysis) return;
  try {
    const { card } = await api('/api/review-card', {
      method: 'POST',
      body: JSON.stringify({ materialId: state.currentMaterial.id, analysis: state.analysis, hintLevel: state.hintLevel })
    });
    const exists = state.reviewCards.some((item) => item.materialId === card.materialId && item.conceptId === card.conceptId && item.status === 'scheduled');
    if (!exists) state.reviewCards.unshift(card);
    saveState();
    setJourney(3);
    showToast(exists ? '这张复习卡已经在岛上了' : '已加入复习岛，将在合适的时间再次出现');
  } catch (error) {
    showToast(error.message);
  }
}

function updateBadges() {
  const scheduled = state.reviewCards.filter((item) => item.status === 'scheduled').length;
  $('#reviewBadge').textContent = scheduled;
  $('#dueCount').textContent = scheduled;
  $('#sidebarStars').textContent = 12 + state.sessions.length * 2;
}

function renderReviews() {
  const cards = state.reviewCards.filter((item) => item.status === 'scheduled');
  $('#reviewList').innerHTML = cards.length ? cards.map((card) => `
    <article class="review-card">
      <span class="card-icon">忆</span>
      <div><h3>${escapeHtml(card.conceptLabel)} · ${escapeHtml(card.materialTitle)}</h3><p>${escapeHtml(card.question)} · ${formatDue(card.dueAt)}</p></div>
      <button class="primary-button review-now" data-card-id="${card.id}">开始主动回忆</button>
    </article>
  `).join('') : '<div class="empty-state"><strong>复习岛还是空的</strong>完成一次讲述后，把需要巩固的知识加入这里。</div>';

  $$('.review-now').forEach((button) => button.addEventListener('click', () => {
    const card = state.reviewCards.find((item) => item.id === button.dataset.cardId);
    if (!card) return;
    switchView('learn');
    selectMaterial(card.materialId).then(() => {
      beginRetelling();
      $('#retellingInput').placeholder = card.question;
      showToast('先不看笔记，试着回答复习问题');
    });
  }));
}

function formatDue(value) {
  const hours = Math.max(0, Math.round((new Date(value).getTime() - Date.now()) / 3600000));
  if (hours <= 1) return '现在可以复习';
  if (hours < 24) return `${hours} 小时后复习`;
  return `${Math.round(hours / 24)} 天后复习`;
}

function renderReport() {
  const sessions = state.sessions;
  const averageCoverage = sessions.length ? Math.round(sessions.reduce((sum, item) => sum + item.coverage, 0) / sessions.length) : '--';
  const averageHint = sessions.length ? (sessions.reduce((sum, item) => sum + item.hintLevel, 0) / sessions.length).toFixed(1) : '--';
  const weak = new Set(state.reviewCards.filter((item) => item.status === 'scheduled').map((item) => item.conceptId));
  $('#sessionCount').textContent = sessions.length;
  $('#averageCoverage').textContent = averageCoverage;
  $('#averageHint').textContent = averageHint;
  $('#weakConcepts').textContent = weak.size;
  $('#historyList').innerHTML = sessions.length ? sessions.slice(0, 8).map((session) => `
    <div class="history-item"><span class="dot">${escapeHtml(session.subject.slice(0, 1))}</span><div><strong>${escapeHtml(session.materialTitle)}</strong><small>${new Date(session.createdAt).toLocaleString('zh-CN')} · 使用 ${session.hintLevel} 级提示</small></div><span class="history-score">${session.coverage}%</span></div>
  `).join('') : '<div class="empty-state"><strong>还没有学习记录</strong>完成第一次主动讲述后，这里会出现可解释的成长证据。</div>';
}

function switchView(view) {
  const meta = {
    learn: ['今天也要把知识讲明白', '学习实验室'],
    review: ['在快要忘记时重新提取', '复习岛'],
    report: ['看见方法，而不只看见分数', '成长报告']
  };
  $$('.view').forEach((item) => item.classList.remove('active'));
  $(`#${view}View`).classList.add('active');
  $$('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === view));
  $('#pageEyebrow').textContent = meta[view][0];
  $('#pageTitle').textContent = meta[view][1];
  if (view === 'review') renderReviews();
  if (view === 'report') renderReport();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function bindEvents() {
  $$('.nav-item').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));
  $('#changeMaterialButton').addEventListener('click', () => $('#materialModal').classList.remove('hidden'));
  $('#closeModalButton').addEventListener('click', () => $('#materialModal').classList.add('hidden'));
  $('#materialModal').addEventListener('click', (event) => { if (event.target === $('#materialModal')) $('#materialModal').classList.add('hidden'); });
  $('#startRetellingButton').addEventListener('click', beginRetelling);
  $('#backToReadingButton').addEventListener('click', () => $('.material-panel').scrollIntoView({ behavior: 'smooth' }));
  $('#analyzeButton').addEventListener('click', analyze);
  $('#retellingInput').addEventListener('input', (event) => { $('#charCounter').textContent = `${event.target.value.replace(/\s/g, '').length} 字`; });
  $('#hintButton').addEventListener('click', showNextHint);
  $('#reviseButton').addEventListener('click', () => { $('#retellSection').scrollIntoView({ behavior: 'smooth' }); setTimeout(() => $('#retellingInput').focus(), 350); });
  $('#scheduleButton').addEventListener('click', scheduleReview);
}

async function init() {
  bindEvents();
  updateBadges();
  try {
    await loadMaterials();
  } catch (error) {
    showToast(`启动失败：${error.message}`);
  }
}

init();

