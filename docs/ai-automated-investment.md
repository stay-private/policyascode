# Model Risk Assessment Report: Automated Investment Suitability Recommender

**Model ID:** INV-SUIT-001
**Prepared By:** Model Risk Management Team
**Date:** 2025-06-20
**Business Owner:** Wealth Management Division
**Risk Tier:** High (per EU AI Act classification)

---

## Executive Summary

The **Automated Investment Suitability Recommender (AISR)** matches retail clients to investment funds and portfolios based on KYC information, transaction history, and risk appetite surveys.
This assessment evaluates the model against the **EU AI Act**, **PRA SS1/23**, and **NIST AI RMF 1.0**.

**Overall Assessment:** High Risk, acceptable for deployment **with conditions**.
- Strengths: Transparency, documented governance, consistent advisor oversight.
- Weaknesses: Limited coverage of younger investors, inconsistent override logging.

---

## Governance Framework

- **Applicable Regulations:** EU AI Act (Articles 6–10), PRA SS1/23, NIST AI RMF.
- **Risk Committee Involvement:** Reviewed by Model Risk Committee on 2025-06-15.
- **Classification:** High Risk AI system (financial decision-making).

---

## Risk Areas and Controls

### 1. Data Governance
- **Inputs:**
  - Customer suitability questionnaires.
  - Historical product performance data.
  - Demographics (age, income, location).
- **Controls:**
  - Automated scripts for missing/illogical questionnaire responses.
  - Quarterly review by Compliance of product mapping rules.
- **Findings:** Questionnaire wording may bias toward risk-averse selections.

### 2. Transparency
- **Requirement:** Explain recommendations in plain language.
- **Implementation:** Each recommendation includes a rationale string visible to clients.
- **Gap:** Clients report rationales are too generic (e.g., “based on your risk profile”).

### 3. Human Oversight
- **Requirement:** No autonomous execution of recommendations.
- **Implementation:** Advisors must approve each recommendation.
- **Gap:** Advisor override reasons only logged in 65% of cases; inconsistent analysis.

### 4. Monitoring
- **Requirement:** Monitor drift, outcomes, fairness.
- **Implementation:** Quarterly back-testing against actual portfolio performance.
- **Thresholds:** Alert when portfolio recommendation distributions deviate by >10% vs. baseline.

---

## Independent Validation Findings

- **Accuracy:** 78% alignment with advisor selections.
- **Stress Tests:** Degraded to 60% alignment during synthetic “market shock” scenario.
- **Fairness:** Under-recommends high-growth funds to clients <30 years old.

---

## Residual Risks

- Potential systematic underperformance for younger investors.
- Over-reliance on historical fund returns as proxy for future suitability.
- Insufficient advisor override analytics.

---

## Recommendations

1. Enhance rationale generator with specific fund-level explanations.
2. Implement mandatory override reason capture.
3. Conduct annual fairness audit on age-related outcomes.
4. Simulate market stress scenarios quarterly.

---

## Appendices

- Appendix A: Regulation mapping matrix (EU AI Act ↔ NIST ↔ PRA).
- Appendix B: Back-testing methodology.
- Appendix C: Advisor override analysis dashboards.

---
