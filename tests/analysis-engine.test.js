const test = require('node:test');
const assert = require('node:assert/strict');
const materials = require('../data/materials.json');
const { analyzeRetelling, buildReviewCard } = require('../lib/analysis-engine');

const water = materials.find((item) => item.id === 'water-cycle');

test('完整复述能够覆盖水循环的核心环节', () => {
  const result = analyzeRetelling(
    water,
    '太阳加热地面的水形成水蒸气，水蒸气升到高空遇冷凝结成小水滴并形成云。水滴变大后空气托不住，就以雨或雪落回地面。水流入河流湖泊和海洋，也会进入地下，然后再次蒸发形成循环。'
  );
  assert.ok(result.coverage >= 85);
  assert.equal(result.gaps.length, 0);
  assert.match(result.coach.question, /连续几天没有太阳/);
});

test('不完整复述会优先定位缺失概念并提供分级提示', () => {
  const result = analyzeRetelling(water, '太阳把水晒成水蒸气，水蒸气飞到了天上。');
  assert.ok(result.coverage < 60);
  assert.ok(result.gaps.includes('凝结'));
  assert.equal(result.coach.hints.length, 4);
  assert.equal(result.priorityConcept, 'condensation');
});

test('误解规则能够识别云与水蒸气的混淆', () => {
  const result = analyzeRetelling(water, '太阳加热水，云就是水蒸气，最后下雨。');
  assert.ok(result.misconceptions.length > 0);
  assert.match(result.misconceptions[0], /小水滴或小冰晶/);
});

test('复习卡根据高提示依赖安排更早复习', () => {
  const result = analyzeRetelling(water, '太阳把水晒到了天上。');
  const card = buildReviewCard(water, result, 3);
  const hours = (new Date(card.dueAt).getTime() - Date.now()) / 3600000;
  assert.ok(hours > 23 && hours <= 24.1);
  assert.equal(card.status, 'scheduled');
});

