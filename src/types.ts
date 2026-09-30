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

export type MeterBillingMode =
  | 'METERED'
  | 'FIXED'
  | 'VARIABLE';

export interface Workspace {
  id: string;

  name: string;

  baseCurrency:
    CurrencyCode;

  timezone: string;
}

export interface UserSettings {
  language:
    LanguageCode;

  region: string;

  timezone: string;

  displayCurrency:
    CurrencyCode;

  activeMode:
    AppMode;

  pushEnabled:
    boolean;
}

export interface Property {
  id: string;

  workspaceId: string;

  name: string;

  address: string;

  city: string;

  areaM2: number;

  status:
    PropertyStatus;

  tenantName?: string;

  tenantId?: string;

  /*
   * Rent / tenancy will move to
   * Supabase in the next backend step.
   */
  rentAmount: number;

  rentCurrency:
    CurrencyCode;

  utilitiesCurrency:
    CurrencyCode;

  paymentDueDay: number;
}

export interface MeterRegister {
  id: string;

  code: string;

  name: string;

  unit: string;

  tariff: number;

  tariffCurrency:
    CurrencyCode;

  /*
   * Value that a new reading
   * must be greater than or equal to.
   */
  previousValue: number;

  /*
   * Reading entered for the
   * current billing period.
   */
  currentValue?: number;

  /*
   * Latest reading ever saved.
   */
  lastValue?: number;

  lastReadingAt?: string;

  lastBillingPeriod?: string;

  /*
   * Current billing period photo.
   */
  photoUri?: string;

  photoPath?: string;

  /*
   * Latest stored photo,
   * regardless of billing period.
   */
  lastPhotoUri?: string;

  lastPhotoPath?: string;
}

export interface Meter {
  /*
   * Actual meter id for metered services.
   *
   * For FIXED / VARIABLE custom services,
   * serviceId is used here as well.
   */
  id: string;

  serviceId: string;

  propertyId: string;

  name: string;

  category:
    | 'ELECTRICITY'
    | 'WATER'
    | 'GAS'
    | 'HEAT'
    | 'CUSTOM';

  billingMode:
    MeterBillingMode;

  serialNumber?: string;

  unit: string;

  registers:
    MeterRegister[];

  fixedAmount?: number;

  currentAmount?: number;

  lastAmount?: number;

  lastAmountAt?: string;

  lastBillingPeriod?: string;

  billingCurrency?:
    CurrencyCode;
}

export interface PropertyInput {
  city: string;

  address: string;

  name?: string;

  areaM2?: number;
}

export interface MeterInput {
  propertyId: string;

  category:
    Meter['category'];

  name?: string;

  dualTariff?: boolean;

  billingMode:
    MeterBillingMode;

  tariff?: number;

  tariffT1?: number;

  tariffT2?: number;

  tariffCurrency?:
    CurrencyCode;

  fixedAmount?: number;

  billingCurrency?:
    CurrencyCode;
}

export interface MeterReadingInput {
  registerId: string;

  currentValue: number;

  photoUri?: string;
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

  currency:
    CurrencyCode;

  details?: string;
}

export interface Invoice {
  id: string;

  propertyId: string;

  tenantName: string;

  period: string;

  issueDate: string;

  dueDate: string;

  status:
    InvoiceStatus;

  lines:
    InvoiceLine[];
}

export interface Payment {
  id: string;

  propertyId: string;

  tenantName: string;

  amount: number;

  currency:
    CurrencyCode;

  date: string;

  method:
    PaymentMethod;

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
  workspace:
    Workspace | null;

  settings:
    UserSettings;

  properties:
    Property[];

  meters:
    Meter[];

  /*
   * These stay empty until their own
   * Supabase tables are connected.
   *
   * They are NOT persisted locally.
   */
  invoices:
    Invoice[];

  payments:
    Payment[];

  reminders:
    Reminder[];
}