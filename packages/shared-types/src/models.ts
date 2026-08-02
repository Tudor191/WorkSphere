export interface Company {
  id: string;
  slug: string;
  name: string;
  cui: string | null;
  vatPayer: boolean;
  address: string | null;
  email: string | null;
  phone: string | null;
  logoUrl: string | null;
  language: string;
  currency: string;
  timezone: string;
  theme: string;
  workingHoursStart: string;
  workingHoursEnd: string;
  trialEndsAt: string | null;
}

export interface SafeUser {
  id: string;
  companyId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  phone: string | null;
  roleId: string;
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED';
  lastLoginAt: string | null;
}

export interface Role {
  id: string;
  name: string;
  systemKey: string | null;
  isSystem: boolean;
}

export interface Department {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  managerId: string | null;
  parentDepartmentId: string | null;
  _count?: { employees: number; subDepartments: number };
}

export type ContractType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACTOR' | 'INTERN';

export interface Employee {
  id: string;
  companyId: string;
  userId: string;
  employeeCode: string;
  departmentId: string | null;
  position: string;
  managerId: string | null;
  contractType: ContractType;
  hireDate: string;
  endDate: string | null;
  annualLeaveDays: number;
  user: SafeUser;
  department?: Department | null;
}

export interface LeaveType {
  id: string;
  companyId: string;
  name: string;
  colorHex: string;
  isPaid: boolean;
  defaultDaysPerYear: number | null;
}

export type LeaveRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';

export interface LeaveRequest {
  id: string;
  companyId: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  daysCount: string;
  reason: string | null;
  status: LeaveRequestStatus;
  approvedById: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  leaveType: LeaveType;
  employee?: Employee;
}

export interface LeaveBalance {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  year: number;
  totalDays: string;
  usedDays: string;
  leaveType: LeaveType;
}

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'ON_LEAVE';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  checkInAt: string;
  checkOutAt: string | null;
  workedMinutes: number | null;
  overtimeMinutes: number;
  status: AttendanceStatus;
  employee?: Employee;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  priceMonthlyCents: number;
  priceYearlyCents: number;
  currency: string;
  maxEmployees: number;
  features: { modules: string[]; aiCreditsPerMonth: number };
  isActive: boolean;
}

export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE';
export type BillingCycle = 'MONTHLY' | 'YEARLY';

export interface Subscription {
  id: string;
  companyId: string;
  planId: string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  stripeCustomerId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  plan: SubscriptionPlan;
}

export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELED';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Project {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: string | null;
  deadline: string | null;
  createdAt: string;
  _count?: { tasks: number };
  tasks?: Task[];
}

export interface Task {
  id: string;
  companyId: string;
  projectId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  createdById: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  assignee?: SafeUser | null;
  createdBy?: SafeUser;
  project?: { id: string; name: string } | null;
}

export interface Client {
  id: string;
  companyId: string;
  name: string;
  cui: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  ownerId: string | null;
  createdAt: string;
  owner?: SafeUser | null;
  _count?: { tasks: number; notes: number; projects: number };
}

export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'PROPOSAL' | 'WON' | 'LOST';

export interface Lead {
  id: string;
  companyId: string;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: LeadStatus;
  valueCents: number | null;
  ownerId: string | null;
  pipelineStageId: string | null;
  createdAt: string;
  updatedAt: string;
  owner?: SafeUser | null;
}

export interface Product {
  id: string;
  companyId: string;
  name: string;
  sku: string;
  barcode: string | null;
  qrCode: string | null;
  category: string | null;
  unitPriceCents: number;
  currency: string;
  unit: string;
  stockQuantity: string;
  minStockAlert: string | null;
  createdAt: string;
  stockMovements?: StockMovement[];
}

export type StockMovementType = 'IN' | 'OUT';

export interface StockMovement {
  id: string;
  companyId: string;
  productId: string;
  type: StockMovementType;
  quantity: string;
  reason: string | null;
  performedById: string;
  createdAt: string;
  product?: { id: string; name: string; sku: string; unit: string };
}

export interface ChatChannel {
  id: string;
  companyId: string;
  name: string;
  isPrivate: boolean;
  createdAt: string;
  _count?: { messages: number; members: number };
}

export interface ChatMessage {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  editedAt: string | null;
  createdAt: string;
  author: SafeUser;
}
