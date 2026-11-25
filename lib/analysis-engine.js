const punctuation = /[\s，。！？、；：,.!?;:'"“”‘’（）()\-—]/g;

function normalize(text = '') {
  return String(text).toLowerCase().replace(punctuation, '');
}

function uniq(items) {
  return [...new Set(items)];
}

function analyzeRetelling(material, retelling) {
  const clean = normalize(retelling);
  const wordCount = String(retelling || '').replace(/\s/g, '').length;

  const concepts = material.concepts.map((concept) => {
    const matchedKeywords = concept.keywords.filter((keyword) => clean.includes(normalize(keyword)));
    const ratio = Math.min(1, matchedKeywords.length / concept.minimumHits);
    const status = ratio >= 1 ? 'covered' : matchedKeywords.length ? 'partial' : 'missing';
    return {
      id: concept.id,
      label: concept.label,
      status,
      score: Math.round(ratio * 100),
      matchedKeywords,
      missingKeywords: concept.keywords.filter((keyword) => !matchedKeywords.includes(keyword)).slice(0, 3),
      note: concept.note,
      question: concept.question,
      hints: concept.hints
    };
  });

  const weightedScore = concepts.reduce((sum, concept) => sum + concept.score, 0) / concepts.length;
  const lengthFactor = Math.min(1, wordCount / 70);
  const coverage = Math.round(weightedScore * (0.75 + lengthFactor * 0.25));

  const misconceptions = (material.misconceptions || [])
    .filter((item) => new RegExp(item.pattern).test(String(retelling || '')))
    .map((item) => item.message);

  const priority = concepts
    .filter((concept) => concept.status !== 'covered')
    .sort((a, b) => a.score - b.score)[0] || null;

  const strengths = concepts.filter((item) => item.status === 'covered').map((item) => item.label);
  const partial = concepts.filter((item) => item.status === 'partial').map((item) => item.label);
  const gaps = concepts.filter((item) => item.status === 'missing').map((item) => item.label);

  return {
    coverage,
    wordCount,
    concepts,
    strengths,
    partial,
    gaps,
    misconceptions: uniq(misconceptions),
    priorityConcept: priority ? priority.id : null,
    coach: priority
      ? {
          title: `先补一小块：${priority.label}`,
          question: priority.question,
          hints: priority.hints,
          rule: '导师会从轻提示开始，不直接给出完整答案。'
        }
      : {
          title: '讲得很完整，现在试试迁移应用',
          question: buildTransferQuestion(material.id),
          hints: ['先说结论，再说明你的理由。'],
          rule: '完整掌握后进入迁移问题，而不是重复背诵。'
        },
    feedback: buildFeedback({ coverage, strengths, partial, gaps, misconceptions, wordCount })
  };
}

function buildTransferQuestion(materialId) {
  const questions = {
    'water-cycle': '如果连续几天没有太阳，水循环中的哪些环节可能变慢？为什么？',
    photosynthesis: '把一株植物长期放在黑暗里，它的生长会怎样变化？为什么？',
    'silk-road': '如果古代交通长期中断，沿线城市和文明交流可能受到什么影响？'
  };
  return questions[materialId] || '请用这个知识解释一个生活中的现象。';
}

function buildFeedback({ coverage, strengths, partial, gaps, misconceptions, wordCount }) {
  if (wordCount < 20) {
    return '你已经迈出第一步了。再多讲一点过程和原因，导师才能更准确地发现你真正理解的部分。';
  }
  if (misconceptions.length) {
    return `你已经讲清了${strengths.length ? strengths.join('、') : '部分内容'}。有一个地方可能混淆了，我们先一起核对证据。`;
  }
  if (coverage >= 85) {
    return '你的讲述结构完整，而且能够说出关键关系。下一步不重复背诵，试着解决一个新情境。';
  }
  if (partial.length) {
    return `你已经提到了${partial.join('、')}，方向正确。我们只补充缺少的关键联系，不需要从头再讲。`;
  }
  return gaps.length
    ? `你已经完成了主动讲述。现在先聚焦“${gaps[0]}”，补上这一块就会更完整。`
    : '你已经完成了这次主动讲述，我们来检查知识之间的联系。';
}

function buildReviewCard(material, analysis, hintLevel = 0) {
  const target = analysis.concepts.find((item) => item.id === analysis.priorityConcept)
    || analysis.concepts.find((item) => item.status !== 'covered')
    || analysis.concepts[0];
  const dueAt = new Date(Date.now() + (hintLevel >= 3 ? 24 : 48) * 60 * 60 * 1000);
  return {
    id: `${material.id}-${target.id}-${Date.now()}`,
    materialId: material.id,
    materialTitle: material.title,
    conceptId: target.id,
    conceptLabel: target.label,
    question: target.question,
    note: target.note,
    dueAt: dueAt.toISOString(),
    hintLevel,
    status: 'scheduled'
  };
}

module.exports = { analyzeRetelling, buildReviewCard, normalize };

