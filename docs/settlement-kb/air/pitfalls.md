# 机票结算排查 — 已知坑

本文汇总缺单与对账时容易误判的**事实性陷阱**（非完整 playbook）。逐步核对见 [missing-order-playbook.md](./missing-order-playbook.md)；表与字段见 [tables.md](./tables.md)。

背景材料（只读、勿复制脚本内连接配置）：`ticket-report-investigation/机票结算报表导出新增产品类型字段-开发说明.md`。

---

## 1. 报表「政策类型」≠ 业务「产品类型」

`financenewdb.airreport.PolicyProductType` 的 DB 注释为**政策类型**，实测取值如「大客户政策」或空串，与订单侧政策来源（如 `PolicySource`）口径相近，**不是** CRM/业务口语里的「产品类型」。

业务侧产品类型名称在出票月表 **`airticket.airoutorderinfoYYYYMM.ProductTypeName`**（编码列为 `ProductType`）。整表导出 `excelWhole` 只读 `airreport` 单表，**表内没有**可用的产品类型列；若用 `PolicyProductType` 对账或解释缺列，会张冠李戴。

---

## 2. DB 注释枚举 ≠ 线上 `ProductTypeName`

出票表 `ProductType` 的 DB 注释常见为 `0/1/2`（普通 / 航司官网 / 大客户），但线上 **`ProductTypeName` 是展示名**（如「商务推荐」「航司直销」「大客户协议价」），且存在注释**未覆盖**的编码：**4 → 商旅优选、5 → 公务票**（2026-09 实测分布见开发说明）。

排查或导出设计时：**以 `ProductTypeName` 原值为准**，勿在代码或手工 SQL 里只映射 `0/1/2`，否则会漏 4/5；同编码 `2` 还可能同时出现「大客户协议价」与「协议价」两种写法，属源数据并存，非单号异常。

---

## 3. 退改退票号往往不在出票月表

退款成功、改签成功、退票成功等状态常使用**独立 `OrderID`**，该单号在 `airoutorderinfo`（及同月 `airorderinfo` / `airpassengerinfo`）中**可能 0 行**——不是「查错表」的唯一解释。报表侧每行通常带 **`LinkOrderID`**（指向原出票单），应用其回连再查业务月表与 `ProductTypeName`（见 [tables.md](./tables.md) → 关联与排查注意）。

若在 P1/P3 只按用户给的退改单号查出票表为空，而 P2 在 `airreport` 已有行，先读 `LinkOrderID` 再定 `:shard`，避免误判为「业务单不存在」。详见 playbook **[P2](./missing-order-playbook.md)**、**[P3](./missing-order-playbook.md)**。

---

## 4. 未分形态 A/B 就讨论补录

「缺单」在库表上可能是 **A — `airreport` 无行**（生成链路未落库），也可能是 **B — 有行但被 CRM 筛选 / 状态隐藏**（读路径与页面条件问题）。未在 **[P0 / P2](./missing-order-playbook.md)** 收敛形态前，不应默认「缺一行就要 INSERT 补录」：形态 B 补录会制造重复或掩盖筛选 bug；形态 A 的根因也可能是月表 shard 错误（P4.1）或出票链不完整（P4.2），而非简单缺 insert。

只读排查原则见 playbook 文首；补录需用户另开任务，本文档不包含写库步骤。

---

## 5. 单号异常时要做「对照样本」

个案无法解释时，应用**同时间段、同订单类型/公司范围**的 peer 订单在 `airreport` 是否正常，以区分「全链路挂了」与「单笔边缘数据」。例如国际或特殊 `OrderTypeName` 可对照同时段同类样本是否普遍无行（playbook **[P4.4](./missing-order-playbook.md)**）；形态 A 在 P4.3 怀疑写入任务时，也可看相邻日期、同公司产品是否批量缺失。

对照时固定记录：样本 `OrderID`、`DataDate`/`BookTime`、页面筛选条件是否与个案一致；若 peer 均有行而个案无行，再回 P3 看出票链与 `LinkOrderID`，避免只盯单笔 SQL 误伤。

---

## 相关文档

| 文档 | 用途 |
|---|---|
| [missing-order-playbook.md](./missing-order-playbook.md) | P0–P6 逐步排查 |
| [tables.md](./tables.md) | 月表、`LinkOrderID`、字段说明 |
| [pipeline.md](./pipeline.md) | 形态 A/B、读路径与写入侧缺口 |
