import type { KpiDrillDownData } from "@/components/KpiDrillDown";
import { formatINR } from "@/lib/format";
import { purchaseOrders, vendors, utilization, invoices } from "@/data/mock";

// ═══════════════════════════════════════════
// KPI_01 — Procurement Dashboard
// ═══════════════════════════════════════════

const activePOs = purchaseOrders.filter((p) => p.status !== "Deleted" && p.status !== "Cancelled");
const topPOsByValue = [...activePOs].sort((a, b) => b.value - a.value).slice(0, 6);

export const procurement: Record<string, KpiDrillDownData> = {
  totalPOValue: {
    kpiId: "KPI01-Procurement · #1",
    formula: `SUM(02_PO_Dump.net_order_value)\nWHERE document_date BETWEEN month_start AND today\n  AND deletion_indicator <> 'L'`,
    sourceDatasets: ["02_PO_Dump"],
    sourceFields: ["net_order_value", "document_date", "deletion_indicator"],
    target: "—",
    unit: "INR",
    records: topPOsByValue.map((p) => ({ label: `${p.poNumber} · ${p.vendorName}`, value: formatINR(p.value) })),
  },
  activePOCount: {
    kpiId: "KPI01-Procurement · #2",
    formula: `COUNT(DISTINCT 02_PO_Dump.purchasing_document)\nWHERE delivery_completed <> 'X'\n  AND deletion_indicator <> 'L'`,
    sourceDatasets: ["02_PO_Dump"],
    sourceFields: ["purchasing_document", "delivery_completed", "deletion_indicator"],
    target: "—",
    unit: "Count",
    records: topPOsByValue.map((p) => ({ label: p.poNumber, value: p.status })),
  },
  highValuePO: {
    kpiId: "KPI01-Procurement · #3",
    formula: `COUNT(DISTINCT 02_PO_Dump.purchasing_document)\nWHERE net_order_value > [HIGH_VALUE_THRESHOLD]\n  (default ₹1 Cr)\n  AND deletion_indicator <> 'L'`,
    sourceDatasets: ["02_PO_Dump"],
    sourceFields: ["purchasing_document", "net_order_value", "deletion_indicator"],
    target: "Configurable (e.g., ₹1 Cr)",
    unit: "Count",
    records: activePOs.filter((p) => p.value >= 1_00_00_000).slice(0, 6).map((p) => ({ label: `${p.poNumber} · ${p.vendorName}`, value: formatINR(p.value), highlight: true })),
  },
  avgPRtoPO: {
    kpiId: "KPI01-Procurement · #4",
    formula: `AVG(\n  DATEDIFF(\n    02_PO_Dump.document_date,\n    01_PR_Dump.created_on\n  )\n)\nWHERE 02_PO_Dump.purchase_requisition\n    = 01_PR_Dump.purchase_requisition`,
    sourceDatasets: ["01_PR_Dump", "02_PO_Dump"],
    sourceFields: ["document_date", "created_on", "purchase_requisition"],
    target: "≤ 5 days",
    unit: "Days",
    note: "Joins PR to PO via purchase_requisition field. Only matched pairs contribute.",
  },
  poCycleTime: {
    kpiId: "KPI01-Procurement · #5",
    formula: `AVG(\n  DATEDIFF(release_date, document_date)\n)\nFROM 02_PO_Dump\nWHERE release_indicator = 'X'`,
    sourceDatasets: ["02_PO_Dump", "09_Change_Log"],
    sourceFields: ["release_date", "document_date", "release_indicator"],
    target: "≤ 3 days",
    unit: "Days",
  },
  poDeletionFreq: {
    kpiId: "KPI01-Procurement · #6",
    formula: `COUNT(02_PO_Dump.purchasing_document)\nWHERE deletion_indicator = 'L'\n  AND document_date BETWEEN month_start AND today`,
    sourceDatasets: ["02_PO_Dump"],
    sourceFields: ["purchasing_document", "deletion_indicator", "document_date"],
    target: "≤ 5 per month",
    unit: "Count",
    records: purchaseOrders.filter((p) => p.status === "Deleted").slice(0, 5).map((p) => ({ label: `${p.poNumber} · ${p.vendorName}`, value: formatINR(p.value), highlight: true })),
  },
  poAmendRate: {
    kpiId: "KPI01-Procurement · #7",
    formula: `(\n  COUNT(DISTINCT 09_Change_Log.object_id\n    WHERE object_class = 'EINKBELEG')\n  /\n  COUNT(DISTINCT 02_PO_Dump.purchasing_document)\n) × 100`,
    sourceDatasets: ["02_PO_Dump", "09_Change_Log"],
    sourceFields: ["object_id", "object_class", "purchasing_document"],
    target: "< 15%",
    unit: "%",
    records: purchaseOrders.filter((p) => p.amended).slice(0, 5).map((p) => ({ label: `${p.poNumber} · ${p.vendorName}`, value: "Amended", highlight: true })),
  },
  openPRAging: {
    kpiId: "KPI01-Procurement · #8",
    formula: `COUNT(01_PR_Dump.purchase_requisition)\nWHERE release_status = 'X'\n  AND DATEDIFF(today, release_date) > 7\n  AND purchase_requisition NOT IN\n    (SELECT purchase_requisition FROM 02_PO_Dump)`,
    sourceDatasets: ["01_PR_Dump", "02_PO_Dump"],
    sourceFields: ["purchase_requisition", "release_status", "release_date"],
    target: "≤ 10 PRs",
    unit: "Count",
    note: "PRs released but not yet converted to POs within 7 days.",
  },
};

// ═══════════════════════════════════════════
// KPI_02 — Financial Dashboard
// ═══════════════════════════════════════════

export const financial: Record<string, KpiDrillDownData> = {
  totalSpend: {
    kpiId: "KPI02-Financial · #1",
    formula: `SUM(07_Payment_Dump.amount_local_ccy)\nWHERE posting_date BETWEEN FY_start AND today`,
    sourceDatasets: ["07_Payment_Dump"],
    sourceFields: ["amount_local_ccy", "posting_date"],
    target: "Within budget",
    unit: "INR",
  },
  budgetUtil: {
    kpiId: "KPI02-Financial · #2",
    formula: `(\n  SUM(07_Payment_Dump.amount_local_ccy)\n  /\n  [BUDGET_ALLOCATED]\n) × 100\n— segmented by company_code or business_unit`,
    sourceDatasets: ["07_Payment_Dump", "Budget Master"],
    sourceFields: ["amount_local_ccy", "company_code", "business_unit"],
    target: "< 90% (green) / 90-100% (amber) / >100% (red)",
    unit: "%",
  },
  threeWayMatch: {
    kpiId: "KPI02-Financial · #3",
    formula: `(\n  COUNT(invoices WHERE\n    05_PO_Invoice_Dump.quantity = 04_GRN_Dump.quantity\n    AND 05_PO_Invoice_Dump.amount_local_ccy\n      ≈ 02_PO_Dump.net_order_value\n  )\n  /\n  COUNT(05_PO_Invoice_Dump.invoice_doc)\n) × 100`,
    sourceDatasets: ["02_PO_Dump", "04_GRN_Dump", "05_PO_Invoice_Dump"],
    sourceFields: ["quantity", "amount_local_ccy", "net_order_value", "invoice_doc"],
    target: "> 95%",
    unit: "%",
  },
  invoiceProcessing: {
    kpiId: "KPI02-Financial · #4",
    formula: `AVG(\n  DATEDIFF(\n    06_Invoice_Dump.posting_date,\n    06_Invoice_Dump.vendor_invoice_date\n  )\n)`,
    sourceDatasets: ["06_Invoice_Dump"],
    sourceFields: ["posting_date", "vendor_invoice_date"],
    target: "≤ 5 days",
    unit: "Days",
  },
  paymentOnTime: {
    kpiId: "KPI02-Financial · #5",
    formula: `(\n  COUNT(06_Invoice_Dump.invoice_doc\n    WHERE clearing_doc IS NOT NULL\n    AND 07_Payment_Dump.posting_date\n      ≤ 06_Invoice_Dump.due_date\n  )\n  /\n  COUNT(06_Invoice_Dump.invoice_doc\n    WHERE clearing_doc IS NOT NULL)\n) × 100`,
    sourceDatasets: ["06_Invoice_Dump", "07_Payment_Dump"],
    sourceFields: ["invoice_doc", "clearing_doc", "posting_date", "due_date"],
    target: "> 90%",
    unit: "%",
  },
  dpo: {
    kpiId: "KPI02-Financial · #6",
    formula: `AVG(\n  DATEDIFF(\n    07_Payment_Dump.posting_date,\n    06_Invoice_Dump.posting_date\n  )\n)\n— for invoices linked to payments via clearing_doc`,
    sourceDatasets: ["06_Invoice_Dump", "07_Payment_Dump"],
    sourceFields: ["posting_date", "clearing_doc"],
    target: "Match payment terms (30/45/60)",
    unit: "Days",
  },
  openInvoiceAging: {
    kpiId: "KPI02-Financial · #7",
    formula: `SUM(06_Invoice_Dump.amount_local_ccy)\nWHERE clearing_doc IS NULL\n— bucketed by 0-30 / 31-60 / 61-90 / 90+ days\n  from posting_date`,
    sourceDatasets: ["06_Invoice_Dump"],
    sourceFields: ["amount_local_ccy", "clearing_doc", "posting_date"],
    target: "< ₹5 Cr in 90+ bucket",
    unit: "INR",
    records: [
      { label: "0–30 days", value: "₹1.43 Cr" },
      { label: "31–60 days", value: "₹78.20 L" },
      { label: "61–90 days", value: "₹42.80 L" },
      { label: "90+ days", value: "₹18.60 L", highlight: true },
    ],
  },
  earlyPayment: {
    kpiId: "KPI02-Financial · #8",
    formula: `(\n  SUM(07_Payment_Dump.discount_taken)\n  /\n  SUM(potential_discount\n    FROM 06_Invoice_Dump.payment_terms)\n) × 100`,
    sourceDatasets: ["06_Invoice_Dump", "07_Payment_Dump"],
    sourceFields: ["discount_taken", "payment_terms"],
    target: "> 80%",
    unit: "%",
    note: "Requires payment_terms with discount eligibility info from 06_Invoice_Dump.",
  },
};

// ═══════════════════════════════════════════
// KPI_03 — Leadership Dashboard
// ═══════════════════════════════════════════

export const leadership: Record<string, KpiDrillDownData> = {
  portfolioGM: {
    kpiId: "KPI03-Leadership · #1",
    formula: `(\n  (Total Revenue - Total Procurement Cost)\n  / Total Revenue\n) × 100\nwhere Cost = SUM(07_Payment_Dump.amount_local_ccy)\n  by project`,
    sourceDatasets: ["External revenue", "07_Payment_Dump"],
    sourceFields: ["amount_local_ccy", "project", "revenue (external)"],
    target: "> 25%",
    unit: "%",
  },
  totalProcurement: {
    kpiId: "KPI03-Leadership · #2",
    formula: `SUM(02_PO_Dump.net_order_value)\nWHERE document_date BETWEEN FY_start AND today\n  AND deletion_indicator <> 'L'`,
    sourceDatasets: ["02_PO_Dump"],
    sourceFields: ["net_order_value", "document_date", "deletion_indicator"],
    target: "—",
    unit: "INR",
    records: [...vendors].sort((a, b) => b.spendYTD - a.spendYTD).slice(0, 5).map((v) => ({ label: v.name, value: formatINR(v.spendYTD) })),
  },
  riskIndex: {
    kpiId: "KPI03-Leadership · #3",
    formula: `Weighted score:\n  0.4 × (non-compliant vendors %)\n+ 0.3 × (top-3 vendor spend concentration %)\n+ 0.3 × (process anomaly rate %)\nBanded as Low / Medium / High`,
    sourceDatasets: ["08_Vendor_Master", "02_PO_Dump", "09_Change_Log"],
    sourceFields: ["vendor", "net_order_value", "object_class", "central_purchasing_block"],
    target: "Low",
    unit: "Score (0-100)",
    note: "Composite index. Review each sub-component to find the driver.",
  },
  costSavings: {
    kpiId: "KPI03-Leadership · #4",
    formula: `SUM(\n  EstimatedPrice × Qty - NetOrderValue\n)\nwhere EstimatedPrice from 01_PR_Dump.valuation_price\n  NetOrderValue from 02_PO_Dump\n  (PR linked to PO)`,
    sourceDatasets: ["01_PR_Dump", "02_PO_Dump"],
    sourceFields: ["valuation_price", "order_quantity", "net_order_value", "purchase_requisition"],
    target: "Target: 5% of total spend",
    unit: "INR",
  },
  vendorConcentration: {
    kpiId: "KPI03-Leadership · #5",
    formula: `(\n  SUM(top 3 vendors' net_order_value)\n  / SUM(all vendors' net_order_value)\n) × 100\n— grouped by 02_PO_Dump.vendor`,
    sourceDatasets: ["02_PO_Dump"],
    sourceFields: ["vendor", "net_order_value"],
    target: "< 40%",
    unit: "%",
    records: [...vendors].sort((a, b) => b.spendYTD - a.spendYTD).slice(0, 3).map((v) => ({ label: v.name, value: formatINR(v.spendYTD), highlight: true })),
  },
  maverickPO: {
    kpiId: "KPI03-Leadership · #6",
    formula: `(\n  COUNT(02_PO_Dump.purchasing_document\n    WHERE purchase_requisition IS NULL)\n  /\n  COUNT(02_PO_Dump.purchasing_document)\n) × 100`,
    sourceDatasets: ["02_PO_Dump"],
    sourceFields: ["purchasing_document", "purchase_requisition"],
    target: "< 5%",
    unit: "%",
    note: "Maverick POs bypass the PR process — indicates off-process buying.",
  },
  e2eCycleTime: {
    kpiId: "KPI03-Leadership · #7",
    formula: `AVG(\n  DATEDIFF(\n    07_Payment_Dump.posting_date,\n    01_PR_Dump.created_on\n  )\n)\nwhere joined PR → PO → Invoice → Payment`,
    sourceDatasets: ["01_PR_Dump", "02_PO_Dump", "06_Invoice_Dump", "07_Payment_Dump"],
    sourceFields: ["created_on", "document_date", "posting_date", "purchase_requisition"],
    target: "≤ 45 days",
    unit: "Days",
  },
  procurementROI: {
    kpiId: "KPI03-Leadership · #8",
    formula: `(\n  Cost Savings Realized\n  / Procurement Function Operating Cost\n) × 100\n— KPI 4 divided by salaries + ops budget\n  for procurement team`,
    sourceDatasets: ["KPI 4", "Operating budget"],
    sourceFields: ["cost_savings_ytd", "procurement_opex"],
    target: "> 300%",
    unit: "Ratio",
  },
};

// ═══════════════════════════════════════════
// KPI_04 — Vendor Performance Dashboard
// ═══════════════════════════════════════════

export const vendor: Record<string, KpiDrillDownData> = {
  totalActive: {
    kpiId: "KPI04-Vendor · #1",
    formula: `COUNT(08_Vendor_Master.vendor)\nWHERE deletion_flag_central <> 'X'\n  AND central_purchasing_block <> 'X'`,
    sourceDatasets: ["08_Vendor_Master"],
    sourceFields: ["vendor", "deletion_flag_central", "central_purchasing_block"],
    target: "—",
    unit: "Count",
  },
  compliancePass: {
    kpiId: "KPI04-Vendor · #2",
    formula: `(\n  COUNT(08_Vendor_Master.vendor\n    WHERE central_purchasing_block <> 'X'\n    AND payment_block <> '*'\n    AND posting_block_cc <> 'X')\n  /\n  COUNT(08_Vendor_Master.vendor)\n) × 100`,
    sourceDatasets: ["08_Vendor_Master"],
    sourceFields: ["vendor", "central_purchasing_block", "payment_block", "posting_block_cc"],
    target: "> 95%",
    unit: "%",
    records: vendors.filter((v) => v.compliance !== "Compliant").map((v) => ({ label: `${v.code} · ${v.name}`, value: v.compliance, highlight: true })),
  },
  otif: {
    kpiId: "KPI04-Vendor · #3",
    formula: `(\n  COUNT(02_PO_Dump.purchasing_document\n    WHERE 04_GRN_Dump.posting_date\n      ≤ 03_PO_Delivery_Dump.expected_delivery_date)\n  /\n  COUNT(02_PO_Dump.purchasing_document\n    WHERE delivery_completed = 'X')\n) × 100`,
    sourceDatasets: ["02_PO_Dump", "03_PO_Delivery", "04_GRN_Dump"],
    sourceFields: ["purchasing_document", "posting_date", "expected_delivery_date", "delivery_completed"],
    target: "> 90%",
    unit: "%",
    records: [...vendors].sort((a, b) => a.otifRate - b.otifRate).slice(0, 5).map((v) => ({ label: v.name, value: `${v.otifRate}%`, highlight: v.otifRate < 85 })),
  },
  avgDelay: {
    kpiId: "KPI04-Vendor · #4",
    formula: `AVG(\n  DATEDIFF(\n    04_GRN_Dump.posting_date,\n    03_PO_Delivery_Dump.expected_delivery_date\n  )\n)\nWHERE GRN.posting_date > expected_delivery_date\n— grouped by vendor`,
    sourceDatasets: ["03_PO_Delivery_Dump", "04_GRN_Dump"],
    sourceFields: ["posting_date", "expected_delivery_date", "vendor"],
    target: "≤ 3 days",
    unit: "Days",
    records: [...vendors].sort((a, b) => b.responsivenessDays - a.responsivenessDays).slice(0, 5).map((v) => ({ label: v.name, value: `${v.responsivenessDays}d`, highlight: v.responsivenessDays > 5 })),
  },
  quantityVariance: {
    kpiId: "KPI04-Vendor · #5",
    formula: `(\n  COUNT(GRN lines WHERE\n    04_GRN_Dump.quantity < 02_PO_Dump.order_quantity)\n  /\n  COUNT(04_GRN_Dump.material_document)\n) × 100\n— grouped by vendor`,
    sourceDatasets: ["02_PO_Dump", "04_GRN_Dump"],
    sourceFields: ["quantity", "order_quantity", "material_document", "vendor"],
    target: "< 5%",
    unit: "%",
  },
  spendShare: {
    kpiId: "KPI04-Vendor · #6",
    formula: `(\n  SUM(02_PO_Dump.net_order_value WHERE vendor = X)\n  /\n  SUM(02_PO_Dump.net_order_value)\n) × 100\n— for each vendor, ranked desc`,
    sourceDatasets: ["02_PO_Dump", "08_Vendor_Master"],
    sourceFields: ["net_order_value", "vendor"],
    target: "Top vendor < 20%",
    unit: "%",
    records: (() => {
      const total = vendors.reduce((s, v) => s + v.spendYTD, 0);
      return [...vendors].sort((a, b) => b.spendYTD - a.spendYTD).slice(0, 5).map((v) => ({ label: v.name, value: `${((v.spendYTD / total) * 100).toFixed(1)}%`, highlight: (v.spendYTD / total) * 100 > 15 }));
    })(),
  },
  paymentBlock: {
    kpiId: "KPI04-Vendor · #7",
    formula: `COUNT(08_Vendor_Master.vendor)\nWHERE payment_block = '*'\n  OR central_posting_block = 'X'\n  OR posting_block_cc = 'X'`,
    sourceDatasets: ["08_Vendor_Master"],
    sourceFields: ["vendor", "payment_block", "central_posting_block", "posting_block_cc"],
    target: "≤ 5 (investigate each)",
    unit: "Count",
    records: vendors.filter((v) => v.compliance === "Non-Compliant").map((v) => ({ label: `${v.code} · ${v.name}`, value: "Blocked", highlight: true })),
  },
  masterChangeFreq: {
    kpiId: "KPI04-Vendor · #8",
    formula: `COUNT(09_Change_Log.change_number)\nWHERE object_class = 'KRED'\n  AND change_date BETWEEN month_start AND today\n— grouped by vendor`,
    sourceDatasets: ["09_Change_Log"],
    sourceFields: ["change_number", "object_class", "change_date", "vendor"],
    target: "< 3 changes per vendor per month",
    unit: "Count",
    note: "High frequency of vendor master changes may indicate a control gap.",
  },
};

// ═══════════════════════════════════════════
// KPI_05 — Utilization Dashboard
// ═══════════════════════════════════════════

export const util: Record<string, KpiDrillDownData> = {
  totalITSpend: {
    kpiId: "KPI05-Utilization · #1",
    formula: `SUM(02_PO_Dump.net_order_value)\nWHERE material_group IN\n  ['IT', 'CLOUD', 'LICENSE', 'SOFTWARE']\n  AND document_date BETWEEN FY_start AND today`,
    sourceDatasets: ["02_PO_Dump"],
    sourceFields: ["net_order_value", "material_group", "document_date"],
    target: "Within IT budget",
    unit: "INR",
    records: [...utilization].sort((a, b) => b.monthlyCost - a.monthlyCost).slice(0, 5).map((u) => ({ label: u.toolName, value: formatINR(u.monthlyCost * 12) })),
  },
  licenseUtil: {
    kpiId: "KPI05-Utilization · #2",
    formula: `(\n  Active Users / Total Licenses Owned\n) × 100\n— Total Licenses from 02_PO_Dump.order_quantity\n  for SOFTWARE material group\n— Active Users from license mgmt system feed`,
    sourceDatasets: ["02_PO_Dump", "License Mgmt feed (external)"],
    sourceFields: ["order_quantity", "material_group", "active_users (external)"],
    target: "> 80%",
    unit: "%",
    records: [...utilization].sort((a, b) => a.utilPercent - b.utilPercent).slice(0, 5).map((u) => ({ label: u.toolName, value: `${u.utilPercent}%`, highlight: u.utilPercent < 50 })),
    note: "License usage data must come from a separate IT license management feed (Flexera, Snow, ServiceNow SAM, or manual upload).",
  },
  costPerUser: {
    kpiId: "KPI05-Utilization · #3",
    formula: `(\n  Annual License Cost / Active Users\n)\n— for each tool, where Annual Cost =\n  SUM(02_PO_Dump.net_order_value) for that material`,
    sourceDatasets: ["02_PO_Dump", "License Mgmt feed"],
    sourceFields: ["net_order_value", "material", "active_users"],
    target: "Benchmarked per tool",
    unit: "INR/user",
    records: [...utilization].sort((a, b) => b.costPerActiveUser - a.costPerActiveUser).slice(0, 5).map((u) => ({ label: u.toolName, value: `₹${u.costPerActiveUser.toLocaleString("en-IN")}`, highlight: u.costPerActiveUser > 5000 })),
  },
  underutilized: {
    kpiId: "KPI05-Utilization · #4",
    formula: `COUNT(tools\n  WHERE License Utilization Rate < 50%)\n— flags candidates for renegotiation / cancellation`,
    sourceDatasets: ["Derived from KPI 2"],
    sourceFields: ["tool_name", "utilization_rate"],
    target: "≤ 5 tools",
    unit: "Count",
    records: utilization.filter((u) => u.optimizationFlag === "Underutilized").map((u) => ({ label: `${u.toolName} (${u.vendor})`, value: `${u.utilPercent}%`, highlight: true })),
  },
  upcomingRenewals: {
    kpiId: "KPI05-Utilization · #5",
    formula: `COUNT(contracts\n  WHERE expected_delivery_date\n    BETWEEN today AND today + 60 days\n  AND material_group IN\n    ['IT','CLOUD','LICENSE','SOFTWARE'])\n— joins 02_PO_Dump with 03_PO_Delivery_Dump`,
    sourceDatasets: ["02_PO_Dump", "03_PO_Delivery_Dump"],
    sourceFields: ["expected_delivery_date", "material_group"],
    target: "Tracked, not target",
    unit: "Count",
    records: utilization
      .filter((u) => { const d = Math.ceil((+new Date(u.renewalDate) - Date.now()) / 86400000); return d > 0 && d <= 60; })
      .map((u) => ({ label: `${u.toolName} (${u.vendor})`, value: `${Math.ceil((+new Date(u.renewalDate) - Date.now()) / 86400000)}d` })),
  },
  potentialSavings: {
    kpiId: "KPI05-Utilization · #6",
    formula: `SUM(\n  Annual Cost × (1 - Utilization%)\n) / 12\n— for tools where utilization < 80%\n  prorated to monthly`,
    sourceDatasets: ["Derived from KPIs 1, 2, 4"],
    sourceFields: ["annual_cost", "utilization_rate"],
    target: "Identify max",
    unit: "INR/month",
    records: [...utilization].filter((u) => u.potentialSavings > 0).sort((a, b) => b.potentialSavings - a.potentialSavings).slice(0, 5).map((u) => ({ label: u.toolName, value: `${formatINR(u.potentialSavings)}/mo`, highlight: true })),
  },
};
