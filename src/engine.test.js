import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate } from './engine.js';
test('대본 원문과 순서를 유지하고 장면 길이를 제한한다', () => {
  const script = '물은 파이프를 따라 흐릅니다.\n펌프는 물을 이동시킵니다. 압력의 차이가 흐름을 만듭니다.';
  const scenes = generate(script, 16);
  assert.equal(scenes.map(s => s.text).join(''), script);
  assert.equal(scenes.length, 4);
  assert.ok(scenes.every(s => s.end - s.start <= 4));
  assert.equal(scenes.at(-1).end, 16);
});
test('입력 검증', () => { assert.throws(() => generate('', 12)); assert.throws(() => generate('대본', NaN)); });
test('역사 이미지 스타일을 선택하고 대본을 유지한다', () => {
  for (const [style, marker] of [['realistic', '사실적인 재현'], ['documentary', '3D 렌더링'], ['cartoon', '만화 일러스트']]) {
    const scene = generate('사절단이 바다를 건넜습니다.', 4, style)[0];
    assert.ok(scene.image.includes(marker));
    assert.equal(scene.text, '사절단이 바다를 건넜습니다.');
  }
});
test('이솝 이야기는 역사적 실화로 표현하지 않는다', () => {
  const scene = generate('토끼와 거북이가 달리기 시합을 했습니다.', 4, 'cartoon', 'aesop')[0];
  assert.ok(scene.image.includes('의인화'));
  assert.ok(scene.image.includes('실화나 기록 사진이라고 주장하지 않는다'));
  assert.ok(scene.flow.includes('2.5D'));
});
