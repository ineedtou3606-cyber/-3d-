export const styles = {
  realistic: { label: '실사 재현', prompt: '역사 영화의 한 장면 같은 사실적인 재현. 실제 인물과 공간처럼 자연스러운 피부·직물·목재 질감, 현실적인 비례와 조명. 실제 기록 사진으로 오인시키는 주장 없이 역사 재현 이미지로 구성.' },
  documentary: { label: '3D 다큐멘터리', prompt: '고품질 역사 다큐멘터리용 3D 렌더링. 입체적인 인물과 구조, 물리 기반 재질, 영화적인 깊이와 조명.' },
  cartoon: { label: '역사 만화', prompt: '정교한 역사 만화 일러스트. 명확한 윤곽선, 풍부한 색채, 셀 음영과 표정이 살아 있는 인물. 2D 만화 스타일을 유지하고 사진이나 3D 렌더로 바꾸지 않음.' },
};
export const storyTypes = {
  korea: {label: '대한민국 역사', context: '한국사 이야기. 대본에 명시된 시대·지역·인물을 따르고 해당 시대의 복식·건축·도구를 고증한다. 대한민국의 현대적 요소를 고대·중세 장면에 섞지 않는다. 확인되지 않은 연도·사건·인과관계는 추가하지 않는다.'},
  aesop: {label: '이솝 이야기', context: '이솝 우화 이야기. 대본에 있는 동물·인물의 성격과 행동을 시각화한다. 우화의 의인화와 상징적 연출은 허용하되 역사적 실화나 기록 사진이라고 주장하지 않는다. 등장 캐릭터의 외형을 일관되게 유지한다.'},
  custom: {label: '직접 입력', context: '사용자가 제공한 이야기. 대본의 배경과 등장인물을 따르고 실제 사실과 허구를 혼동하지 않는다.'},
};
export function generate(script, duration, style = 'documentary', storyType = 'korea') {
  if (!script.trim()) throw new Error('먼저 대본을 입력해주세요.');
  if (!Number.isFinite(duration) || duration < 3 || duration > 3600) throw new Error('영상 길이는 3~3600초로 입력해주세요.');
  const count = Math.ceil(duration / 4);
  if (script.length < count) throw new Error('영상 길이에 비해 대본이 너무 짧습니다. 대본을 추가하거나 길이를 줄여주세요.');
  const units = script.match(/[^.!?。！？\n]+[.!?。！？]*|[.!?。！？\n]/g) || [script];
  const chunks = []; let current = '';
  for (const unit of units) {
    if (current.length + unit.length > Math.ceil(script.length / count) && current) { chunks.push(current); current = ''; }
    current += unit;
  }
  if (current) chunks.push(current);
  while (chunks.length < count) {
    let idx = chunks.reduce((a, x, i) => x.length > chunks[a].length ? i : a, 0);
    const value = chunks[idx];
    if (value.length < 2) break;
    const middle = Math.ceil(value.length / 2);
    let split = value.indexOf(' ', middle);
    if (split < 1 || split >= value.length - 1) split = middle;
    chunks.splice(idx, 1, value.slice(0, split), value.slice(split));
  }
  while (chunks.length > count) { const tail = chunks.pop(); chunks[chunks.length - 1] += tail; }
  return chunks.map((text, i) => {
    const start = duration * i / chunks.length, end = duration * (i + 1) / chunks.length;
    const zoom = i % 3 === 1;
    const camera = ['전경의 좌측 위에서 출발해 대상 오른쪽으로 완만하게 회전한 후 원래 구도로 복귀', '전체 구조 정면에서 핵심 부위로 빠르게 접근한 후 뒤로 빠져 원래 구도로 복귀', '대상의 낮은 측면에서 출발해 위로 상승하며 구조를 탐색한 후 원래 구도로 복귀'][i % 3];
    const context = (storyTypes[storyType] || storyTypes.korea).context;
    const scene = { id: i + 1, text, start, end,
      image: `16:9 가로형. ${(styles[style] || styles.documentary).prompt} 다음 대본 구간을 설명하는 시대·장소·인물·사건을 시각화: 「${text.trim()}」. 명확한 핵심 피사체, 입체감과 깊이, 영화적인 구도, 정돈된 배경. 전체 장면에서 대상의 디자인·색상·형태·재질과 조명을 일관되게 유지. 시대에 맞는 복식·건축·도구를 유지하고 현대적 사물은 배제. 사료로 확인되지 않는 세부는 재현적 해석으로 취급. 텍스트·자막·화살표·수치·라벨·아이콘 없이 장면 자체만 생성. 대본에 없는 사실이나 구조는 임의로 추가하지 않음.`,
      infographic: `이 장면의 원본 이미지 한 장만 개별 편집. 대본 맥락: 「${text.trim()}」. 원본의 비율·구도·카메라 각도·대상·조명·색감을 유지. 핵심 대상에 연결되는 이동 경로, 지도 경계, 사건 순서, 강조 링 중 설명에 필요한 것만 크고 선명하게 추가. 배경과 대비되는 강조색을 최소 2~3가지 선택하고 공간의 원근에 맞춰 배치. 핵심 대상을 가리지 말고 여백에 짧고 큰 한국어 라벨을 배치. 영어와 영문 단위 금지. 대본에 없는 연도·영토·인과관계·명칭은 생략. 콜라주 금지, 원본 한 장당 결과 한 장.`,
      flow: `8초, 동일한 3D 공간에서 연속 촬영. 대본 맥락: 「${text.trim()}」. 0~2초: 인포그래픽 없는 시작 이미지의 전체 구조를 보여주며 기존 피사체에서 확인 가능한 움직임을 시작한다. 2~5초: 카메라는 ${camera}. ${zoom ? '2~3초에 핵심 대상을 향해 짧고 강하게 접근하며 강조 링과 외곽선을 활성화한다.' : '급격한 줌 없이 깊이와 시차가 느껴지는 이동을 사용한다.'} 인물·군중·선박 등 기존 대상의 움직임은 대본과 원본에서 확인되는 범위에서만 표현한다. 지도나 내부 공간이 두 기준 이미지에 확인되는 경우에만 그 공간으로 접근한다. 5~7초: 대상 강조 → 종료 이미지의 굵은 선과 링 그리기 → 기존 한국어 라벨 등장 → 연결 그래픽 확장 순서로 실제 움직임에 연동한다. 7~8초: 카메라를 종료 이미지의 위치와 구도로 정착시키고 마지막 프레임을 종료 이미지와 일치시킨다. 새로운 핵심 대상이나 텍스트를 만들지 않고 형태·조명·재질을 유지한다. 각 구간은 잘라 사용하기 좋은 안정된 구도를 포함한다.` };
    scene.image = `${context}\n${scene.image}`;
    if (storyType === 'aesop') scene.image = scene.image.replace('시대·장소·인물·사건', '배경·캐릭터·행동·교훈').replace('시대에 맞는 복식·건축·도구를 유지하고 현대적 사물은 배제. 사료로 확인되지 않는 세부는 재현적 해석으로 취급.', '우화의 세계관에 맞는 배경과 캐릭터를 유지. 동물의 의인화는 대본에 맞게 표현.');
    scene.infographic = `${context}\n${scene.infographic}`;
    scene.flow = `${context}\n${scene.flow}`;
    if (style === 'cartoon') scene.flow = `역사 만화의 윤곽선·색채·셀 음영을 유지. 공간 이동은 2.5D 다층 시차로 표현하고 실사나 3D 렌더로 스타일을 바꾸지 않는다.\n${scene.flow}`;
    return scene;
  });
}
