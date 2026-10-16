# 机票结算相关库表

本文汇总「缺单」排查时常用的库表、月分表规则，以及 `airreport` 上用于对账的关键字段。业务线限定为**机票**（国内 / 国际）；连接信息不进文档，示例 SQL 使用占位符。

与链路说明的关系：读路径与失败形态见 [pipeline.md](./pipeline.md)。

## 库表一览

| 层 | 表 | 用途 |
|---|---|---|
| 统一订单 | `unifiedorderdb.orderinfo` | 订单是否存在、业务线、公司 |
| 机票主单 | `airticket.airorderinfoYYYYMM` | 订单本体 |
| 乘客 | `airticket.airpassengerinfoYYYYMM` | 票号、出票相关 |
| 出票/供应商 | `airticket.airoutorderinfoYYYYMM` | 出票侧；与 `airreport` 出票单约 1:1 |
| 结算报表 | `financenewdb.airreport` | 是否已入报表 |
| 可选对照 | `financenewdb.ticket_channel_bill` | BSP 等通道账单 |

**Schema 说明：** 工程内 MyBatis（如 `AirReportMapper.xml`）常写未限定库名的 `airreport`；与文档中的 `financenewdb.airreport` 为**同一张表**，文档加库名仅为阅读时区分数据源。

## 月分表（shard）规则

机票业务表按**订单号**路由到月表，命名规则：

- **表名** = 逻辑表前缀 + `20` + 订单号**前 4 位**（`YYMM`）
- **示例：** 订单号以 `2609…` 开头 → `airorderinfo202609`、`airoutorderinfo202609` 等

工程内封装（引用即可，排查时按同一规则手算表名）：

| 工具 | 位置 / 作用 |
|---|---|
| `TableUtils.getTableName(String tableName, String orderID)` | `finance-service` … `TableUtils.java`：前缀 + `20` + `orderID.substring(0, 4)` |
| `AirReportServiceImpl.setTableName(...)` | 对单次请求批量设置 `airorderinfo` / `airoutorderinfo` / `airpassengerinfo` 等月表名 |

**边界（待补）：** 2016-01-01 之前订单在 `TableUtils` 中有固定回落表名逻辑；极老单排查时需对照代码或 DBA 约定。

**空订单号：** `TableUtils.getTableName` 在 `orderID` 为空时会回落到带 `1610` 后缀的表名——排查时不应依赖该分支，应先确认有效 `OrderID`。

## `airreport` 诊断常用字段

结算报表单行以 `OrderID` 为主键维度（与页面 / 导出一致）。缺单或「有行业不可见」时，建议至少核对：

| 字段 | 排查用途 |
|---|---|
| `OrderID` | 是否与业务单号一致；形态 A 是否存在该行 |
| `LinkOrderID` | 退款 / 改签 / 退票等**独立单号**回连原出票单 |
| `DataDate` | 报表数据日期；与页面日期筛选对齐 |
| `OrderStatus` | 订单状态（含退款、改签等） |
| `CompanyID` / `CompanyName` | 公司维度；与 CRM 筛选一致 |
| `BookTime` | 预订时间 |
| `OrderTypeName` | 订单类型名称 |
| `BillStatus` | 账单状态 |
| `AccountSubStatus` | 账单子状态 |
| `OrderAmount` / `PayAmount` | 金额对账 |
| `AddTime` | 写入报表时间 |
| `OrderSource` | 订单来源 |

其他列（票号、航程、乘客等）见 `AirReportMapper.xml` 中 `Base_column_info`；全量导出读路径为单表 `airreport`，无 JOIN 业务月表。

## 关联与排查注意

### 出票表 vs 报表

- 国内出票：`airoutorderinfoYYYYMM.OrderID` 与 `airreport.OrderID` 在出票类行上约为 **1:1**（以出票单为键）。
- **退款 / 改签 / 退票**等往往使用**新订单号**，该行可能**不在** `airoutorderinfo`（及同月 `airorderinfo` / `airpassengerinfo`）中；报表侧常用 **`LinkOrderID`** 指向原出票单再查业务表。

### 统一订单层

- 先查 `unifiedorderdb.orderinfo` 可确认订单是否存在、业务线与公司，再下钻 `airticket` 月表与 `airreport`。

### 国内 vs 国际

- **国内：** 主路径为 `airorderinfo` / `airoutorderinfo` / `airpassengerinfo` 月表 + `financenewdb.airreport`。
- **国际：** 缺单排查同样优先 **主单月表 + `airreport`**；国际订单在统一订单 / 国际订单库中的表名与字段差异、与国际 `OrderID` 规则（如后缀约定）**待补**细节。已知国际行在报表中可通过 `BusinessType` 等字段区分，具体枚举与数据源映射 **待补**。

### 可选：通道账单

- `financenewdb.ticket_channel_bill` 可用于 BSP 等**通道账单**与报表交叉核对；是否覆盖全部产品 / 通道 **待补**。

## 示例查询形态（占位符）

以下仅说明字段与表名拼接方式，**不含**连接串与真实环境账号：

```sql
-- 1) 是否已在结算报表
SELECT OrderID, LinkOrderID, DataDate, OrderStatus, CompanyID, BillStatus, AccountSubStatus
FROM financenewdb.airreport
WHERE IsDelete = 0 AND OrderID = :orderId;

-- 2) 业务出票侧（:shard = '20' + 订单号前 4 位，如 202609）
SELECT OrderID, ProductTypeName
FROM airticket.airoutorderinfo:shard
WHERE OrderID = :orderId;

-- 3) 独立单号未命中出票表时，用报表 LinkOrderID 回连
SELECT OrderID, LinkOrderID FROM financenewdb.airreport
WHERE IsDelete = 0 AND OrderID = :refundOrChangeOrderId;
-- 再用 LinkOrderID 作为 :linkOrderId 查 airoutorderinfo:shardForLink
```

## 相关工程引用

| 类型 | 路径 |
|---|---|
| 报表 Mapper | `finance-service/src/main/resources/mybatis/mapper/financeservice/AirReportMapper.xml` |
| 月表工具 | `finance-service/src/main/java/com/shanglv51/finance/utils/TableUtils.java` |
| 设置 DTO 月表名 | `finance-service/.../airbillcheck/impl/AirReportServiceImpl.java` → `setTableName` |

背景材料（只读、勿复制脚本内连接配置）：`ticket-report-investigation/机票结算报表导出新增产品类型字段-开发说明.md`。
