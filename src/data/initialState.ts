import {
  AppState,
} from '../types';

export const initialState:
  AppState = {
  workspace:
    null,

  settings: {
    language:
      'uk',

    region:
      'UA',

    timezone:
      'Europe/Kyiv',

    displayCurrency:
      'UAH',

    activeMode:
      'LANDLORD',

    pushEnabled:
      true,
  },

  properties:
    [],

  meters:
    [],

  reminders:
    [],
};