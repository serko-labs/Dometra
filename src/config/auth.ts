export type AppMode =
  'LANDLORD' | 'TENANT';

export type LanguageCode =
  'uk' | 'en' | 'de' | 'ru';

export type CurrencyCode =
  'UAH' | 'USD' | 'EUR';

export type PropertyStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'ARCHIVED';

export type InvoiceStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE';

export type PaymentMethod =
  | 'BANK_TRANSFER'
  | 'CASH'
  | 'CARD'
  | 'OTHER';

export interface UserSettings {
  language: LanguageCode;
  region: string;
  timezone: string;
  displayCurrency: CurrencyCode;
  activeMode: AppMode;
  pushEnabled: boolean;
}

export interface Property {
  id: string;

  name: string;
  address: string;
  city: string;

  areaM2: number;

  status: PropertyStatus;

  tenantName?: string;
  tenantId?: string;

  rentAmount: number;
  rentCurrency: CurrencyCode;

  utilitiesCurrency: CurrencyCode;

  paymentDueDay: number;
}

export interface MeterRegister {
  id: string;

  code: string;
  name: string;

  unit: string;

  tariff: number;

  tariffCurrency: CurrencyCode;

  previousValue: number;

  currentValue?: number;

  photoUri?: string;
}

export interface Meter {
  id: string;

  propertyId: string;

  name: string;

  category:
    | 'ELECTRICITY'
    | 'WATER'
    | 'GAS'
    | 'HEAT'
    | 'CUSTOM';

  serialNumber?: string;

  unit: string;

  registers: MeterRegister[];
}

export interface InvoiceLine {
  id: string;

  type:
    | 'RENT'
    | 'UTILITY'
    | 'FIXED_CHARGE'
    | 'CUSTOM_CHARGE';

  label: string;

  amount: number;

  currency: CurrencyCode;

  details?: string;
}

export interface Invoice {
  id: string;

  propertyId: string;

  tenantName: string;

  period: string;

  issueDate: string;
  dueDate: string;

  status: InvoiceStatus;

  lines: InvoiceLine[];
}

export interface Payment {
  id: string;

  propertyId: string;

  tenantName: string;

  amount: number;

  currency: CurrencyCode;

  date: string;

  method: PaymentMethod;

  allocated: boolean;

  note?: string;
}

export interface Reminder {
  id: string;

  type:
    | 'RENT_DUE'
    | 'METER_READINGS'
    | 'PAYMENT_OVERDUE';

  propertyId: string;

  title: string;

  dueText: string;

  completed: boolean;
}

export interface AppState {
  settings: UserSettings;

  properties: Property[];

  meters: Meter[];

  invoices: Invoice[];

  payments: Payment[];

  reminders: Reminder[];
}

export const AUTH_CALLBACK_URL =
  'dometra://auth/callback';