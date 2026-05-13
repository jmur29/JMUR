export type UserRole = 'ADMIN' | 'UNDERWRITER' | 'VIEWER';
export type ApplicationStatus =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'DECLINED'
  | 'CONDITIONALLY_APPROVED';
export type BorrowerType = 'PRIMARY' | 'CO_BORROWER';
export type EmploymentType =
  | 'EMPLOYED'
  | 'SELF_EMPLOYED'
  | 'CONTRACT'
  | 'RETIRED'
  | 'OTHER';
export type PropertyType =
  | 'DETACHED'
  | 'SEMI'
  | 'TOWNHOUSE'
  | 'CONDO'
  | 'DUPLEX'
  | 'OTHER';
export type OccupancyType = 'OWNER' | 'RENTAL' | 'SECONDARY';
export type DocumentType =
  | 'PAYSTUB'
  | 'T4'
  | 'NOA'
  | 'BANK_STATEMENT'
  | 'ID'
  | 'APPRAISAL'
  | 'OTHER';
export type DocumentStatus = 'PENDING' | 'REVIEWED' | 'APPROVED' | 'REJECTED';
export type UWDecision = 'APPROVE' | 'MANUAL_REVIEW' | 'DECLINE';
export type FlagType = 'PASS' | 'WARN' | 'FAIL' | 'INFO';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string;
}

export interface User {
  id: string;
  tenantId: string;
  clerkId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
}

export interface Borrower {
  id: string;
  applicationId: string;
  type: BorrowerType;
  firstName: string;
  lastName: string;
  dob: string;
  email: string;
  phone: string;
  sin?: string;
  employmentType: EmploymentType;
  creditScore: number;
  bankruptcies: boolean;
  collections: boolean;
  existingMortgages: number;
  income?: Income;
}

export interface Income {
  id: string;
  borrowerId: string;
  employerName: string | null;
  jobTitle: string | null;
  yearsEmployed: number | null;
  baseSalary: number;
  bonus: number;
  overtime: number;
  otherIncome: number;
  selfEmployedAvg: number | null;
  rentalIncome: number;
}

export interface Property {
  id: string;
  applicationId: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  propertyType: PropertyType;
  occupancy: OccupancyType;
  purchasePrice: number;
  appraisedValue: number;
  downPayment: number;
  annualTax: number;
  monthlyHeat: number;
  condoFees: number;
}

export interface MortgageTerms {
  id: string;
  applicationId: string;
  contractRate: number;
  stressRate: number;
  amortizationYears: number;
  termYears: number;
  insured: boolean;
  monthlyPayment: number;
  mortgageAmount: number;
}

export interface UWFlag {
  type: FlagType;
  message: string;
  field?: string;
}

export interface UnderwritingDecision {
  id: string;
  applicationId: string;
  gds: number;
  tds: number;
  ltv: number;
  stressGds: number;
  stressTds: number;
  decision: UWDecision;
  flags: UWFlag[];
  notes: string | null;
  decidedById: string;
  decidedAt: string;
  decidedBy?: User;
  status?: ApplicationStatus;
}

export interface Document {
  id: string;
  applicationId: string;
  uploadedById: string;
  name: string;
  type: DocumentType;
  url: string;
  uploadedAt: string;
  status: DocumentStatus;
  uploadedBy?: User;
}

export interface Application {
  id: string;
  tenantId: string;
  fileNumber: string;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
  assignedToId: string | null;
  assignedTo?: User;
  borrowers: Borrower[];
  property?: Property;
  mortgageTerms?: MortgageTerms;
  decisions: UnderwritingDecision[];
  documents: Document[];
}

export interface UWResult {
  monthlyIncome: number;
  mortgageAmount: number;
  monthlyPayment: number;
  stressPayment: number;
  gds: number;
  tds: number;
  ltv: number;
  stressGds: number;
  stressTds: number;
  stressRate: number;
  flags: UWFlag[];
  decision: UWDecision;
  qualifyingIncome: {
    baseSalary: number;
    bonus: number;
    overtime: number;
    otherIncome: number;
    selfEmployed: number;
    rental: number;
    coApplicant: number;
    total: number;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PipelineStats {
  totalApplications: number;
  approvedThisMonth: number;
  inReview: number;
  avgGds: number;
  approvalRate: number;
  volumeByStatus: Record<ApplicationStatus, number>;
  monthlyTrend?: Array<{
    month: string;
    total: number;
    approved: number;
    declined: number;
  }>;
}

export interface ApplicationListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: ApplicationStatus | '';
  assignedToMe?: boolean;
}

export interface CreateApplicationPayload {
  borrower: Partial<Borrower>;
  property?: Partial<Property>;
  mortgageTerms?: Partial<MortgageTerms>;
}

export interface SaveDecisionPayload {
  notes?: string;
  status: ApplicationStatus;
}

export interface ApplicationNote {
  id: string;
  applicationId: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface ApprovalCondition {
  id: string;
  applicationId: string;
  body: string;
  cleared: boolean;
  clearedById: string | null;
  clearedAt: string | null;
  createdAt: string;
  clearedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
}

export type ApplicationStatusHistory = {
  id: string;
  applicationId: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  changedById: string;
  note: string | null;
  createdAt: string;
  changedBy?: User;
};

export interface AuditLog {
  id: string;
  tenantId: string;
  userId: string;
  applicationId: string | null;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
  };
}
