import { AppState } from '../types';

export const initialState: AppState = {
  settings: {
    language: 'uk',
    region: 'UA',
    timezone: 'Europe/Kyiv',
    displayCurrency: 'UAH',
    activeMode: 'LANDLORD',
    pushEnabled: true,
  },

  properties: [],

  meters: [],

  invoices: [],

  payments: [],

  reminders: [],
};