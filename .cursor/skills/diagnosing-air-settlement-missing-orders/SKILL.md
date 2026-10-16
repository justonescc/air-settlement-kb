---
name: diagnosing-air-settlement-missing-orders
description: >-
  Use when investigating why an air ticket order is missing from the settlement
  report (financenewdb.airreport), or exists in airreport but not visible in CRM
  机票结算账单 / export. Triggers: 结算报表缺单, 未产出, 没有跑出, airreport,
  机票结算, OrderID 查不到报表.
---

# 机票结算「缺单」诊断

只读排查；不在本 skill 内执行补录或写库。

## 何时启用

用户描述结算报表缺单、未产出、CRM 机票结算看不到某 OrderID，或需要核对 `financenewdb.airreport` 与页面/导出是否一致时，**先读本 skill**，再加载知识库逐步执行。

## 前置条件

- **OrderID 必填。** 用户未提供时，先询问 OrderID（及页面筛选：公司、日期、账单状态、导出是否与列表一致），再开始诊断。
- 连接信息仅来自用户本地环境；**禁止**在回复或命令中打印/粘贴密码、主机、连接串。

## 知识库（repo 根相对路径）

| 顺序 | 文档 | 用途 |
|---|---|---|
| 1 | [docs/settlement-kb/air/pipeline.md](../../../docs/settlement-kb/air/pipeline.md) | 先 skim：读路径、形态 A/B、CRM 入口 |
| 2 | [docs/settlement-kb/air/tables.md](../../../docs/settlement-kb/air/tables.md) | 按需：库表、月分表、关键字段 |
| 3 | [docs/settlement-kb/air/missing-order-playbook.md](../../../docs/settlement-kb/air/missing-order-playbook.md) | **主流程**：严格按 **P0 → P6** 执行 |
| 4 | [docs/settlement-kb/air/pitfalls.md](../../../docs/settlement-kb/air/pitfalls.md) | 卡住或结论含糊时阅读 |

索引：[docs/settlement-kb/air/README.md](../../../docs/settlement-kb/air/README.md)

## 编排规则

1. **P0** — 记录现象与用户筛选；形态在 **P2** 后收敛为 A / B / 非报表问题。
2. **P1** — 业务订单是否存在；均无命中 → **非报表问题**，通常不必继续 P2–P5（除非用户坚持）。
3. **P2** — `financenewdb.airreport` 是否有行：**0 行 → A**（P3 → P4）；**≥1 行 → B**（P5）。
4. **P3–P4** — 仅形态 A：业务侧证据与根因分支（P4.x）；**不得**在未完成 P0–P2 分类前跳到补数据。
5. **P5** — 仅形态 B：对照页面筛选与 P2 行字段（BillStatus、DataDate、公司等）。
6. **P6** — 用下方结论模板输出（字段名不变）。

SQL 与核对清单以 playbook 为准；**不要**在本 skill 中复制完整 SQL。表名、作业名若 KB 标注 **待补**，结论中如实写 **待补**，勿臆造。

## 禁止事项

- 跳过 A/B 分类直接建议 INSERT / 补录。
- 未经用户**另开补录任务**而执行写库 SQL。
- 发明 KB 未记载的表、定时任务或接口名。

## 结论契约（P6，必填）

诊断结束时，回复**必须**包含下列结构（与 playbook 一致）：

```markdown
## 排查结论
- **OrderID:**
- **形态:** A 表无行 | B 有行不可见 | 非报表问题
- **根因分类:** P4.x / P5 / 其他 / 待补
- **证据:** （关键查询结果摘要）
- **建议动作:** （只读建议；补录需用户另开任务）
- **未决 / 待补:**
```

## 步骤速查

```text
P0 记录现象与筛选
 → P1 订单是否存在（否 → 非报表问题 / 停止）
 → P2 airreport 行数（0 → A → P3 → P4 | ≥1 → B → P5）
 → P6 填写「排查结论」
```
