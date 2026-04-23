// Domain types for IntelliSource

export type Role =
  | "Procurement Manager"
  | "Delivery Manager"
  | "Finance User"
  | "Compliance Officer"
  | "CXO"
  | "Admin";

export type RiskTier = "Low" | "Medium" | "High";
export type ComplianceStatus = "Compliant" | "Under Review" | "Non-Compliant";
export type ContractStatus = "Active" | "Expiring Soon" | "Expired";
export type Region = "APAC" | "EMEA" | "Americas";
export type VendorCategory =
  | "IT Services"
  | "Consulting"
  | "Cloud Infrastructure"
  | "Security"
  | "Data Analytics"
  | "SaaS"
  | "Admin"
  | "Others";

export interface Vendor {
  id: string;
  code: string;
  name: string;
  category: VendorCategory;
  region: Region;
  rating: number; // 0-5
  deliveryScore: number; // 0-100
  qualityScore: number; // 0-100
  compliance: ComplianceStatus;
  abacCertified: boolean;
  activePOs: number;
  spendYTD: number;
  contractEnd: string; // ISO date
  contractStatus: ContractStatus;
  riskTier: RiskTier;
  singleSource: boolean;
  onboarded: string;
  responsivenessDays: number;
  otifRate: number;
}

export type POStatus =
  | "Approved"
  | "Pending"
  | "Under Review"
  | "Deleted"
  | "Cancelled";

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendorId: string;
  vendorName: string;
  projectId: string;
  projectName: string;
  value: number;
  status: POStatus;
  doaLevel: "L1" | "L2" | "L3" | "L4" | "CXO";
  daysOpen: number;
  createdBy: string;
  createdAt: string;
  hasComplianceBreach: boolean;
  amended: boolean;
  rateDeviation: number; // percent vs contract
}

export type ProjectHealth = "Healthy" | "At Risk" | "Critical";

export interface Project {
  id: string;
  code: string;
  name: string;
  client: string;
  revenue: number;
  cost: number;
  budget: number;
  gmPercent: number;
  utilPercent: number;
  health: ProjectHealth;
  startDate: string;
  endDate: string;
  division: string;
}

export interface FinancialPeriod {
  period: string; // "Apr-24"
  revenue: number;
  cost: number;
  margin: number; // percent
  budget: number;
  spend: number;
}

export type BreachType =
  | "ABAC Gift Threshold"
  | "Sanctions Match"
  | "DOA Bypass"
  | "Duplicate Invoice"
  | "Rate Deviation"
  | "Conflict of Interest";

export interface ComplianceCheck {
  id: string;
  vendorName: string;
  vendorId: string;
  poNumber?: string;
  type: BreachType;
  severity: "Low" | "Medium" | "High" | "Critical";
  status: "Pass" | "Fail" | "Pending";
  date: string;
  resolution?: string;
}

export interface UtilizationRecord {
  id: string;
  toolName: string;
  vendor: string;
  licensesOwned: number;
  activeUsers: number;
  utilPercent: number;
  monthlyCost: number;
  costPerActiveUser: number;
  renewalDate: string;
  category: "Compute" | "Storage" | "Networking" | "Databases" | "SaaS" | "Security Tools";
  optimizationFlag: "Underutilized" | "Optimal" | "Over-provisioned";
  potentialSavings: number;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  vendorName: string;
  poNumber: string;
  amount: number;
  status: "Paid" | "Pending" | "Overdue" | "Disputed" | "Credit Memo";
  ageDays: number;
  dueDate: string;
}

export type P2PStage =
  | "Requirement Analysis"
  | "Bidding"
  | "RFQ"
  | "Vendor Selection"
  | "Vendor Contracting"
  | "PR"
  | "PR Amendment"
  | "PR Approval"
  | "PO Creation"
  | "PO Amendment"
  | "PO Approval"
  | "GRN Creation"
  | "GRN Return"
  | "Invoicing"
  | "Invoice Adjustment"
  | "Payment Settlement";

export interface P2PItem {
  id: string;
  txnId: string;
  type: "PR" | "PO" | "GRN" | "Invoice";
  stage: P2PStage;
  vendor: string;
  project: string;
  value: number;
  daysInStage: number;
  owner: string;
  status: string;
  nextAction: string;
  slaDays: number;
}

export interface ActionItem {
  id: string;
  title: string;
  type: "Compliance" | "Cost Save" | "Renewal" | "Vendor" | "Process";
  status: "Open" | "In Progress" | "Under Review" | "Closed";
  owner: string;
  impact: number;
  dueDate: string;
  priority: "Low" | "Medium" | "High";
  linkedTo?: string;
}

export interface AuditLog {
  id: string;
  user: string;
  action: string;
  entity: string;
  timestamp: string;
  details: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  severity: "info" | "warning" | "critical";
  read: boolean;
}
