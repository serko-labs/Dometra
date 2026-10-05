import {
  Meter,
} from '../types';

export type SubmissionState =
  | 'COMPLETE'
  | 'DUE'
  | 'OVERDUE'
  | 'NOT_REQUIRED';

export interface MeterSubmissionStatus {
  meterId: string;
  state: SubmissionState;
  submittedRegisters: number;
  totalRegisters: number;
}

export interface ApartmentSubmissionStatus {
  state: SubmissionState;
  submittedMeters: number;
  totalMeters: number;
  meters: MeterSubmissionStatus[];
}

export function monthKey(
  value?: string,
) {
  if (!value) {
    return undefined;
  }

  const match =
    value.match(
      /^(\d{4})-(\d{2})/,
    );

  if (match) {
    return `${match[1]}-${match[2]}`;
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return undefined;
  }

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1,
  ).padStart(
    2,
    '0',
  )}`;
}

export function currentMonthKey(
  now =
    new Date(),
) {
  return `${now.getFullYear()}-${String(
    now.getMonth() + 1,
  ).padStart(
    2,
    '0',
  )}`;
}

function incompleteState(
  now =
    new Date(),
): SubmissionState {
  /*
   * The regular submission window is the 1st through
   * the 5th, inclusive. Starting on the 6th, an
   * incomplete reading is overdue.
   */
  return now.getDate() <=
    5
    ? 'DUE'
    : 'OVERDUE';
}

export function registerSubmittedThisMonth(
  register:
    Meter['registers'][number],

  now =
    new Date(),
) {
  /*
   * billing_period is the source of truth.
   *
   * tenantPortalRepository reads it from
   * v_latest_meter_register_readings and exposes it as
   * lastBillingPeriod.
   */
  return (
    monthKey(
      register.lastBillingPeriod,
    ) ===
    currentMonthKey(
      now,
    )
  );
}

export function getMeterSubmissionStatus(
  meter:
    Meter,

  now =
    new Date(),
): MeterSubmissionStatus {
  if (
    meter.billingMode !==
      'METERED' ||
    meter.registers.length ===
      0
  ) {
    return {
      meterId:
        meter.id,

      state:
        'NOT_REQUIRED',

      submittedRegisters:
        0,

      totalRegisters:
        0,
    };
  }

  const submittedRegisters =
    meter.registers.filter(
      register =>
        registerSubmittedThisMonth(
          register,
          now,
        ),
    ).length;

  const totalRegisters =
    meter.registers.length;

  return {
    meterId:
      meter.id,

    state:
      submittedRegisters ===
      totalRegisters
        ? 'COMPLETE'
        : incompleteState(
            now,
          ),

    submittedRegisters,

    totalRegisters,
  };
}

export function getApartmentSubmissionStatus(
  meters:
    Meter[],

  now =
    new Date(),
): ApartmentSubmissionStatus {
  const metered =
    meters.filter(
      meter =>
        meter.billingMode ===
          'METERED' &&
        meter.registers.length >
          0,
    );

  if (
    metered.length ===
    0
  ) {
    return {
      state:
        'NOT_REQUIRED',

      submittedMeters:
        0,

      totalMeters:
        0,

      meters:
        [],
    };
  }

  const meterStatuses =
    metered.map(
      meter =>
        getMeterSubmissionStatus(
          meter,
          now,
        ),
    );

  const submittedMeters =
    meterStatuses.filter(
      status =>
        status.state ===
        'COMPLETE',
    ).length;

  return {
    state:
      submittedMeters ===
      metered.length
        ? 'COMPLETE'
        : incompleteState(
            now,
          ),

    submittedMeters,

    totalMeters:
      metered.length,

    meters:
      meterStatuses,
  };
}