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
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  plan: SubscriptionPlan;
}
