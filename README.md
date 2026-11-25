# 启思岛 ThinkLand

面向 9-12 岁儿童的主动学习 Agent MVP。产品通过“主动讲述—理解诊断—分级帮助—延时复习”帮助儿童暴露并修正理解缺口，而不是直接提供答案。

## 产品亮点

- **主动输出**：用“见习老师任务”推动儿童脱离材料重新组织知识；
- **可解释诊断**：逐项展示知识点的覆盖、部分覆盖、遗漏和典型误解；
- **四级帮助**：轻提示 → 关键词 → 局部笔记 → 导师示范；
- **提示依赖度**：记录儿童解决问题需要的最高帮助等级；
- **延时复习**：根据理解缺口和提示等级生成 24-48 小时复习卡；
- **家长报告**：展示学习过程证据，而不只展示正确率；
- **稳定降级**：大模型不可用时自动使用本地可解释诊断引擎。

## 快速启动

要求 Node.js 22 或更高版本，无需安装第三方依赖。

```bash
npm start
```

浏览器访问：`http://127.0.0.1:4173`

运行测试：

```bash
npm test
```

## 可选模型配置

复制 `.env.example` 中的配置到系统环境变量。项目兼容 OpenAI Chat Completions 格式，可连接支持该协议的模型服务。

```text
LLM_API_KEY=your_key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

当前版本不自动读取 `.env` 文件，避免引入依赖。可以在终端设置环境变量后启动。未配置密钥时，核心演示和自动化测试不受影响。

## 核心流程

```text
阅读材料
   ↓
脱离材料主动讲述
   ↓
概念覆盖 / 遗漏 / 误解诊断
   ↓
每次只修正一个局部缺口
   ↓
按需升级四级帮助
   ↓
记录提示依赖并生成复习卡
   ↓
延时主动提取与成长报告
```

## 项目结构

```text
ThinkLand/
├─ data/materials.json          # 结构化学习材料与知识点
├─ docs/
│  ├─ PRD.md                    # 产品需求文档
│  ├─ PRODUCT_RULES.md          # 25 条核心规则
│  └─ EVALUATION_PLAN.md        # 用户测试与指标方案
├─ lib/
│  ├─ analysis-engine.js        # 可解释诊断与复习策略
│  └─ llm-coach.js              # 可选模型反馈与安全边界
├─ public/
│  ├─ index.html                # 产品界面
│  ├─ styles.css                # 响应式视觉系统
│  └─ app.js                    # 交互与本地学习记录
├─ tests/analysis-engine.test.js
├─ server.js                    # Node.js API 与静态服务
└─ package.json
```

## 当前边界

- 这是用于产品验证的 MVP，不是面向儿童正式商业发布的教育服务；
- 浏览器本地保存学习记录，不上传儿童个人信息；
- 内置材料与规则用于演示，正式上线前需由教育专家进一步审核；
- 真实效果指标必须经过监护人知情同意下的用户测试后再披露。

## 产品文档

- [完整 PRD](docs/PRD.md)
- [25 条核心产品规则](docs/PRODUCT_RULES.md)
- [用户测试与评测计划](docs/EVALUATION_PLAN.md)
- [概念调研与访谈计划](docs/RESEARCH_PLAN.md)
- [用户测试记录模板](docs/TEST_RECORD_TEMPLATE.md)

## License

MIT

