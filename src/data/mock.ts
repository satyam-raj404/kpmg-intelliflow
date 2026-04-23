import type {
  Vendor,
  PurchaseOrder,
  Project,
  FinancialPeriod,
  ComplianceCheck,
  UtilizationRecord,
  InvoiceRecord,
  P2PItem,
  P2PStage,
  ActionItem,
  AuditLog,
  NotificationItem,
  Region,
  VendorCategory,
  POStatus,
  ProjectHealth,
  RiskTier,
  ComplianceStatus,
  ContractStatus,
  BreachType,
} from "@/types";

// ----- Deterministic pseudo-random so data is stable across renders -----
let _seed = 1337;
function rand() {
  _seed = (_seed * 9301 + 49297) % 233280;
  return _seed / 233280;
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
function int(min: number, max: number) {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function float(min: number, max: number, decimals = 2) {
  const v = rand() * (max - min) + min;
  return parseFloat(v.toFixed(decimals));
}
function dateBetween(daysBack: number, daysFwd: number) {
  const offset = int(-daysBack, daysFwd);
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString();
}

// ============================ VENDORS ============================
const VENDOR_NAMES = [
  "Infosys",
  "Tata Consultancy Services",
  "Wipro",
  "Accenture",
  "Amazon Web Services",
  "Microsoft Azure",
  "Google Cloud",
  "Deloitte",
  "McKinsey & Company",
  "Bain & Company",
  "CrowdStrike",
  "Palo Alto Networks",
  "Databricks",
  "Snowflake",
  "SAP",
  "Oracle",
  "Atlassian",
  "ServiceNow",
  "Salesforce",
  "HubSpot",
  "Zoom",
  "Slack",
  "Figma",
  "Adobe",
  "HCL Technologies",
  "Tech Mahindra",
  "Capgemini",
  "Cognizant",
  "IBM",
  "Cisco Systems",
  "Dell Technologies",
  "VMware",
  "Red Hat",
  "MongoDB",
  "Elastic",
  "Datadog",
  "PagerDuty",
  "Twilio",
  "Stripe",
  "Tableau",
  "Notion",
  "Miro",
  "GitHub",
  "GitLab",
  "Okta",
  "Auth0",
  "Cloudflare",
  "Fortinet",
  "Splunk",
  "New Relic",
];

const CATEGORIES: VendorCategory[] = [
  "IT Services",
  "Consulting",
  "Cloud Infrastructure",
  "Security",
  "Data Analytics",
  "SaaS",
];
const REGIONS: Region[] = ["APAC", "EMEA", "Americas"];
const COMPLIANCE: ComplianceStatus[] = [
  "Compliant",
  "Compliant",
  "Compliant",
  "Compliant",
  "Under Review",
  "Non-Compliant",
];
const CONTRACT_STATUS: ContractStatus[] = ["Active", "Active", "Active", "Expiring Soon", "Expired"];
const RISK: RiskTier[] = ["Low", "Low", "Low", "Medium", "Medium", "High"];

export const vendors: Vendor[] = VENDOR_NAMES.map((name, i) => {
  const compliance = COMPLIANCE[i % COMPLIANCE.length];
  const contractStatus = CONTRACT_STATUS[i % CONTRACT_STATUS.length];
  const risk = RISK[i % RISK.length];
  const rating = float(2.6, 4.9, 1);
  return {
    id: `V${String(i + 1).padStart(4, "0")}`,
    code: `VND-${String(1000 + i)}`,
    name,
    category: CATEGORIES[i % CATEGORIES.length],
    region: REGIONS[i % REGIONS.length],
    rating,
    deliveryScore: int(55, 99),
    qualityScore: int(60, 98),
    compliance,
    abacCertified: i % 7 !== 0,
    activePOs: int(1, 18),
    spendYTD: int(15, 4500) * 1_00_000, // 15 L to 45 Cr
    contractEnd: dateBetween(-60, 240),
    contractStatus,
    riskTier: risk,
    singleSource: i % 11 === 0,
    onboarded: dateBetween(-1500, -90),
    responsivenessDays: float(0.5, 7, 1),
    otifRate: float(78, 99, 1),
  };
});

// Force a few well-known vendors to be high-spend & compliant for the demo
vendors.find((v) => v.name === "Amazon Web Services")!.spendYTD = 28_50_00_000;
vendors.find((v) => v.name === "Microsoft Azure")!.spendYTD = 22_10_00_000;
vendors.find((v) => v.name === "Infosys")!.spendYTD = 18_75_00_000;
vendors.find((v) => v.name === "Tata Consultancy Services")!.spendYTD = 16_30_00_000;
vendors.find((v) => v.name === "Wipro")!.spendYTD = 12_45_00_000;
vendors.find((v) => v.name === "Accenture")!.spendYTD = 10_85_00_000;
// A couple of high-risk flags
vendors.find((v) => v.name === "Oracle")!.compliance = "Under Review";
vendors.find((v) => v.name === "Oracle")!.riskTier = "High";
vendors.find((v) => v.name === "Splunk")!.compliance = "Non-Compliant";
vendors.find((v) => v.name === "Splunk")!.riskTier = "High";

// ============================ CLIENTS / PROJECTS ============================
const CLIENTS = [
  "Reliance Industries",
  "Tata Group",
  "HDFC Bank",
  "ICICI Bank",
  "Mahindra & Mahindra",
  "Godrej Industries",
  "Larsen & Toubro",
  "Aditya Birla Group",
  "Hindustan Unilever",
  "ITC Limited",
  "Bharti Airtel",
  "Asian Paints",
  "Maruti Suzuki",
  "Adani Enterprises",
  "Bajaj Finserv",
];

const DIVISIONS = [
  "IT Services",
  "Consulting",
  "Cloud Infrastructure",
  "Security",
  "Data Analytics",
  "Admin",
  "Others",
];

const PROJECT_NAMES = [
  "Core Banking Modernization",
  "Cloud Migration Wave 2",
  "SAP S/4HANA Rollout",
  "Cybersecurity Maturity Uplift",
  "Data Lakehouse Build",
  "Procurement Transformation",
  "Customer 360 Platform",
  "ERP Consolidation",
  "Zero-Trust Network",
  "AI/ML Center of Excellence",
  "Workforce Analytics",
  "Risk & Compliance Automation",
  "Treasury Optimization",
  "Digital CX Overhaul",
  "Tax Reporting Platform",
  "Supply Chain Visibility",
  "RPA Scale-up",
  "ESG Reporting Stack",
  "Identity Modernization",
  "Hybrid Cloud Foundation",
];

export const projects: Project[] = Array.from({ length: 50 }, (_, i) => {
  const revenue = int(150, 4500) * 1_00_000; // 1.5 L to 45 Cr
  const cost = Math.round(revenue * float(0.55, 0.95));
  const budget = Math.round(cost * float(0.92, 1.18));
  const gm = ((revenue - cost) / revenue) * 100;
  let health: ProjectHealth = "Healthy";
  if (gm < 12) health = "Critical";
  else if (gm < 22) health = "At Risk";
  return {
    id: `P${String(i + 1).padStart(4, "0")}`,
    code: `PRJ-${String(2024000 + i)}`,
    name: PROJECT_NAMES[i % PROJECT_NAMES.length] + (i >= PROJECT_NAMES.length ? ` Phase ${Math.floor(i / PROJECT_NAMES.length) + 1}` : ""),
    client: CLIENTS[i % CLIENTS.length],
    revenue,
    cost,
    budget,
    gmPercent: parseFloat(gm.toFixed(1)),
    utilPercent: parseFloat(((cost / budget) * 100).toFixed(1)),
    health,
    startDate: dateBetween(-540, -30),
    endDate: dateBetween(30, 540),
    division: DIVISIONS[i % DIVISIONS.length],
  };
});

// Force a few signature problem projects so the demo has narrative
projects[0].health = "Critical";
projects[0].gmPercent = 8.4;
projects[0].utilPercent = 108.2;
projects[3].health = "At Risk";
projects[3].gmPercent = 17.1;
projects[3].utilPercent = 96.5;
projects[7].health = "Critical";
projects[7].gmPercent = 11.2;
projects[7].utilPercent = 112.7;

// ============================ PURCHASE ORDERS ============================
const PO_STATUSES: POStatus[] = [
  "Approved",
  "Approved",
  "Approved",
  "Pending",
  "Pending",
  "Under Review",
  "Deleted",
];
const DOA_LEVELS: PurchaseOrder["doaLevel"][] = ["L1", "L2", "L3", "L4", "CXO"];
const CREATORS = [
  "Priya Sharma",
  "Rohan Mehta",
  "Anjali Nair",
  "Vikram Iyer",
  "Sneha Kapoor",
  "Arjun Desai",
  "Kavita Rao",
  "Nikhil Gupta",
];

export const purchaseOrders: PurchaseOrder[] = Array.from({ length: 200 }, (_, i) => {
  const v = vendors[i % vendors.length];
  const p = projects[i % projects.length];
  const status = PO_STATUSES[i % PO_STATUSES.length];
  const value = int(50, 50000) * 1_000; // 50 K to 5 Cr
  return {
    id: `PO${String(i + 1).padStart(5, "0")}`,
    poNumber: `PO-2024-${String(10000 + i)}`,
    vendorId: v.id,
    vendorName: v.name,
    projectId: p.id,
    projectName: p.name,
    value,
    status,
    doaLevel: DOA_LEVELS[i % DOA_LEVELS.length],
    daysOpen: int(0, 28),
    createdBy: CREATORS[i % CREATORS.length],
    createdAt: dateBetween(-90, 0),
    hasComplianceBreach: i % 23 === 0,
    amended: i % 9 === 0,
    rateDeviation: float(-8, 12, 1),
  };
});

// Force ~23 high-value POs (> 1 Cr)
for (let i = 0; i < 23; i++) {
  purchaseOrders[i].value = int(110, 1200) * 1_00_000;
}

// ============================ FINANCIAL PERIODS (24 months) ============================
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const financialHistory: FinancialPeriod[] = Array.from({ length: 24 }, (_, i) => {
  const monthIdx = (new Date().getMonth() - 23 + i + 12 * 5) % 12;
  const yearOffset = Math.floor((i - 23 + new Date().getMonth()) / 12);
  const yr = (new Date().getFullYear() + yearOffset).toString().slice(-2);
  const revenue = int(2200, 3800) * 1_00_000;
  const cost = Math.round(revenue * float(0.7, 0.82));
  const margin = ((revenue - cost) / revenue) * 100;
  const budget = Math.round(cost * float(0.95, 1.1));
  return {
    period: `${MONTHS[monthIdx]}-${yr}`,
    revenue,
    cost,
    margin: parseFloat(margin.toFixed(1)),
    budget,
    spend: cost,
  };
});

// ============================ COMPLIANCE ============================
const BREACH_TYPES: BreachType[] = [
  "ABAC Gift Threshold",
  "Sanctions Match",
  "DOA Bypass",
  "Duplicate Invoice",
  "Rate Deviation",
  "Conflict of Interest",
];
export const complianceChecks: ComplianceCheck[] = Array.from({ length: 30 }, (_, i) => {
  const v = vendors[(i * 3) % vendors.length];
  const status: ComplianceCheck["status"] = i % 5 === 0 ? "Fail" : i % 9 === 0 ? "Pending" : "Pass";
  return {
    id: `CC${String(i + 1).padStart(4, "0")}`,
    vendorName: v.name,
    vendorId: v.id,
    poNumber: i % 2 === 0 ? `PO-2024-${10000 + i * 7}` : undefined,
    type: BREACH_TYPES[i % BREACH_TYPES.length],
    severity: ["Low", "Medium", "High", "Critical"][i % 4] as ComplianceCheck["severity"],
    status,
    date: dateBetween(-60, 0),
    resolution: status === "Fail" ? "Escalated to Compliance Officer" : undefined,
  };
});

// ============================ UTILIZATION ============================
const TOOLS: { name: string; vendor: string; cat: UtilizationRecord["category"] }[] = [
  { name: "Jira", vendor: "Atlassian", cat: "SaaS" },
  { name: "Salesforce", vendor: "Salesforce", cat: "SaaS" },
  { name: "Slack", vendor: "Slack", cat: "SaaS" },
  { name: "Microsoft 365", vendor: "Microsoft", cat: "SaaS" },
  { name: "AWS Compute", vendor: "AWS", cat: "Compute" },
  { name: "Azure VMs", vendor: "Microsoft Azure", cat: "Compute" },
  { name: "Tableau", vendor: "Tableau", cat: "SaaS" },
  { name: "Databricks", vendor: "Databricks", cat: "Databases" },
  { name: "ServiceNow", vendor: "ServiceNow", cat: "SaaS" },
  { name: "Zoom", vendor: "Zoom", cat: "SaaS" },
  { name: "Figma", vendor: "Figma", cat: "SaaS" },
  { name: "Notion", vendor: "Notion", cat: "SaaS" },
  { name: "GitHub Enterprise", vendor: "GitHub", cat: "SaaS" },
  { name: "Miro", vendor: "Miro", cat: "SaaS" },
  { name: "Adobe Creative Cloud", vendor: "Adobe", cat: "SaaS" },
  { name: "Snowflake", vendor: "Snowflake", cat: "Databases" },
  { name: "CrowdStrike Falcon", vendor: "CrowdStrike", cat: "Security Tools" },
  { name: "Okta SSO", vendor: "Okta", cat: "Security Tools" },
  { name: "Splunk", vendor: "Splunk", cat: "Security Tools" },
  { name: "Datadog", vendor: "Datadog", cat: "Networking" },
];

export const utilization: UtilizationRecord[] = TOOLS.map((t, i) => {
  const owned = int(80, 2200);
  // Force two well-known underutilized tools
  let utilPct: number;
  if (t.name === "Salesforce") utilPct = 44;
  else if (t.name === "Tableau") utilPct = 31;
  else utilPct = int(35, 96);
  const active = Math.floor((owned * utilPct) / 100);
  const monthlyCost = owned * int(800, 6500);
  const cpau = active > 0 ? monthlyCost / active : 0;
  let flag: UtilizationRecord["optimizationFlag"] = "Optimal";
  if (utilPct < 50) flag = "Underutilized";
  else if (utilPct > 95) flag = "Over-provisioned";
  const savings = flag === "Underutilized" ? Math.round(monthlyCost * 0.4) : flag === "Over-provisioned" ? Math.round(monthlyCost * 0.15) : 0;
  return {
    id: `U${String(i + 1).padStart(4, "0")}`,
    toolName: t.name,
    vendor: t.vendor,
    licensesOwned: owned,
    activeUsers: active,
    utilPercent: utilPct,
    monthlyCost,
    costPerActiveUser: Math.round(cpau),
    renewalDate: dateBetween(-15, 120),
    category: t.cat,
    optimizationFlag: flag,
    potentialSavings: savings,
  };
});

// ============================ INVOICES ============================
const INVOICE_STATUSES: InvoiceRecord["status"][] = [
  "Paid",
  "Paid",
  "Paid",
  "Pending",
  "Pending",
  "Overdue",
  "Disputed",
  "Credit Memo",
];
export const invoices: InvoiceRecord[] = Array.from({ length: 100 }, (_, i) => {
  const v = vendors[i % vendors.length];
  const status = INVOICE_STATUSES[i % INVOICE_STATUSES.length];
  return {
    id: `IN${String(i + 1).padStart(5, "0")}`,
    invoiceNumber: `INV-${2024000 + i}`,
    vendorName: v.name,
    poNumber: `PO-2024-${10000 + i}`,
    amount: int(50, 7500) * 1_000,
    status,
    ageDays: int(0, 110),
    dueDate: dateBetween(-30, 60),
  };
});

// ============================ P2P ITEMS ============================
const STAGES: P2PStage[] = [
  "Requirement Analysis",
  "Bidding",
  "RFQ",
  "Vendor Selection",
  "Vendor Contracting",
  "PR",
  "PR Amendment",
  "PR Approval",
  "PO Creation",
  "PO Amendment",
  "PO Approval",
  "GRN Creation",
  "GRN Return",
  "Invoicing",
  "Invoice Adjustment",
  "Payment Settlement",
];

// Predefined counts so it's deterministic and tells a "bottleneck" story
export const stageCounts: Record<P2PStage, number> = {
  "Requirement Analysis": 84,
  Bidding: 62,
  RFQ: 51,
  "Vendor Selection": 38,
  "Vendor Contracting": 29,
  PR: 73,
  "PR Amendment": 18,
  "PR Approval": 47,
  "PO Creation": 41,
  "PO Amendment": 12,
  "PO Approval": 89, // bottleneck
  "GRN Creation": 34,
  "GRN Return": 9,
  Invoicing: 56,
  "Invoice Adjustment": 14,
  "Payment Settlement": 38,
};

export const p2pItems: P2PItem[] = Array.from({ length: 60 }, (_, i) => {
  const stage = STAGES[i % STAGES.length];
  const v = vendors[i % vendors.length];
  const p = projects[i % projects.length];
  const slaDays = stage === "PO Approval" ? 3 : stage === "Payment Settlement" ? 30 : 5;
  const days = int(0, slaDays + 5);
  const types: P2PItem["type"][] = ["PR", "PO", "GRN", "Invoice"];
  return {
    id: `T${String(i + 1).padStart(5, "0")}`,
    txnId: `${types[i % 4]}-${100000 + i}`,
    type: types[i % 4],
    stage,
    vendor: v.name,
    project: p.name,
    value: int(20, 4500) * 1_000,
    daysInStage: days,
    owner: CREATORS[i % CREATORS.length],
    status: days > slaDays ? "Breached SLA" : "On Track",
    nextAction:
      stage.includes("Approval") ? "Awaiting approver"
      : stage.includes("Amendment") ? "Re-submission needed"
      : stage === "Payment Settlement" ? "Schedule payment"
      : "Continue process",
    slaDays,
  };
});

// ============================ ACTIONS ============================
export const actions: ActionItem[] = [
  { id: "A1", title: "Renegotiate Salesforce contract — 44% utilization", type: "Cost Save", status: "Open", owner: "Priya Sharma", impact: 18_50_000, dueDate: dateBetween(0, 30), priority: "High" },
  { id: "A2", title: "Review Oracle compliance findings", type: "Compliance", status: "In Progress", owner: "Vikram Iyer", impact: 0, dueDate: dateBetween(0, 14), priority: "High" },
  { id: "A3", title: "Wipro contract renewal decision", type: "Renewal", status: "Under Review", owner: "Anjali Nair", impact: 12_45_00_000, dueDate: dateBetween(0, 21), priority: "High" },
  { id: "A4", title: "Investigate 3 PO deletions in IT Services", type: "Process", status: "Open", owner: "Rohan Mehta", impact: 0, dueDate: dateBetween(0, 7), priority: "Medium" },
  { id: "A5", title: "Onboard 4 backup vendors for sole-source list", type: "Vendor", status: "In Progress", owner: "Sneha Kapoor", impact: 0, dueDate: dateBetween(0, 45), priority: "Medium" },
  { id: "A6", title: "Tableau license consolidation", type: "Cost Save", status: "Open", owner: "Arjun Desai", impact: 9_20_000, dueDate: dateBetween(0, 60), priority: "Medium" },
  { id: "A7", title: "Splunk vendor delisting review", type: "Compliance", status: "Under Review", owner: "Vikram Iyer", impact: 0, dueDate: dateBetween(0, 30), priority: "High" },
  { id: "A8", title: "Q1 audit findings remediation plan", type: "Compliance", status: "Closed", owner: "Compliance Team", impact: 0, dueDate: dateBetween(-30, -1), priority: "High" },
  { id: "A9", title: "Reduce PO approval cycle by 1 day", type: "Process", status: "In Progress", owner: "Procurement Ops", impact: 0, dueDate: dateBetween(0, 90), priority: "Medium" },
  { id: "A10", title: "Snowflake credit reconciliation", type: "Cost Save", status: "Open", owner: "Finance", impact: 4_75_000, dueDate: dateBetween(0, 30), priority: "Low" },
];

// ============================ AUDIT LOG ============================
export const auditLog: AuditLog[] = Array.from({ length: 50 }, (_, i) => ({
  id: `AL${i + 1}`,
  user: CREATORS[i % CREATORS.length],
  action: ["Created PO", "Approved PR", "Deleted PO", "Updated Vendor", "Closed Action", "Modified Threshold"][i % 6],
  entity: `PO-2024-${10000 + i}`,
  timestamp: dateBetween(-30, 0),
  details: "Standard system audit entry — see transaction log for full diff",
}));

// ============================ NOTIFICATIONS ============================
export const notifications: NotificationItem[] = [
  { id: "N1", title: "Compliance breach detected", description: "Splunk — sanctions list match flagged on PO-2024-10093", time: "12 min ago", severity: "critical", read: false },
  { id: "N2", title: "PO awaiting CXO approval", description: "PO-2024-10145 (₹4.8 Cr) pending for 2 days", time: "1 hr ago", severity: "warning", read: false },
  { id: "N3", title: "Contract expiring", description: "Wipro master agreement expires in 18 days", time: "3 hr ago", severity: "warning", read: false },
  { id: "N4", title: "Duplicate invoice flagged", description: "INV-2024028 matches INV-2024014 (Accenture)", time: "5 hr ago", severity: "warning", read: false },
  { id: "N5", title: "Budget threshold crossed", description: "Cloud Infrastructure division at 96.4% YTD", time: "Yesterday", severity: "warning", read: false },
  { id: "N6", title: "New high-value PO submitted", description: "PO-2024-10218 (₹6.2 Cr) by Priya Sharma", time: "Yesterday", severity: "info", read: false },
  { id: "N7", title: "Q1 compliance report ready", description: "87% pass rate across 218 checks", time: "2 days ago", severity: "info", read: false },
];

// ============================ DERIVED HELPERS ============================
export const totalActiveVendors = vendors.length;
export const abacCertifiedCount = vendors.filter((v) => v.abacCertified).length;
export const expiringContracts = vendors.filter((v) => v.contractStatus === "Expiring Soon").length;
export const singleSourceCount = vendors.filter((v) => v.singleSource).length;

export const spendByCategory = (() => {
  const map = new Map<string, number>();
  vendors.forEach((v) => map.set(v.category, (map.get(v.category) ?? 0) + v.spendYTD));
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
})();

export const topVendorsBySpend = [...vendors]
  .sort((a, b) => b.spendYTD - a.spendYTD)
  .slice(0, 10);

export const divisionBudgets = DIVISIONS.map((division) => {
  const projs = projects.filter((p) => p.division === division);
  const budget = projs.reduce((s, p) => s + p.budget, 0);
  const spend = projs.reduce((s, p) => s + p.cost, 0);
  return { division, budget, spend, util: budget ? (spend / budget) * 100 : 0 };
});
