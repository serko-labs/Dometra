import React from 'react';

import {
  MeterSubmissionStatus,
} from '../services/meterSubmissionStatus';

import {
  SubmissionStatusBadge,
} from './SubmissionStatusBadge';

type Props = {
  status?:
    MeterSubmissionStatus;
};

export function MeterSubmissionBadge({
  status,
}: Props) {
  if (
    !status
  ) {
    return (
      <SubmissionStatusBadge
        state="NOT_REQUIRED"
        text="Not available"
      />
    );
  }

  const text =
    status.state ===
    'COMPLETE'
      ? status.totalRegisters >
        1
        ? `${status.submittedRegisters}/${status.totalRegisters} submitted`
        : 'Submitted'
      : status.state ===
          'DUE'
        ? 'Due'
        : status.state ===
            'OVERDUE'
          ? 'Overdue'
          : 'Not required';

  return (
    <SubmissionStatusBadge
      state={
        status.state
      }
      text={
        text
      }
    />
  );
}