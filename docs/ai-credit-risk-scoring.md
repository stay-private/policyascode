# Model Card: Credit Risk Scoring v3.2

**Owner:** Risk Analytics Team
**Date:** 2025-08-01
**Approved By:** Chief Risk Officer (CRO)
**Business Line:** Retail Lending

---

## Intended Use

This model is designed to predict the probability that an individual loan applicant will default within the next 12 months. The score is used as an **input to credit decisioning**, alongside other criteria such as manual underwriter review, credit bureau scores, and fraud detection checks.

- **In-Scope Use:** Consumer lending, personal loans, credit cards.
- **Out-of-Scope Use:** SME, corporate, mortgage underwriting, collections prioritization.
- **Decision Authority:** Final decision always rests with human underwriters.

---

## Model Overview

- **Algorithm:** Gradient Boosted Trees (XGBoost v1.7.3)
- **Training Data:** 1.2M anonymized credit bureau + transactional records from 2019–2023.
- **Feature Classes:**
  - Borrower demographics (age, employment length, income stability).
  - Credit behavior (revolving utilization, delinquency counts, credit history length).
  - Bank transactional data (cash inflows, spending variability).
- **Target Variable:** Default (missed 3+ payments within 12 months).
- **Sampling Strategy:** Stratified sampling with oversampling of minority default cases (SMOTE).

---

## Performance Metrics

- **AUC ROC:** 0.82 (holdout test).
- **KS Statistic:** 0.42.
- **Gini:** 0.64.
- **Calibration:** Predicted vs. observed default rates within ±5% across all deciles.
- **Benchmark:** Outperforms baseline bureau score by +8% AUC.

---

## Fairness and Bias Checks

- **Protected Groups Analyzed:** Age bands, Gender, Ethnicity (where available).
- **Metrics Used:** Demographic parity difference, equal opportunity difference, disparate impact ratio.
- **Results:**
  - False-negative rate higher for <25 age group (+4%).
  - No significant disparity across gender.
  - Ethnicity gaps could not be fully assessed (limited data availability).
- **Mitigation:** Plan to retrain with fairness constraints Q4 2025.

---

## Explainability

- **Global:** SHAP feature importance published in risk repository.
  - Top drivers: Debt-to-income ratio, delinquency history, revolving utilization.
- **Local:** LIME explanations shown to underwriters in case review portal.
- **Limitations:** Non-linear interactions hard to explain at times; explanations must be contextualized by analysts.

---

## Governance and Monitoring

- **Validation:** Independent Model Validation Unit report #VR-2025-07, signed-off 2025-07-15.
- **Monitoring:** Drift tracked monthly via PSI; thresholds set at 0.2 for action, 0.1 for alert.
- **Change Log:** Every retraining version stored in Git + MLflow, with model card snapshot and data lineage hash.
- **Human Oversight:** Underwriters can override model scores; override frequency reported quarterly to Board Risk Committee.
- **Escalation:** Model drift or fairness breaches escalate to Model Risk Committee within 30 days.

---

## Limitations

- Biased against applicants with thin credit files (e.g., recent immigrants, young adults).
- May underperform during rapid economic regime shifts (e.g., COVID-like shocks).
- Reliance on bureau data can embed historical structural biases.

---

## Documentation and References

- Full validation pack: Internal repo `model-governance/credit-risk/v3.2/validation.pdf`
- Board presentation: July 2025 Board Risk Committee deck.
- Regulation Mapping: EU AI Act Annex III (creditworthiness models), PRA SS1/23.

---
