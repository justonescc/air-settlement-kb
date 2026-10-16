# 机票结算「缺单」排查 playbook

按固定步骤 **P0–P6** 核对「有业务订单但结算报表看不到」或「报表应有却无行」类问题。业务线限定**机票**；示例 SQL 仅用占位符 `?`，不含连接信息。

**前置阅读：**

- 库表与月分表规则：[tables.md](./tables.md)
- 读路径、失败形态 A/B、写入侧缺口：[pipeline.md](./pipeline.md)

**原则：** 只读排查；不在本文档内执行补录或写库。若需补录，请用户另开任务。

---

### P0 — 确认问题形态（A vs B）

在拿到 **OrderID** 后，先记录用户侧现象（页面路径见 [pipeline.md](./pipeline.md) → CRM 新结算账单 → 机票）：

| 用户描述 | 暂定形态 | 说明 |
|---|---|---|
| 导出 / 列表都没有该单 | 待 P2 收敛 | 可能是 **A 表无行**，也可能是 **B 有行但被筛选隐藏** |
| 同事 / 别的条件能看到 | 倾向 **B** | 仍须 P2 以库表为准 |
| 业务侧称「根本没有这单」 | 先 P1 | 可能 **非结算报表问题**（订单不存在或非标单号） |

**P0 产出：** 记录 OrderID、页面筛选条件（公司、日期、账单状态等）、导出参数是否与页面一致。  
**收敛点：** P2 查 `financenewdb.airreport` 后，将形态定为 **A 表无行**、**B 有行不可见** 或 **非报表问题**（P1 失败）。

---

### P1 — 订单是否存在（业务层）

确认该 OrderID 在统一订单与机票主单月表中至少有一处命中；否则停止报表链路排查。

**1）统一订单**

```sql
SELECT OrderID, /* 业务线、公司等业务字段 — 列名以实际表结构为准 */
FROM unifiedorderdb.orderinfo
WHERE OrderID = ?;
```

**2）机票主单（月表）**

- 由订单号**前 4 位**得到 `YYMM`，月表后缀为 **`20` + YYMM**（与 [tables.md](./tables.md) 一致）。
- **示例：** 订单号以 `2609…` 开头 → 查 `airticket.airorderinfo202609`。

```sql
-- 表名 YYYYMM = '20' + 订单号前 4 位，例如 202609
SELECT OrderID, /* 状态、预订时间等 — 以实际列为准 */
FROM airticket.airorderinfoYYYYMM
WHERE OrderID = ?;
```

**期望：** `orderinfo` 或对应月表 `airorderinfoYYYYMM` **至少一行**。

**若均无命中：**

- **结论方向：** **非结算报表问题**（单号错误、非机票、或订单未落库）。
- **动作：** 与用户核对 OrderID、业务线；不必继续 P2–P5（除非用户坚持报表侧仍有疑点，则仍可做 P2 排除）。

**边界：** 极老单（2016 前）月表回落规则见 [tables.md](./tables.md)；空 OrderID 不可用于分表。

---

### P2 — 结算报表是否有行（形态分叉）

以 `OrderID` 查结算报表（与页面 / 导出主键维度一致）：

```sql
SELECT OrderID, LinkOrderID, DataDate, OrderStatus, CompanyID, CompanyName,
       BookTime, OrderTypeName, BillStatus, AccountSubStatus,
       OrderAmount, PayAmount, AddTime, OrderSource
FROM financenewdb.airreport
WHERE OrderID = ?;
```

**说明：** 工程 Mapper 常写未限定库名的 `airreport`，与 `financenewdb.airreport` 为同一张表（见 [tables.md](./tables.md)）。若环境习惯过滤逻辑删除，可额外加 `AND IsDelete = 0` 与线上一致。

| 结果 | 形态 | 下一步 |
|---|---|---|
| **0 行** | **A — 表内无行** | → **P3**（业务证据）→ **P4**（根因分支） |
| **≥ 1 行** | **B — 表内有行** | → **P5**（筛选 / 状态 / 读路径） |

**LinkOrderID 提示：** 退款 / 改签 / 退票等可能使用**新 OrderID**；若 P1 主单月表无行但 P2 有行，核对 `LinkOrderID` 并用其回查业务月表（见 [tables.md](./tables.md)）。

---

### P3 — 形态 A：同月业务表证据

在 P1 已确定的 `:shard` 下，收集出票链路与票号线索，**不臆造**「必须达到某状态才入报表」的规则（官方写入条件 **待补**，见 [pipeline.md](./pipeline.md)）。

**乘客月表**

```sql
SELECT OrderID, /* 票号、乘客、出票状态等 — 以实际列为准 */
FROM airticket.airpassengerinfoYYYYMM
WHERE OrderID = ?;
```

**出票 / 供应商月表**

```sql
SELECT OrderID, /* ProductTypeName、出票侧状态等 — 以实际列为准 */
FROM airticket.airoutorderinfoYYYYMM
WHERE OrderID = ?;
```

**记录建议：**

- 三表（`airorderinfo` / `airpassengerinfo` / `airoutorderinfo`）行数与关键状态、票号、产品类型。
- 若为新单号类业务（改签退票等），是否需用 P2 的 `LinkOrderID` 换 `:shard` 再查。
- 国内出票：`airoutorderinfo` 与 `airreport` 出票类行约 **1:1**（见 [tables.md](./tables.md)）；出票表 0 行是 P4.2 的重要信号。

---

### P4 — 形态 A：根因分支

在 P1–P3 证据基础上归类；无法归类时保留证据并标 **原因未归类**。

| 分支 | 如何验证 | 若成立 |
|---|---|---|
| **P4.1 月表查错** | 对比 `BookTime`（P2 若有则先用业务侧预订时间）、订单号前缀与 `:shard` 是否一致；尝试相邻 `YYYYMM` 月表 | 修正 shard 后 **重跑 P1–P2** |
| **P4.2 出票链不完整** | P3 中 `airoutorderinfo` **0 行**（且非 LinkOrderID 可解释的新单号场景） | 可能不满足入报表采集条件 — **写入准入规则待补**（见 [pipeline.md](./pipeline.md)） |
| **P4.3 写入任务未跑 / 失败** | 确认离线/定时写入 `airreport` 的任务是否执行成功 — **任务名待补**；可在有权限时于调度平台（如 xxl-job）按订单号或日期检索相关 job 日志，**无需也不应在文档中写账号口令** | 升级运维 / 开发查生成侧；`finance-service` 存在 `AirReportMapper.xml` → `<insert id="insertBatch">`，但 **调用方仍待补**，不能表述为「工程无 insert」 |
| **P4.4 国际路径** | P2 `OrderTypeName` 等国际特征；抽同类订单在 `airreport` 的 cohort 是否有行 | 记录与国内路径差异；国际数据源与映射 **待补**（见 [tables.md](./tables.md)） |
| **P4.5 其他** | 以上均不成立 | **原因未归类** + 附 P1–P3 查询摘要 |

**写入侧（只读结论）：** 生成链路为「业务月表 → （**待补** caller/job）→ `insertBatch` / 等价写入 → `airreport`」。形态 A 应沿此方向向上游查，而非仅查 `excelWhole` 读路径（[pipeline.md](./pipeline.md)）。

---

### P5 — 形态 B：有行但 UI / 导出不可见

`airreport` 已有该 `OrderID`，但 CRM 列表或导出没有 — 优先 **筛选与状态**，而非生成链路。

**核对清单（与页面条件逐项对比）：**

| 维度 | 建议 |
|---|---|
| `BillStatus` / `AccountSubStatus` | 是否被页面「账单状态 / 子状态」过滤 |
| `DataDate` vs `BookTime` | 页面日期筛选常对齐 `DataDate`；导出参数是否与列表一致 |
| `CompanyID` / `CompanyName` | 是否与 CRM 当前公司范围一致 |
| `OrderSource` | 来源筛选是否排除该单 |
| `OrderStatus` / `OrderTypeName` | 退款、改签等是否在 UI 有额外隐藏逻辑（**待补**前端规则时以库表字段为准） |

**读路径：** 列表与整表导出均来自对 `airreport` 的只读查询；整表导出链见 [pipeline.md](./pipeline.md)（`GET /api/finance/airreport/excelWhole` → `AirReportServiceImpl.excelWhole` → 单表 `airreport`）。若库表有行而接口无行，对比**前端查询接口入参**与 `excelWhole` 入参（具体接口 **待补**）。

**动作：** 调整筛选复现；若确认应展示仍不可见，带 P2 行数据（含上述字段）提交前端 / finance-service 排查。

---

### P6 — 输出排查结论

将 P0–P5 结果写入下列模板（字段名保持不变）：

## 排查结论
- **OrderID:**
- **形态:** A 表无行 | B 有行不可见 | 非报表问题
- **根因分类:** P4.x / P5 / 其他 / 待补
- **证据:** （关键查询结果摘要）
- **建议动作:** （只读建议；补录需用户另开任务）
- **未决 / 待补:**

---

## 步骤速查

```text
P0 记录现象与筛选
 → P1 订单是否存在（否 → 非报表问题 / 停止）
 → P2 airreport 行数（0 → A → P3 → P4 | ≥1 → B → P5）
 → P6 填写「排查结论」
```
