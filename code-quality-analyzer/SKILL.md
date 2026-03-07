---
name: code-quality-analyzer
description: >
  Evaluates codebase quality across three dimensions: security, efficiency, and human readability.
  Produces a scored report with specific, actionable findings for each dimension.

  Use this skill whenever the user asks to review, audit, analyze, or assess the quality of code
  or a codebase — even if they don't use the word "analyze". Trigger on phrases like "how good is
  my code", "review this for issues", "check my code", "audit the codebase", "what's wrong with
  this code", "is this code production-ready", "code review", or any request to evaluate code
  quality, security posture, performance, or readability/maintainability.
---

# Code Quality Analyzer

You are performing a structured code quality evaluation. Your job is to read the target code
thoroughly and produce an honest, specific, actionable report — not a generic checklist.

## What to analyze

Evaluate across three dimensions. For each dimension, give a score from 1–10 and list specific
findings with file names and line numbers where possible.

---

### 1. Security (score /10)

Look for real vulnerabilities that could be exploited or cause harm in production. Think like an
attacker — what could go wrong? Focus on:

- **Injection risks**: SQL injection, command injection, path traversal, template injection
- **Authentication & authorization flaws**: missing auth checks, broken session handling, privilege escalation
- **Hardcoded secrets**: API keys, passwords, tokens baked into source code
- **Input validation gaps**: user-controlled data reaching dangerous sinks without sanitization
- **Dependency risks**: known-vulnerable packages, outdated deps with CVEs
- **Exposure of sensitive data**: logging passwords, leaking stack traces, insecure storage
- **XSS / CSRF** (for web code): unescaped output, missing CSRF tokens
- **Cryptography misuse**: weak algorithms, insecure random, improper key handling

For each finding, explain *why* it's a risk and what an attacker could do with it.

---

### 2. Efficiency (score /10)

Look for code that wastes time, memory, or compute — especially things that would hurt at scale.
Think about what happens when the input is large or the code runs millions of times. Focus on:

- **Algorithmic complexity**: O(n²) or worse where O(n log n) or O(n) is possible
- **Redundant work**: recomputing the same result in a loop, unnecessary repeated I/O or DB queries
- **Memory issues**: unbounded growth, accumulating large datasets in memory, leaks via unclosed resources
- **Blocking operations**: synchronous I/O in async contexts, unparallelized work that could run concurrently
- **Database inefficiency**: N+1 queries, missing indexes, fetching more columns/rows than needed
- **Caching opportunities**: expensive computations that are pure and could be memoized
- **External call efficiency**: API calls, HTTP requests, webhook calls, or any network I/O made in loops, on every request, or without batching/caching. Too many outbound calls is a common and serious production problem — a function that calls an external API once per item in a list will grind to a halt at scale. Look for: calls inside loops that could be batched, repeated calls to the same endpoint that could be cached, missing connection reuse (e.g., creating a new HTTP client per request), no timeout or retry budget, and synchronous sequential calls where parallel requests would work.

For each finding, explain the real-world impact (e.g., "this becomes O(n²) with 10k records, causing 100x slowdown"; "calling the payments API once per order item means 500 API calls for a cart with 500 items").

---

### 3. Human Readability (score /10)

Look for things that make the code hard to understand, maintain, or onboard onto. Code is written
once but read many times — readability is not cosmetic. Focus on:

- **Naming**: variables, functions, and classes named with cryptic abbreviations, misleading names, or single letters
- **Function/class size**: functions doing too many things (hard to test and reason about)
- **Complexity**: deeply nested logic, long chains of conditions, convoluted control flow
- **Comments & documentation**: missing explanations for non-obvious logic, or misleading/outdated comments
- **Consistency**: mixed styles, inconsistent patterns, surprising deviations from conventions
- **Magic values**: hardcoded numbers or strings with no explanation of what they represent
- **Dead code**: unused variables, commented-out blocks, unreachable branches

For each finding, explain what makes it hard to read and how it could be improved.

---

## Report format

Always produce your report in this exact structure:

```
# Code Quality Report: [project/file name]

## Summary
[2-3 sentences on the overall state of the codebase. Be direct and honest.]

## Scores
| Dimension        | Score | Grade |
|-----------------|-------|-------|
| Security        |  X/10 |  [A-F] |
| Efficiency      |  X/10 |  [A-F] |
| Readability     |  X/10 |  [A-F] |
| **Overall**     |  X/10 |  [A-F] |

Grading scale: 9-10 = A, 7-8 = B, 5-6 = C, 3-4 = D, 1-2 = F

---

## Security [X/10]

### Critical
[List findings that could lead to direct exploitation — CVSS 7+]

### Moderate
[Findings that increase attack surface or create indirect risk]

### Minor
[Low-risk issues, best-practice gaps]

---

## Efficiency [X/10]

### High Impact
[Findings that would cause real slowdowns or failures at scale]

### Medium Impact
[Inefficiencies that matter as usage grows]

### Low Impact
[Minor waste or missed optimization opportunities]

---

## Readability [X/10]

### Major Issues
[Things that meaningfully slow down understanding]

### Minor Issues
[Smaller style/consistency issues]

---

## Top Recommendations
1. [Most important fix, any dimension]
2. [Second most important]
3. [Third most important]
4. ...up to 5 total, ordered by impact

---

## What's Working Well
[Genuine positives — don't skip this. Balanced feedback is more useful than pure criticism.]
```

## How to conduct the analysis

1. **Read all the code first** before scoring anything. Don't jump to conclusions from the first file.
2. **Be specific**: "line 47 in `auth.py` passes `user_input` directly to `cursor.execute()`" is useful. "There are SQL injection risks" is not.
3. **Be honest about severity**: don't inflate findings to seem thorough, and don't soften real problems to seem polite.
4. **Calibrate scores to real-world standards**: a score of 7/10 for security means the code is genuinely solid — not that it's merely not catastrophic. Reserve 9-10 for code that's clearly been written with care.
5. **Don't penalize for language/framework choices** unless those choices directly cause issues.
6. If the user only provided a single file or snippet, note this and caveat that a full codebase audit might surface additional issues.
