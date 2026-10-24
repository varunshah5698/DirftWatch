import type { Env, RiskTier } from "./domain";

export interface RoleTemplate {
  role: string;
  purpose: string;
  tools: string[];
  dataClasses: string[];
  destinations: string[];
  actionTypes: string[];
  hours: [number, number];
  riskTier: RiskTier;
  delegableTo: string[];
  maxDepth: number;
}

/**
 * Role templates are the cold-start prior: a brand-new agent inherits a template so it
 * can be scored before it has any history (spec 4D "role-template priors").
 */
export const ROLE_TEMPLATES: Record<string, RoleTemplate> = {
  procurement: {
    role: "Procurement Agent",
    purpose: "Compare supplier quotes and draft purchase requests for human approval.",
    tools: ["erp.read_quotes", "erp.create_purchase_request", "web.fetch", "doc.parse", "email.send_internal"],
    dataClasses: ["supplier_catalog", "pricing", "contracts", "public_web"],
    destinations: ["suppliers.acme-corp.com", "api.erp.internal"],
    actionTypes: ["read", "draft", "submit", "summarize"],
    hours: [8, 19],
    riskTier: "medium",
    delegableTo: ["contract-review", "invoice-triage"],
    maxDepth: 2,
  },
  hr: {
    role: "HR Onboarding Agent",
    purpose: "Prepare onboarding checklists and provision accounts for new hires.",
    tools: ["hr.read_profile", "itsm.create_ticket", "provision.account", "email.send_internal"],
    dataClasses: ["employee_pii", "org_chart", "onboarding_checklist"],
    destinations: ["api.hris.internal", "api.itsm.internal"],
    actionTypes: ["read", "create", "provision"],
    hours: [8, 18],
    riskTier: "high",
    delegableTo: ["it-provisioning"],
    maxDepth: 1,
  },
  support: {
    role: "Customer Support Agent",
    purpose: "Resolve tier-1 tickets using the knowledge base and refund policy.",
    tools: ["kb.search", "crm.read_ticket", "crm.apply_refund", "email.send_customer"],
    dataClasses: ["ticket_content", "customer_pii", "public_web"],
    destinations: ["api.crm.internal", "kb.internal", "mail.exit"],
    actionTypes: ["read", "respond", "refund"],
    hours: [0, 24],
    riskTier: "medium",
    delegableTo: ["billing-review"],
    maxDepth: 1,
  },
  finance: {
    role: "AP Finance Agent",
    purpose: "Match invoices to purchase orders and schedule payments.",
    tools: ["erp.read_invoice", "erp.match_po", "bank.schedule_payment", "doc.parse"],
    dataClasses: ["invoices", "bank_accounts", "pricing"],
    destinations: ["api.erp.internal", "api.bank.internal"],
    actionTypes: ["read", "match", "schedule"],
    hours: [7, 20],
    riskTier: "high",
    delegableTo: ["invoice-triage"],
    maxDepth: 1,
  },
  research: {
    role: "Market Research Agent",
    purpose: "Gather public market data and summarize competitor movements.",
    tools: ["web.fetch", "doc.parse", "summarize.write", "warehouse.query"],
    dataClasses: ["public_web", "market_data", "internal_reports"],
    destinations: ["feeds.reuters.com", "api.erp.internal"],
    actionTypes: ["read", "summarize", "query"],
    hours: [6, 22],
    riskTier: "low",
    delegableTo: ["research-review"],
    maxDepth: 2,
  },
  "contract-review": {
    role: "Contract Review Agent",
    purpose: "Check supplier contract clauses against playbook rules.",
    tools: ["doc.parse", "clause.compare", "summarize.write"],
    dataClasses: ["contracts", "legal_playbook"],
    destinations: ["api.erp.internal", "dms.internal"],
    actionTypes: ["read", "compare", "summarize"],
    hours: [8, 19],
    riskTier: "medium",
    delegableTo: ["legal-review"],
    maxDepth: 1,
  },
  "invoice-triage": {
    role: "Invoice Triage Agent",
    purpose: "Classify incoming invoices and route them to the AP queue.",
    tools: ["doc.parse", "erp.read_invoice", "queue.route"],
    dataClasses: ["invoices", "pricing"],
    destinations: ["api.erp.internal"],
    actionTypes: ["read", "classify", "route"],
    hours: [0, 24],
    riskTier: "low",
    delegableTo: ["ap-finance"],
    maxDepth: 1,
  },
  billing: {
    role: "Billing Review Agent",
    purpose: "Validate refunds against billing records before customer reply.",
    tools: ["billing.read_invoice", "crm.apply_refund"],
    dataClasses: ["invoices", "customer_pii"],
    destinations: ["api.billing.internal"],
    actionTypes: ["read", "refund"],
    hours: [8, 18],
    riskTier: "medium",
    delegableTo: ["ap-finance"],
    maxDepth: 1,
  },
  "it-provisioning": {
    role: "IT Provisioning Agent",
    purpose: "Create and revoke accounts approved by HR workflows.",
    tools: ["provision.account", "itsm.create_ticket"],
    dataClasses: ["org_chart", "onboarding_checklist"],
    destinations: ["api.itsm.internal", "idp.internal"],
    actionTypes: ["provision"],
    hours: [8, 18],
    riskTier: "high",
    delegableTo: ["ci-runner"],
    maxDepth: 1,
  },
  "ci-runner": {
    role: "CI Runner Agent",
    purpose: "Run build and test pipelines for internal repositories.",
    tools: ["repo.read", "ci.run_job", "artifact.upload"],
    dataClasses: ["source_code", "build_artifacts"],
    destinations: ["git.internal", "artifacts.internal"],
    actionTypes: ["read", "execute", "upload"],
    hours: [0, 24],
    riskTier: "medium",
    delegableTo: ["deploy-bot"],
    maxDepth: 1,
  },
  "research-review": {
    role: "Research Review Agent",
    purpose: "Validate research summaries before internal publication.",
    tools: ["doc.parse", "summarize.write"],
    dataClasses: ["internal_reports", "public_web"],
    destinations: ["dms.internal"],
    actionTypes: ["read", "summarize"],
    hours: [8, 19],
    riskTier: "low",
    delegableTo: ["legal-review"],
    maxDepth: 1,
  },
  "legal-review": {
    role: "Legal Review Agent",
    purpose: "Flag legal exposure in summaries and contracts.",
    tools: ["doc.parse", "clause.compare"],
    dataClasses: ["contracts", "legal_playbook"],
    destinations: ["dms.internal"],
    actionTypes: ["read", "compare"],
    hours: [9, 18],
    riskTier: "medium",
    delegableTo: [],
    maxDepth: 0,
  },
  "ap-finance": {
    role: "AP Finance Agent",
    purpose: "Approve invoice payments within approved thresholds.",
    tools: ["erp.match_po", "bank.schedule_payment"],
    dataClasses: ["invoices", "bank_accounts"],
    destinations: ["api.erp.internal", "api.bank.internal"],
    actionTypes: ["read", "schedule"],
    hours: [8, 19],
    riskTier: "high",
    delegableTo: [],
    maxDepth: 0,
  },
  "deploy-bot": {
    role: "Deploy Bot Agent",
    purpose: "Promote tested artifacts to staging and production.",
    tools: ["ci.run_job", "deploy.promote"],
    dataClasses: ["build_artifacts", "source_code"],
    destinations: ["artifacts.internal", "cluster.internal"],
    actionTypes: ["execute", "deploy"],
    hours: [0, 24],
    riskTier: "high",
    delegableTo: [],
    maxDepth: 0,
  },
};

export interface FleetSpec {
  id: string;
  name: string;
  template: keyof typeof ROLE_TEMPLATES;
  owner: string;
  avatar: string;
  team: string;
  env: Env;
  createdAtDaysAgo: number;
  /** Password for scripted scenarios ("procurement", "poisoned_tool", "stolen_token", "slow_drift", "chain"). */
  scenario?: string;
  baselineDays?: number;
}

export const FLEET: FleetSpec[] = [
  { id: "ag-proc-01", name: "Procurement Agent", template: "procurement", owner: "Priya Nair", avatar: "PN", team: "Finance Ops", env: "production", createdAtDaysAgo: 120, scenario: "procurement", baselineDays: 21 },
  { id: "ag-hr-01", name: "HR Onboarding Agent", template: "hr", owner: "Marcus Hale", avatar: "MH", team: "People Ops", env: "production", createdAtDaysAgo: 90 },
  { id: "ag-sup-01", name: "Support Triage Agent", template: "support", owner: "Dana Blake", avatar: "DB", team: "Customer Success", env: "production", createdAtDaysAgo: 60 },
  { id: "ag-sup-02", name: "Support Refund Agent", template: "billing", owner: "Dana Blake", avatar: "DB", team: "Customer Success", env: "production", createdAtDaysAgo: 45 },
  { id: "ag-res-01", name: "Market Research Agent", template: "research", owner: "Ilya Petrov", avatar: "IP", team: "Strategy", env: "production", createdAtDaysAgo: 150 },
  { id: "ag-res-02", name: "Research Reviewer Agent", template: "research-review", owner: "Ilya Petrov", avatar: "IP", team: "Strategy", env: "production", createdAtDaysAgo: 30 },
  { id: "ag-con-01", name: "Contract Review Agent", template: "contract-review", owner: "Sofia Duarte", avatar: "SD", team: "Legal", env: "production", createdAtDaysAgo: 100 },
  { id: "ag-leg-01", name: "Legal Review Agent", template: "legal-review", owner: "Sofia Duarte", avatar: "SD", team: "Legal", env: "production", createdAtDaysAgo: 80 },
  { id: "ag-fin-01", name: "AP Finance Agent", template: "finance", owner: "Priya Nair", avatar: "PN", team: "Finance Ops", env: "production", createdAtDaysAgo: 70 },
  { id: "ag-inv-01", name: "Invoice Triage Agent", template: "invoice-triage", owner: "Priya Nair", avatar: "PN", team: "Finance Ops", env: "production", createdAtDaysAgo: 65 },
  { id: "ag-it-01", name: "IT Provisioning Agent", template: "it-provisioning", owner: "Ken Ito", avatar: "KI", team: "IT Platform", env: "production", createdAtDaysAgo: 200 },
  { id: "ag-ci-01", name: "CI Runner Agent", template: "ci-runner", owner: "Ken Ito", avatar: "KI", team: "IT Platform", env: "production", createdAtDaysAgo: 210 },
  { id: "ag-dep-01", name: "Deploy Bot Agent", template: "deploy-bot", owner: "Ken Ito", avatar: "KI", team: "IT Platform", env: "production", createdAtDaysAgo: 220 },
  { id: "ag-proc-02", name: "Procurement Agent (EU)", template: "procurement", owner: "Luc Moreau", avatar: "LM", team: "Finance Ops", env: "production", createdAtDaysAgo: 14, baselineDays: 7 },
  { id: "ag-sup-03", name: "Support Macros Agent", template: "support", owner: "Dana Blake", avatar: "DB", team: "Customer Success", env: "staging", createdAtDaysAgo: 3 },
  { id: "ag-poison-01", name: "Invoice Triage Agent", template: "invoice-triage", owner: "Priya Nair", avatar: "PN", team: "Finance Ops", env: "staging", createdAtDaysAgo: 50, scenario: "poisoned_tool" },
  { id: "ag-token-02", name: "Support Refund Agent", template: "billing", owner: "Dana Blake", avatar: "DB", team: "Customer Success", env: "production", createdAtDaysAgo: 55, scenario: "stolen_token" },
  { id: "ag-drift-02", name: "Market Research Agent", template: "research", owner: "Ilya Petrov", avatar: "IP", team: "Strategy", env: "production", createdAtDaysAgo: 140, scenario: "slow_drift" },
  { id: "ag-chain-02", name: "CI Runner Agent", template: "ci-runner", owner: "Ken Ito", avatar: "KI", team: "IT Platform", env: "production", createdAtDaysAgo: 96, scenario: "chain" },
];

export const CANARY_RESOURCES = [
  { id: "can-hr-001", name: "hr_salary_banding_2026.xlsx", kind: "file", sensitivity: "restricted", dataClass: "hr_salary", destination: undefined, owner: "People Ops" },
  { id: "can-cred-002", name: "aws_prod_credentials.env", kind: "file", sensitivity: "restricted", dataClass: "secrets", destination: undefined, owner: "IT Platform" },
  { id: "can-hook-003", name: "legacy-webhook.internal/collect", kind: "endpoint", sensitivity: "confidential", dataClass: "internal_reports", destination: "legacy-webhook.internal", owner: "IT Platform" },
  { id: "can-token-004", name: "svc-account-legacy (token)", kind: "token", sensitivity: "restricted", dataClass: "secrets", destination: undefined, owner: "IT Platform" },
  { id: "can-board-005", name: "board_minutes_Q3.pdf", kind: "file", sensitivity: "restricted", dataClass: "board_confidential", destination: undefined, owner: "Legal" },
];
