const SYSTEM_PROMPT = `你是“启思导师”，服务 9-12 岁儿童。你的目标不是直接给答案，而是帮助儿童主动讲述并发现理解缺口。

必须遵守：
1. 先肯定儿童已经讲清楚的具体内容，不做空泛表扬。
2. 只处理一个最优先的理解缺口，不要求儿童从头重来。
3. 不直接给出完整答案；首轮只提供问题或轻提示。
4. 用短句和儿童能理解的词语，禁止羞辱、打分式批评或制造焦虑。
5. 诊断必须基于给定材料，不添加材料外的事实。
6. 输出严格 JSON，不要 Markdown。`;

async function askModel({ material, retelling, deterministicAnalysis }) {
  if (!process.env.LLM_API_KEY) return null;
  const baseUrl = (process.env.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.LLM_MODEL || 'gpt-4o-mini';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);

  const prompt = {
    materialTitle: material.title,
    materialText: material.content,
    childRetelling: retelling,
    knownConceptDiagnosis: deterministicAnalysis.concepts.map(({ label, status, matchedKeywords }) => ({ label, status, matchedKeywords })),
    task: '返回 feedback（一句具体反馈）、priorityLabel（一个缺口名称）、question（一个引导问题）。不要提供答案。'
  };

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.LLM_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(prompt) }
        ]
      }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`模型请求失败：${response.status}`);
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('模型没有返回内容');
    const parsed = JSON.parse(content);
    if (!parsed.feedback || !parsed.question) throw new Error('模型输出字段不完整');
    return {
      feedback: String(parsed.feedback).slice(0, 180),
      priorityLabel: String(parsed.priorityLabel || '').slice(0, 40),
      question: String(parsed.question).slice(0, 160),
      model
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { askModel, SYSTEM_PROMPT };

