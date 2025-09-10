# Vendor Proposal: AML-Guard v2 – AI-Driven AML Transaction Monitoring

**Vendor:** SafeAI Compliance Ltd.
**Date:** 2025-05-10
**Contact:** compliance@safeai.com

---

## Executive Overview

AML-Guard v2 is an advanced AI-powered platform designed to detect and investigate suspicious transactions in real time. It integrates directly with banks’ core systems to support compliance with **FATF 40 Recommendations**, **FCA SYSC 6.3**, and **EU AMLD6**.

---

## Functional Scope

- **Transaction Monitoring:** Graph Neural Network model detects abnormal transaction flows.
- **Case Management:** Alerts routed into analyst queue with audit trails.
- **Integration:** SWIFT, SEPA, CHAPS, card payments, and cross-border remittances supported.
- **Scalability:** 10k transactions per second, sub-200ms latency.

---

## Technical Design

- **Model Type:** Graph Neural Network with anomaly detection layers.
- **Training Data:** 5M+ labeled AML cases from multiple jurisdictions.
- **Features:**
  - Transaction velocity.
  - Geolocation anomalies.
  - Entity centrality scores.
  - Network motifs (shell company detection).
- **Pipeline:** Kafka ingestion → GNN inference → Alert scoring → Case management.

---

## Governance & Compliance

- **Explainability:** Each alert accompanied by ranked feature contributions.
- **Audit Trail:** Exportable logs (JSON/CSV) with model inputs + rationale.
- **Human Oversight:** No automatic filing of SARs; analysts always approve.
- **Data Protection:** GDPR-compliant pseudonymization; EU-only data residency options.
- **Certification:** ISO/IEC 27001 certified.

---

## Performance Metrics

- **True Positive Rate:** 85% on benchmark dataset.
- **False Positive Reduction:** 30% vs legacy rules engine.
- **Scalability:** Sustained 50M transactions/day in production pilot.
- **Case Handling:** Analyst productivity improved 20% in pilot bank.

---

## Risk & Limitations

- Requires ≥12 months local training data for fine-tuning.
- Limited coverage of non-SWIFT digital asset channels.
- Model retraining required annually to maintain FCA compliance.

---

## Implementation Roadmap

- **Phase 1 (Month 1–3):** Pilot with synthetic + anonymized transaction sets.
- **Phase 2 (Month 4–6):** Production integration via REST API and Kafka connectors.
- **Phase 3 (Ongoing):** Monthly monitoring reports, quarterly retraining.

---

## Appendices

- Annex A: Mapping to NIST AI RMF control families.
- Annex B: EU AI Act conformity checklist.
- Annex C: FATF Recommendation alignment.

---
