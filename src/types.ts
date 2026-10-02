export type AppMode =
  | 'LANDLORD'
  | 'TENANT';

export type LanguageCode =
  | 'uk'
  | 'en'
  | 'de'
  | 'ru';

export type CurrencyCode =
  | 'UAH'
  | 'USD'
  | 'EUR';

export type PropertyStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'ARCHIVED';

export type InvoiceStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'VOID';

export type PaymentMethod =
  | 'BANK_TRANSFER'
  | 'CASH'
  | 'CARD'
  | 'OTHER';

export type MeterBillingMode =
  | 'METERED'
  | 'FIXED'
  | 'VARIABLE';

export type TenancyStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'CHECKOUT_PENDING'
  | 'ENDED'
  | 'CANCELLED';

export type InvitationStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'REVOKED';

export type TenancyReadingType =
  | 'MOVE_IN'
  | 'MOVE_OUT';


export interface Workspace {
  id:
    string;

  name:
    string;

  baseCurrency:
    CurrencyCode;

  timezone:
    string;
}


export interface UserSettings {
  language:
    LanguageCode;

  region:
    string;

  timezone:
    string;

  displayCurrency:
    CurrencyCode;

  activeMode:
    AppMode;

  pushEnabled:
    boolean;
}


export interface Property {
  id:
    string;

  workspaceId:
    string;

  name:
    string;

  address:
    string;

  city:
    string;

  areaM2:
    number;

  status:
    PropertyStatus;

  /*
   * Legacy presentation fields.
   *
   * Tenancies are the source of truth for occupancy.
   * These can be removed after every property card
   * reads tenancy data directly.
   */
  tenantName?:
    string;

  tenantId?:
    string;

  rentAmount:
    number;

  rentCurrency:
    CurrencyCode;

  utilitiesCurrency:
    CurrencyCode;

  paymentDueDay:
    number;
}


export interface MeterRegister {
  id:
    string;

  code:
    string;

  name:
    string;

  unit:
    string;

  tariff:
    number;

  tariffCurrency:
    CurrencyCode;

  /*
   * Used internally for validation and
   * consumption calculations.
   *
   * Reading screens must still open with
   * an empty current-reading field.
   */
  previousValue:
    number;

  currentValue?:
    number;

  lastValue?:
    number;

  lastReadingAt?:
    string;

  lastBillingPeriod?:
    string;

  photoUri?:
    string;

  photoPath?:
    string;

  lastPhotoUri?:
    string;

  lastPhotoPath?:
    string;
}


export interface Meter {
  id:
    string;

  serviceId:
    string;

  propertyId:
    string;

  name:
    string;

  category:
    | 'ELECTRICITY'
    | 'WATER'
    | 'GAS'
    | 'HEAT'
    | 'CUSTOM';

  billingMode:
    MeterBillingMode;

  serialNumber?:
    string;

  unit:
    string;

  registers:
    MeterRegister[];

  fixedAmount?:
    number;

  currentAmount?:
    number;

  lastAmount?:
    number;

  lastAmountAt?:
    string;

  lastBillingPeriod?:
    string;

  billingCurrency?:
    CurrencyCode;
}


export interface PropertyInput {
  city:
    string;

  address:
    string;

  name?:
    string;

  areaM2?:
    number;
}


export interface MeterInput {
  propertyId:
    string;

  category:
    Meter['category'];

  name?:
    string;

  dualTariff?:
    boolean;

  billingMode:
    MeterBillingMode;

  tariff?:
    number;

  tariffT1?:
    number;

  tariffT2?:
    number;

  tariffCurrency?:
    CurrencyCode;

  fixedAmount?:
    number;

  billingCurrency?:
    CurrencyCode;
}


export interface MeterReadingInput {
  registerId:
    string;

  currentValue:
    number;

  photoUri?:
    string;
}


/*
 * ==========================================================
 * TENANT PROFILE
 * ==========================================================
 */

export interface TenantProfileInput {
  firstName:
    string;

  lastName:
    string;

  phone:
    string;

  email:
    string;

  passportIdNumber?:
    string;

  passportPhotoUri?:
    string;

  emergencyContact?:
    string;

  notes?:
    string;
}


export interface TenantProfile {
  userId:
    string;

  firstName:
    string;

  lastName:
    string;

  phone:
    string;

  email:
    string;

  passportIdNumber?:
    string;

  passportPhotoPath?:
    string;

  passportPhotoUri?:
    string;

  emergencyContact?:
    string;

  notes?:
    string;
}


export interface ManualTenantContact {
  id:
    string;

  workspaceId:
    string;

  firstName:
    string;

  lastName:
    string;

  phone:
    string;

  email:
    string;

  passportIdNumber?:
    string;

  passportPhotoPath?:
    string;

  passportPhotoUri?:
    string;

  emergencyContact?:
    string;

  notes?:
    string;
}


/*
 * ==========================================================
 * TENANCY METER READINGS
 * ==========================================================
 */

export interface TenancyOpeningReadingInput {
  meterRegisterId:
    string;

  value:
    number;
}


export interface TenancyMeterReading {
  id:
    string;

  tenancyId:
    string;

  meterRegisterId:
    string;

  meterId:
    string;

  meterName:
    string;

  registerCode:
    string;

  registerName:
    string;

  unit:
    string;

  type:
    TenancyReadingType;

  date:
    string;

  value:
    number;
}

/*
 * Backwards-compatible alias.
 *
 * tenantRepository still uses the previous name.
 * We will remove this alias when that repository
 * is cleaned up.
 */
export type TenantMeterReading =
  TenancyMeterReading;


/*
 * ==========================================================
 * RENTAL TERMS
 * ==========================================================
 */

export interface TenancyTermsInput {
  rentAmount:
    number;

  currency:
    CurrencyCode;

  startDate:
    string;

  paymentDueDay:
    number;

  endDate?:
    string;

  depositAmount?:
    number;

  depositCurrency?:
    CurrencyCode;

  agreementUri?:
    string;

  autoProlongation:
    boolean;

  openingReadings?:
    TenancyOpeningReadingInput[];
}


export interface RentTerms {
  id:
    string;

  tenancyId:
    string;

  rentAmount:
    number;

  currency:
    CurrencyCode;

  paymentDueDay:
    number;

  depositAmount?:
    number;

  depositCurrency?:
    CurrencyCode;

  validFrom:
    string;

  validTo?:
    string;
}


/*
 * ==========================================================
 * TENANCY
 * ==========================================================
 */

export interface Tenancy {
  id:
    string;

  propertyId:
    string;

  status:
    TenancyStatus;

  startDate:
    string;

  endDate?:
    string;

  autoProlongation:
    boolean;

  agreementPath?:
    string;

  agreementUri?:
    string;

  manualTenant?:
    ManualTenantContact;

  tenantProfile?:
    TenantProfile;

  rentTerms?:
    RentTerms;

  openingReadings?:
    TenancyMeterReading[];
}


/*
 * ==========================================================
 * INVITATION
 * ==========================================================
 */

export interface TenantInvitation {
  id:
    string;

  tenancyId:
    string;

  propertyId:
    string;

  propertyName:
    string;

  propertyAddress:
    string;

  propertyCity:
    string;

  rentAmount:
    number;

  currency:
    CurrencyCode;

  paymentDueDay:
    number;

  startDate:
    string;

  endDate?:
    string;

  depositAmount?:
    number;

  depositCurrency?:
    CurrencyCode;

  status:
    InvitationStatus;

  expiresAt:
    string;
}


export interface CreatedTenantInvitation {
  tenancyId:
    string;

  invitationId:
    string;

  token:
    string;

  expiresAt:
    string;

  link:
    string;
}


/*
 * ==========================================================
 * REMINDERS
 * ==========================================================
 */

export interface Reminder {
  id:
    string;

  type:
    | 'RENT_DUE'
    | 'METER_READINGS'
    | 'PAYMENT_OVERDUE';

  propertyId:
    string;

  title:
    string;

  dueText:
    string;

  completed:
    boolean;
}


/*
 * ==========================================================
 * GLOBAL APPLICATION STATE
 * ==========================================================
 *
 * Finance does not belong in AppState.
 *
 * Invoices, payments, debt, advance and financial KPIs
 * are loaded from Supabase through financeRepository.
 */

export interface AppState {
  workspace:
    Workspace | null;

  settings:
    UserSettings;

  properties:
    Property[];

  meters:
    Meter[];

  reminders:
    Reminder[];
}