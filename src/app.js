import { generate, styles, storyTypes } from './engine.js';
const $ = id => document.getElementById(id);
let scenes = [], tab = 'image';
let generating = false, stopRequested = false, configured = false, selectedStyle = 'documentary';
async function checkApi() {
  try { const r = await fetch('/api/status'); if (!r.ok) throw new Error(); configured = (await r.json()).configured; }
  catch { configured = false; }
  $('api-status').textContent = configured ? '유료 API 연결 설정됨 · 생성 버튼으로 이미지를 요청하세요.' : '무료 수동 방식: 프롬프트 복사 → Flow에서 생성 → 이미지 가져오기. 앱 자동 생성은 API 키 설정이 필요합니다.';
}
checkApi();
function imageControls(scene, card) {
  if (tab === 'flow') return;
  const kind = tab === 'image' ? 'original' : 'enhanced';
  const area = document.createElement('div'); area.className = 'scene-images';
  if (scene[kind]) {
    const img = document.createElement('img'); img.src = scene[kind]; img.alt = `장면 ${scene.id} ${kind === 'original' ? '원본' : '인포그래픽'}`;
    const download = document.createElement('a'); download.className = 'secondary'; download.href = scene[kind]; download.download = `${String(scene.id).padStart(2,'0')}_${kind}.png`; download.textContent = '이미지 다운로드';
    area.append(img, download);
  }
  const actions = document.createElement('div'); actions.className = 'scene-actions';
  const button = document.createElement('button'); button.className = 'primary'; button.disabled = generating || !configured || (kind === 'enhanced' && !scene.original);
  button.textContent = kind === 'original' ? (scene.original ? '원본 다시 생성 (유료)' : '원본 이미지 생성 (유료)') : '인포그래픽 추가 (유료)';
  button.onclick = () => runImages([scene], kind);
  const upload = document.createElement('label'); upload.className = 'secondary upload-button'; upload.textContent = '이미지 가져오기';
  const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/png,image/jpeg,image/webp'; input.disabled = generating;
  input.onchange = async () => {
    const file = input.files[0]; if (!file) return;
    if (file.size > 10000000) { scene.failure = '10MB 이하의 이미지를 선택해주세요.'; render(); return; }
    try {
      const bitmap = await createImageBitmap(file); const canvas = document.createElement('canvas');
      const scale = Math.min(1, 1536 / bitmap.width, 1024 / bitmap.height); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close(); scene[kind] = canvas.toDataURL('image/png');
      if (kind === 'original') delete scene.enhanced;
      scene.failure = ''; render();
    } catch { scene.failure = '이미지를 읽을 수 없습니다. PNG·JPEG·WebP 파일을 선택해주세요.'; render(); }
  };
  upload.append(input); actions.append(button, upload); area.append(actions);
  const status = document.createElement('p'); status.className = scene.failure ? 'image-error' : 'image-status'; status.setAttribute('role', 'status');
  status.textContent = scene.failure || scene.progress || (kind === 'enhanced' && !scene.original ? '먼저 원본 이미지를 생성하거나 가져오세요.' : '직접 생성하거나 Flow 등에서 만든 이미지를 가져올 수 있습니다.');
  area.append(status); card.append(area);
}
async function runImages(targets, kind = 'original') {
  if (generating) return;
  await checkApi(); if (!configured) { $('api-status').scrollIntoView({behavior:'smooth'}); return; }
  generating = true; stopRequested = false; $('generate').disabled = true; $('generate-images').disabled = true; $('stop-images').textContent = '현재 장면 후 중단'; $('stop-images').hidden = false;
  try {
    for (const scene of targets) {
      if (stopRequested) break;
      scene.failure = ''; scene.progress = '이미지 생성 중… 1~3분 정도 걸릴 수 있습니다.'; render();
      try {
        const request = {quality: $('quality').value, prompt: kind === 'original' ? scene.image : `${scene.infographic}\n원본의 스타일 유지: ${styles[selectedStyle].prompt}`};
        if (kind === 'enhanced') request.source = scene.original;
        const response = await fetch('/api/images', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(request)});
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '이미지 생성에 실패했습니다.');
        if (!data.image?.startsWith('data:image/png;base64,')) throw new Error('이미지 응답이 올바르지 않습니다.');
        scene[kind] = data.image; if (kind === 'original') delete scene.enhanced;
        scene.progress = '생성 완료 · 이미지를 다운로드해 보관하세요.';
      } catch (error) { scene.failure = error.message; scene.progress = ''; break; }
      render();
    }
  } finally {
    generating = false; $('generate').disabled = false; $('generate-images').disabled = false; $('stop-images').hidden = true; render();
  }
}
$('generate-images').onclick = () => runImages(scenes.filter(scene => !scene.original));
$('stop-images').onclick = () => { stopRequested = true; $('stop-images').textContent = '현재 요청 완료 후 중단합니다'; };
const count = () => $('count').textContent = `${$('script').value.length.toLocaleString()}자`;
$('script').addEventListener('input', count);
$('sample').onclick = () => {
  if ($('story-type').value === 'aesop') {
    $('title').value = '토끼와 거북이';
    $('script').value = '토끼는 거북이의 느린 걸음을 보고 웃었습니다. 거북이는 토끼에게 달리기 시합을 제안했습니다. 시합이 시작되자 토끼는 멀리 앞서 달려갔습니다. 토끼는 여유를 부리며 나무 아래에서 잠이 들었습니다. 거북이는 쉬지 않고 한 걸음씩 앞으로 나아갔습니다. 토끼가 잠에서 깼을 때 거북이는 결승점에 도착해 있었습니다.';
    $('duration').value = '24'; count(); return;
  }
  $('title').value = '바다를 건넌 조선의 사절단';
  $('script').value = '조선통신사는 바다를 건너 일본으로 향했습니다. 사절단에는 외교를 맡은 관리뿐 아니라 기록과 문화 교류를 담당하는 이들도 함께했습니다. 긴 여정 동안 배는 항구와 항구를 이어주었습니다. 낯선 땅에서 만난 사람들은 글과 그림으로 생각을 나누었습니다. 이들의 여정은 기록으로 남아 당시의 교류를 전합니다. 바다를 건넌 이야기는 오늘날에도 두 지역의 역사를 돌아보게 합니다.';
  $('duration').value = '24'; count();
};
function render() {
  $('cards').replaceChildren();
  for (const scene of scenes) {
    const card = document.createElement('article'); card.className = 'card';
    const top = document.createElement('div'); top.className = 'card-top';
    const label = document.createElement('strong'); label.textContent = `장면 ${String(scene.id).padStart(2, '0')}`;
    const time = document.createElement('span'); time.textContent = `${scene.start.toFixed(1)}–${scene.end.toFixed(1)}초`; label.append(time);
    const copy = document.createElement('button'); copy.className = 'secondary'; copy.textContent = '복사';
    copy.onclick = async () => { try { await navigator.clipboard.writeText(scene[tab]); copy.textContent = '복사 완료'; } catch { copy.textContent = '텍스트를 선택해 복사해주세요'; } };
    top.append(label, copy);
    const quote = document.createElement('blockquote'); quote.textContent = scene.text;
    const prompt = document.createElement('pre'); prompt.textContent = scene[tab];
    card.append(top, quote); imageControls(scene, card); card.append(prompt); $('cards').append(card);
  }
}
$('generate').onclick = () => {
  try {
    selectedStyle = document.querySelector('[name="style"]:checked').value;
    scenes = generate($('script').value, Number($('duration').value), selectedStyle, $('story-type').value);
    $('error').textContent = ''; $('results').hidden = false;
    $('result-title').textContent = $('title').value.trim() || '나의 역사 이야기';
    $('summary').textContent = `${storyTypes[$('story-type').value].label} · ${styles[selectedStyle].label} · ${$('quality').selectedOptions[0].text.split(' — ')[0]} · ${scenes.length}개 장면 · 최종 ${$('duration').value}초 · Flow 소스 ${scenes.length * 8}초 (편집용)`;
    try { localStorage.setItem('sarok-draft', JSON.stringify({title: $('title').value, script: $('script').value, duration: $('duration').value, style: selectedStyle, storyType: $('story-type').value, quality: $('quality').value})); } catch {}
    render(); $('results').scrollIntoView({behavior:'smooth', block:'start'});
  } catch (error) { $('error').textContent = error.message; }
};
document.querySelectorAll('[data-tab]').forEach(button => button.onclick = () => { tab = button.dataset.tab; document.querySelectorAll('[data-tab]').forEach(b => { b.classList.toggle('on', b === button); b.setAttribute('aria-selected', String(b === button)); }); render(); });
$('restore').onclick = () => {
  if (generating) return;
  try { const data = JSON.parse(localStorage.getItem('sarok-draft')); if (!data) { $('error').textContent = '저장된 작업이 없습니다. 첫 이야기를 만들어보세요.'; return; } for (const key of ['title','script','duration']) $(key).value = data[key]; const style = data.style in styles ? data.style : 'documentary'; document.querySelector(`[name="style"][value="${style}"]`).checked = true; $('story-type').value = data.storyType in storyTypes ? data.storyType : 'korea'; $('quality').value = ['low','medium','high'].includes(data.quality) ? data.quality : 'medium'; count(); $('error').textContent = ''; } catch { $('error').textContent = '저장된 작업을 불러올 수 없습니다.'; }
};
$('download').onclick = () => {
  const content = `# ${$('result-title').textContent}\n\n${$('summary').textContent}\n\n` + scenes.map(s => `## ${String(s.id).padStart(2,'0')} 장면 (${s.start.toFixed(1)}–${s.end.toFixed(1)}초)\n\n대본: ${s.text}\n\n### 원본 이미지\n${s.image}\n\n### 인포그래픽 편집\n${s.infographic}\n\n### Flow 영상\n${s.flow}`).join('\n\n');
  const url = URL.createObjectURL(new Blob([content], {type:'text/markdown;charset=utf-8'})); const a = document.createElement('a'); a.href = url; a.download = '사록_장면_프롬프트.md'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
