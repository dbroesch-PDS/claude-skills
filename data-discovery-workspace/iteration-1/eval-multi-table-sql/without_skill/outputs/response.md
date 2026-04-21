# Table Research Report

**Query analyzed:**
```sql
SELECT u.user_token, t.amount, t.created_at, r.score
FROM CASH_APP.IDENTITY.USER_PROFILES u
JOIN CASH_APP.PAYMENTS.TXN_LEDGER t ON u.user_token = t.user_token
JOIN CASH_APP.RISK.MODEL_SCORES r ON t.txn_id = r.entity_id
WHERE r.model_name = 'fraud_v3'
  AND t.created_at >= '2025-01-01'
```

**Research method:** Searched Notion workspace (with connected Slack, Google Drive, Linear sources). Checked Cash Identity Data Guide, Risk ML documentation, ledger/payments data guides, Snowflake table catalogs, and Risk ML scored events documentation.

---

## Overall Finding: These table names are not recognized

**None of the three tables (`CASH_APP.IDENTITY.USER_PROFILES`, `CASH_APP.PAYMENTS.TXN_LEDGER`, `CASH_APP.RISK.MODEL_SCORES`) appear in any internal Cash App / Block data documentation.** This is a significant red flag.

The most likely explanation is that this SQL was written using made-up or placeholder table names, or was copied from an external/generic example rather than a real Cash App notebook. It does not follow Cash App's actual Snowflake naming conventions.

---

## Key Red Flag: Wrong Database Naming Convention

Cash App's Snowflake databases use the prefix **`APP_CASH`** (or `APP_CASH_PII`, `APP_CASH_BETA`, etc.), **not** `CASH_APP`. Every real table documented internally follows this pattern:

- `APP_CASH.HEALTH.*` — identity, IDV, KYC tables
- `APP_CASH.BANKLIN.*` — transactions, ledger events
- `APP_CASH.APP.*` — payments, risk ML scored events, graph data
- `RISKARBITER.RAW_FEEDS.*` — raw risk evaluation events
- `APP_CASH.CASH_DATA_BOT.*` — DLE/ETL pipeline outputs

No `CASH_APP.*` database exists in any documented source. This alone means the SQL **will not run** without modification.

---

## Table 1: `CASH_APP.IDENTITY.USER_PROFILES`

| Field | Finding |
|---|---|
| **Recognized?** | No |
| **Likely intent** | User identity / profile data keyed on `user_token` |
| **Safe to use?** | Cannot be assessed — table not found |

**What was found instead:** The Cash App identity team maintains tables under `APP_CASH.HEALTH.*` and `APP_CASH_PII.APP.*`. The closest equivalents for user identity/profile data are:

- `APP_CASH.HEALTH.IDENTITY_IDV_ATTEMPTS` — IDV attempt info per customer token
- `APP_CASH_PII.APP.IDENTITY_PII_HISTORY` — temporal record of verified PII (name/DOB/SSN/address) per customer
- `APP_CASH_PII.APP.IDENTITY_SOURCED_CUSTOMER_NAMES` — name history by source
- `APP_CASH.HEALTH.LOOKUP_AND_ASSOCIATED_CUSTOMER_TOKENS` — token association history

Note: Cash App uses `customer_token` (prefixed `C_...`), not `user_token`, as the primary customer identifier. If the query is meant to join on customer identity, the join key itself may be wrong.

**Recommendation:** Contact the Identity Data team in `#cash-identity-data-questions`. See the [Cash Identity Data Guide](https://www.notion.so/2f888dd1cd8f423eba513b145ab65dfd) (go/identitydataguide).

---

## Table 2: `CASH_APP.PAYMENTS.TXN_LEDGER`

| Field | Finding |
|---|---|
| **Recognized?** | No |
| **Likely intent** | Payment transactions with amount and timestamp, keyed on `txn_id` and `user_token` |
| **Safe to use?** | Cannot be assessed — table not found |

**What was found instead:** Cash App transaction/ledger data lives in several places depending on the use case:

- `APP_CASH.BANKLIN.TRANSACTIONS` — primary Banklin transaction table, updated hourly. Join key is `transaction_id`, not `txn_id`.
- `APP_CASH.BANKLIN.TRANSACTION_EVENTS` — event-level Banklin data
- `APP_CASH.APP.PAYMENT_SUMMARY` — payment-level summary table with `created_at`
- `APP_CASH.APP.PAYMENTS` — payment records
- `APP_CASH.CASH_DATA_BOT.LEDGER_EVENTS` — ledger events (2023-present), updated daily

The `PAYMENTS` schema does not exist; the `TXN_LEDGER` table name matches nothing documented. The column `txn_id` also does not match known join keys (`transaction_id`, `payment_token`, etc.).

**Recommendation:** For payment transactions, use `APP_CASH.BANKLIN.TRANSACTIONS` or `APP_CASH.APP.PAYMENT_SUMMARY`. See the [Querying Banklin Ledger Data guide](https://www.notion.so/72991352af904c82a9acf37149b82da8) and ask in `#cash-finplat-help`.

---

## Table 3: `CASH_APP.RISK.MODEL_SCORES`

| Field | Finding |
|---|---|
| **Recognized?** | No — this exact table does not exist |
| **Likely intent** | Risk model scores per transaction/entity, with `model_name` filter (e.g., `'fraud_v3'`) and `entity_id` join key |
| **Safe to use?** | Cannot be assessed — table not found |

**What was found instead:** Risk model scores at Cash App live in:

- `APP_CASH.APP.RISK_ML_SCORED_EVENTS` — the current canonical unified table for all Cash Risk ML model evaluations. Contains score, bounds, disqualifiers, `model_name`, `trigger_def_token`, and `created_at`. Clustered on `model_name`, `trigger_def_token`, and `datepartition` for performance. This is the recommended replacement for older disparate tables.
- `RISKARBITER.RAW_FEEDS.SCORED_EVENTS` — raw scored events from RiskArbiter
- `APP_CASH.APP.RISK_ML_DISTINCT_EVENT_KEYS` — slimmed table of distinct event keys per model/date

**On `fraud_v3` specifically:** The model name `fraud_v3` was not found in any internal documentation. Current production fraud models use names like `wire_fraud_model_full_bad_2024plus`, `gondola-check-deposit-fraud-model-v3`, and similar structured names. A generic `fraud_v3` identifier does not match any currently active or recently documented model. It may refer to a very old, deprecated model or may be a fictional name from a generic example.

**Recommendation:** Use `APP_CASH.APP.RISK_ML_SCORED_EVENTS` filtered on `model_name`. To find valid model names, query `SELECT DISTINCT model_name FROM APP_CASH.APP.RISK_ML_SCORED_EVENTS LIMIT 100` or consult the Risk ML team in `#cash-ml-risk-help`. See the [Risk ML Scored Events Table doc](https://www.notion.so/d0f756be5df94e4b9b05646d5b2a90bf).

---

## Safety Assessment

| Table | Exists? | Safe to use? | Recommended replacement |
|---|---|---|---|
| `CASH_APP.IDENTITY.USER_PROFILES` | Not found | Cannot use | `APP_CASH_PII.APP.IDENTITY_PII_HISTORY` or `APP_CASH.HEALTH.IDENTITY_IDV_ATTEMPTS` |
| `CASH_APP.PAYMENTS.TXN_LEDGER` | Not found | Cannot use | `APP_CASH.BANKLIN.TRANSACTIONS` or `APP_CASH.APP.PAYMENT_SUMMARY` |
| `CASH_APP.RISK.MODEL_SCORES` | Not found | Cannot use | `APP_CASH.APP.RISK_ML_SCORED_EVENTS` |

**The SQL as written will fail.** The query uses a non-existent database prefix (`CASH_APP` vs `APP_CASH`), non-existent schemas (`IDENTITY`, `PAYMENTS`, `RISK`), and non-existent table names. The model name `fraud_v3` also does not correspond to any currently documented active model.

**Do not use this SQL for production analysis without fully rewriting it against verified current tables.**

---

## Suggested Next Steps

1. Clarify what the original author intended this query to do (join user profiles, payment amounts, and fraud scores).
2. Rewrite using the current equivalents:
   - User identity: `APP_CASH.HEALTH.IDENTITY_IDV_ATTEMPTS` (use `customer_token` not `user_token`)
   - Transactions: `APP_CASH.BANKLIN.TRANSACTIONS` or `APP_CASH.APP.PAYMENT_SUMMARY`
   - Risk scores: `APP_CASH.APP.RISK_ML_SCORED_EVENTS` with the correct `model_name`
3. Confirm the correct fraud model name with the Risk ML team (`#cash-ml-risk-help`).
4. Verify data access/permissions — identity PII tables (`APP_CASH_PII.*`) require additional Snowflake access grants.

---

## Sources Consulted

- [Cash Identity Data Guide (go/identitydataguide)](https://www.notion.so/2f888dd1cd8f423eba513b145ab65dfd) — Notion, updated 2026-04-13
- [Querying Banklin Ledger Data](https://www.notion.so/72991352af904c82a9acf37149b82da8) — Notion, updated 2025-12-12
- [Risk ML Scored Events Table](https://www.notion.so/d0f756be5df94e4b9b05646d5b2a90bf) — Notion, updated 2025-03-19
- [Snowflake Risk Score and BTC Tables](https://www.notion.so/594c5081cb2d4a2a94272b451e2242d9) — Notion (legacy, 2021)
- [2025-Q4 Wire Transfer Risk Model Scores Analysis](https://www.notion.so/2c654e8e103180a1a919d550ed6ec010) — Notion, updated 2026-03-02
- [Cash Risk ML hub](https://www.notion.so/18c4578e50174afca12683d3e29cbc88) — Notion
- [Risk Labs](https://www.notion.so/db30da70f52b47a297f41b90f780fa56) — Notion
