# FicheBait Error Helper Quality Report

Generated: 2026-07-19

## Summary

- Published entries: 2334
- Reviewed sources: 1556
- Entries needing validation: 0
- Entries with scenario variants: 20
- High-priority unresolved reviewed sources: 2
- Thin-coverage products with fewer than 5 entries: 1
- Repeated-code clusters to review for scenario modeling: 148

## Confidence Coverage

| Confidence | Entries |
| --- | --- |
| high | 88 |
| low | 1564 |
| medium | 682 |

## Fix Status Coverage

| Fix status | Entries |
| --- | --- |
| diagnostic-only | 357 |
| known-fix | 120 |
| needs-review | 1533 |
| workaround | 324 |

## Validation Triage Coverage

| Validation status | Entries |
| --- | --- |
| official-doc-baseline | 1194 |
| reviewed-diagnostic | 801 |

## Validation Queue by Product

| Product | Needs validation |
| --- | --- |
| Administration Hub | 0 |
| AI Service | 0 |
| API Server | 0 |
| Audit Trail | 0 |
| Common Dialog | 0 |
| Connector | 0 |
| Directory Server | 0 |
| Discussions | 0 |
| Distributed Computing Cluster | 0 |
| Federated Search | 0 |
| Forms | 0 |
| Full Text Search | 0 |
| Import Agent | 0 |
| Laserfiche Installer | 0 |
| Laserfiche Server/Repository Server | 0 |
| Mobile | 0 |
| Office Integration | 0 |
| Quick Fields | 0 |
| Records Management | 0 |
| Snapshot | 0 |
| Web Client | 0 |
| WebLink | 0 |
| Webtools Agent | 0 |
| Windows Client/Desktop Client | 0 |
| Workflow | 0 |

## Reviewed Source Status

| Review status | Sources |
| --- | --- |
| cross-product | 65 |
| curated | 425 |
| curated-partial | 447 |
| curated-unresolved | 613 |
| no-matching-posts | 2 |
| not-actionable | 4 |

## High-Priority Unresolved Sources

| Source type | Sources |
| --- | --- |
| Answers - Laserfiche Employee | 2 |

## Thin Product Coverage

| Product | Published entries |
| --- | --- |
| AI Service | 1 |

## Product-Level Lazy Load Candidates

| Product | Published entries | Linked sources |
| --- | --- | --- |
| Laserfiche Server/Repository Server | 1238 | 1328 |
| Windows Client/Desktop Client | 239 | 241 |
| Forms | 144 | 181 |
| Directory Server | 106 | 107 |
| Web Client | 91 | 98 |
| WebLink | 87 | 90 |
| Workflow | 83 | 90 |
| Quick Fields | 59 | 60 |
| Laserfiche Installer | 48 | 48 |
| Snapshot | 36 | 36 |

## Repeated-Code Scenario Review

| Code | Entries | Products | Entries with scenarios |
| --- | --- | --- | --- |
| LFF502-UnexpectedError | 24 | Directory Server, Forms, Laserfiche Server/Repository Server | 1 |
| 9013 | 18 | Connector, Import Agent, Laserfiche Server/Repository Server, Quick Fields, Records Management, Web Client, WebLink, Windows Client/Desktop Client, Workflow | 1 |
| 6000 | 14 | Directory Server, Forms, Laserfiche Installer, Laserfiche Server/Repository Server, Records Management, Snapshot, Windows Client/Desktop Client, Workflow | 0 |
| 7050 | 12 | Laserfiche Server/Repository Server | 0 |
| 9008 | 10 | Full Text Search, Import Agent, Laserfiche Server/Repository Server | 1 |
| 784 | 8 | Full Text Search, Laserfiche Server/Repository Server | 1 |
| 0x80040310 | 7 | Laserfiche Installer, Web Client, Windows Client/Desktop Client | 0 |
| 9010 | 7 | API Server, Laserfiche Server/Repository Server, Mobile, Quick Fields, Workflow | 1 |
| 10061 | 7 | Forms, Quick Fields, Workflow | 0 |
| 42000 | 7 | Audit Trail, Discussions, Forms, Laserfiche Server/Repository Server, Quick Fields, Workflow | 0 |
| 0x80004002 | 6 | Laserfiche Server/Repository Server, Windows Client/Desktop Client, Workflow | 1 |
| 0x80004005 | 6 | Directory Server, Forms, Windows Client/Desktop Client, Workflow | 0 |
| 404 | 6 | API Server, Laserfiche Server/Repository Server, WebLink, Workflow | 1 |
| 500 | 6 | Audit Trail, Laserfiche Server/Repository Server, Mobile, WebLink | 0 |
| 780 | 6 | Laserfiche Server/Repository Server, Snapshot, Web Client | 1 |
| 0x800706BA | 5 | Distributed Computing Cluster, Forms, Quick Fields | 0 |
| 0x80005000 | 5 | Directory Server, Workflow | 0 |
| 0x80131040 | 5 | API Server, Directory Server, Web Client | 0 |
| 797 | 5 | Laserfiche Server/Repository Server, Workflow | 0 |
| 9025 | 5 | Laserfiche Server/Repository Server | 0 |
| LFF2106-InvalidDataSent | 5 | Directory Server, Discussions, Mobile | 0 |
| LFF2400-DataSourceConnectionError | 5 | Forms | 1 |
| 0x80070002 | 4 | Laserfiche Installer, Laserfiche Server/Repository Server, Web Client, Workflow | 0 |
| 0xc0042335 | 4 | Laserfiche Server/Repository Server, Web Client, Windows Client/Desktop Client | 0 |
| 1053 | 4 | Audit Trail, Laserfiche Server/Repository Server, Snapshot, Workflow | 0 |

## Top Validation Candidates

| Product | Code | Fix status | Confidence | Best source | Title |
| --- | --- | --- | --- | --- | --- |

## Review Rules

- Prioritize low-confidence entries that have Laserfiche employee or official documentation sources.
- Upgrade an entry only when the source supports the symptom, cause, and fix for the product/version context.
- Add scenario variants when the same code has different causes or fixes.
- Keep unresolved diagnostic entries visible when they help users identify the error but do not imply a confirmed fix.
- Catalog data is already split into Vite chunks for errors, reviewed sources, official docs, and vendor code; keep large new datasets in separate importable modules.
- If product-level lazy loading is implemented later, start with the largest products in the Product-Level Lazy Load Candidates section.

