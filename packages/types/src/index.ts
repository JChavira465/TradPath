export type UserRole = "OWNER" | "MANAGER" | "EMPLOYEE" | "TECHNICIAN";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  role: UserRole;
}

export interface LoginResponse {
  mfaRequired: false;
  accessToken: string;
  user: AuthUser;
}

export interface MfaRequiredResponse {
  mfaRequired: true;
  mfaChallengeToken: string;
}

export type LoginResult = LoginResponse | MfaRequiredResponse;

export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
}

export type JobStatus = "SCHEDULED" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
export type JobPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type JobType = "ONE_TIME" | "RECURRING";

export interface JobCustomer {
  id: string;
  firstName: string;
  lastName: string;
  company: string | null;
  phone: string | null;
  email: string | null;
}

export interface Job {
  id: string;
  jobNumber: string;
  title: string;
  description: string | null;
  status: JobStatus;
  priority: JobPriority;
  type: JobType;
  serviceAddress: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  assignedUserIds: string[];
  internalNotes: string | null;
  customerNotes: string | null;
  completionNotes: string | null;
  onMyWaySentAt: string | null;
  customerId: string;
  customer?: JobCustomer;
  createdAt: string;
  updatedAt: string;
}

export interface JobsListResult {
  items: Job[];
  total: number;
  page: number;
  pageSize: number;
}

export type PropertyType = "RESIDENTIAL" | "COMMERCIAL";

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  altPhone: string | null;
  serviceAddress: string | null;
  billingAddress: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  propertyType: PropertyType;
  tags: string[];
  source: string | null;
  notes: string | null;
  outstandingBalance: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerEquipment {
  id: string;
  customerId: string;
  name: string;
  type: string | null;
  make: string | null;
  model: string | null;
  serialNumber: string | null;
  installDate: string | null;
  warrantyExpiry: string | null;
  lastServiceDate: string | null;
  nextServiceDate: string | null;
  notes: string | null;
  createdAt: string;
}

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxable?: boolean;
}

export type EstimateStatus = "DRAFT" | "SENT" | "VIEWED" | "APPROVED" | "DECLINED" | "EXPIRED" | "CONVERTED";
export type InvoiceStatus = "DRAFT" | "SENT" | "VIEWED" | "PARTIAL" | "PAID" | "OVERDUE" | "VOID";
export type PaymentMethod = "STRIPE" | "CASH" | "CHECK" | "BANK_TRANSFER" | "OTHER";

export interface Estimate {
  id: string;
  estimateNumber: string;
  title: string;
  status: EstimateStatus;
  jobId: string | null;
  customerId: string;
  customer?: JobCustomer;
  validUntil: string | null;
  lineItems: LineItem[];
  subtotal: string;
  taxRate: string;
  taxAmount: string;
  discountAmount: string;
  total: string;
  notes: string | null;
  termsAndConditions: string | null;
  sentAt: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  jobId: string | null;
  customerId: string;
  customer?: JobCustomer;
  dueDate: string | null;
  lineItems: LineItem[];
  subtotal: string;
  taxRate: string;
  taxAmount: string;
  discountAmount: string;
  total: string;
  amountPaid: string;
  amountDue: string;
  notes: string | null;
  termsAndConditions: string | null;
  sentAt: string | null;
  paidAt: string | null;
  payments?: Payment[];
  createdAt: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: string;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  paidAt: string;
}

export interface ArSummary {
  totalOutstanding: number;
  invoiceCount: number;
  buckets: {
    current: number;
    days1to30: number;
    days31to60: number;
    days61to90: number;
    days90plus: number;
  };
}

export interface PublicInvoice extends Invoice {
  organization: { name: string; logo: string | null; bookingPageColor: string | null };
}

export type ServicePlanStatus = "ACTIVE" | "PAUSED" | "CANCELLED" | "EXPIRED";
export type BillingCycle = "MONTHLY" | "ANNUAL";
export type ServiceFrequency = "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY" | "BIANNUAL" | "ANNUAL";

export interface ServicePlan {
  id: string;
  name: string;
  description: string | null;
  status: ServicePlanStatus;
  billingCycle: BillingCycle;
  price: string;
  serviceFrequency: ServiceFrequency;
  serviceDescription: string | null;
  nextBillingDate: string | null;
  nextServiceDate: string | null;
  customerId: string;
  customer?: JobCustomer;
  autoGenerateJobs: boolean;
  autoSendInvoice: boolean;
  isPublic: boolean;
  publicName: string | null;
  publicDescription: string | null;
  startDate: string;
  endDate: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
}

export interface ServicePlanDashboard {
  mrr: number;
  arr: number;
  activeCount: number;
  byStatus: Record<string, number>;
  churnedLast30Days: number;
}

export interface ServiceOffering {
  id: string;
  name: string;
  description: string | null;
  duration: number | null;
  price: string | null;
  priceType: "FIXED" | "STARTING_AT" | "FREE_ESTIMATE";
  isBookable: boolean;
}

export interface BookingPage {
  name: string;
  bookingPageTitle: string | null;
  bookingPageDescription: string | null;
  bookingPageLogo: string | null;
  bookingPageColor: string | null;
  timezone: string;
}

export interface PublicPlanTemplate {
  id: string;
  publicName: string | null;
  publicDescription: string | null;
  price: string;
  billingCycle: BillingCycle;
  serviceFrequency: ServiceFrequency;
}

export type BookingRequestStatus = "PENDING" | "CONFIRMED" | "DECLINED" | "CANCELLED";

export interface BookingRequest {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  serviceAddress: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  status: BookingRequestStatus;
  requestedDate: string | null;
  requestedTimeSlot: string | null;
  notes: string | null;
  confirmationCode: string;
  createdAt: string;
}

export interface BookingAvailability {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export interface BookingBlackout {
  id: string;
  date: string;
  reason: string | null;
}

export interface BookingSettings {
  bookingEnabled: boolean;
  bookingSlug: string | null;
  bookingPageTitle: string | null;
  bookingPageDescription: string | null;
  bookingPageLogo: string | null;
  bookingPageColor: string | null;
}

export type PriceBookCategory = "LABOR" | "MATERIAL" | "SERVICE";

export interface PriceBookItem {
  id: string;
  name: string;
  description: string | null;
  category: PriceBookCategory;
  unitPrice: string;
  unit: string;
  taxable: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface PriceBookImportResult {
  imported: number;
  errors: { row: number; message: string }[];
}

export type MessageDirection = "INBOUND" | "OUTBOUND";

export interface JobTextMessage {
  id: string;
  jobId: string | null;
  customerId: string | null;
  direction: MessageDirection;
  body: string;
  twilioSid: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProvisionNumberResult {
  phoneNumber: string | null;
  provisioned: boolean;
}
