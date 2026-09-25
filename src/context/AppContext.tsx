import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import i18n from '../i18n';
import { initialState } from '../data/mock';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { syncRemoteTranslations } from '../services/remoteTranslations';
import {
  AppMode,
  AppState,
  CurrencyCode,
  Invoice,
  LanguageCode,
  Meter,
  Payment,
  PaymentMethod,
  Property,
} from '../types';

const STORAGE_KEY = 'dometra.app.state.v1';

interface AddPropertyInput {
  name: string;
  address: string;
  city: string;
  areaM2: number;
  rentAmount: number;
  rentCurrency: CurrencyCode;
}

interface AddMeterInput {
  propertyId: string;
  name: string;
  category: Meter['category'];
  dualTariff: boolean;
}

interface AddPaymentInput {
  propertyId: string;
  amount: number;
  currency: CurrencyCode;
  method: PaymentMethod;
  note?: string;
}

interface AppContextValue {
  state: AppState;
  hydrated: boolean;
  supabaseConfigured: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  loginDemo: () => void;
  logout: () => Promise<void>;
  setMode: (mode: AppMode) => void;
  addProperty: (input: AddPropertyInput) => Property;
  addMeter: (input: AddMeterInput) => Meter;
  saveReading: (meterId: string, registerId: string, currentValue: number, photoUri?: string) => void;
  addPayment: (input: AddPaymentInput) => Payment;
  generateInvoice: (propertyId: string) => Invoice;
  changeLanguage: (language: LanguageCode) => Promise<void>;
  setPushEnabled: (enabled: boolean) => void;
  resetDemo: () => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

function cloneInitialState(): AppState {
  return JSON.parse(JSON.stringify(initialState)) as AppState;
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(cloneInitialState());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void (async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as AppState;
          setState(parsed);
          await i18n.changeLanguage(parsed.settings.language);
        } catch {
          // Ignore corrupt local demo state.
        }
      }

      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setState((current) => ({ ...current, isAuthenticated: true, userEmail: data.session.user.email ?? current.userEmail }));
        }
      }
      setHydrated(true);
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const login = async (email: string, password: string) => {
    if (supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
    setState((current) => ({ ...current, isAuthenticated: true, userEmail: email || current.userEmail }));
  };

  const register = async (email: string, password: string) => {
    if (supabase) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
    }
    setState((current) => ({ ...current, isAuthenticated: true, userEmail: email || current.userEmail }));
  };

  const loginDemo = () => setState((current) => ({ ...current, isAuthenticated: true, userEmail: 'demo@dometra.app' }));

  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
    setState((current) => ({ ...current, isAuthenticated: false }));
  };

  const setMode = (mode: AppMode) => {
    setState((current) => ({ ...current, settings: { ...current.settings, activeMode: mode } }));
  };

  const addProperty = (input: AddPropertyInput) => {
    const property: Property = {
      id: makeId('prop'),
      name: input.name,
      address: input.address,
      city: input.city,
      areaM2: input.areaM2,
      status: 'ACTIVE',
      rentAmount: input.rentAmount,
      rentCurrency: input.rentCurrency,
      utilitiesCurrency: 'UAH',
      paymentDueDay: 5,
    };
    setState((current) => ({ ...current, properties: [property, ...current.properties] }));
    return property;
  };

  const addMeter = (input: AddMeterInput) => {
    const meterId = makeId('meter');
    const unit = input.category === 'WATER' || input.category === 'GAS' ? 'm³' : 'kWh';
    const meter: Meter = {
      id: meterId,
      propertyId: input.propertyId,
      name: input.name,
      category: input.category,
      unit,
      registers: input.dualTariff
        ? [
            { id: makeId('reg'), code: 'T1', name: 'Day', unit, tariff: 4.32, tariffCurrency: 'UAH', previousValue: 0 },
            { id: makeId('reg'), code: 'T2', name: 'Night', unit, tariff: 2.16, tariffCurrency: 'UAH', previousValue: 0 },
          ]
        : [{ id: makeId('reg'), code: 'TOTAL', name: 'Total', unit, tariff: input.category === 'WATER' ? 32.6 : 4.32, tariffCurrency: 'UAH', previousValue: 0 }],
    };
    setState((current) => ({ ...current, meters: [meter, ...current.meters] }));
    return meter;
  };

  const saveReading = (meterId: string, registerId: string, currentValue: number, photoUri?: string) => {
    setState((current) => ({
      ...current,
      meters: current.meters.map((meter) =>
        meter.id !== meterId
          ? meter
          : {
              ...meter,
              registers: meter.registers.map((register) =>
                register.id !== registerId ? register : { ...register, currentValue, photoUri: photoUri ?? register.photoUri },
              ),
            },
      ),
    }));
  };

  const addPayment = (input: AddPaymentInput) => {
    const property = state.properties.find((item) => item.id === input.propertyId);
    const payment: Payment = {
      id: makeId('pay'),
      propertyId: input.propertyId,
      tenantName: property?.tenantName ?? 'Tenant',
      amount: input.amount,
      currency: input.currency,
      date: new Date().toISOString().slice(0, 10),
      method: input.method,
      allocated: false,
      note: input.note,
    };
    setState((current) => ({ ...current, payments: [payment, ...current.payments] }));
    return payment;
  };

  const generateInvoice = (propertyId: string) => {
    const property = state.properties.find((item) => item.id === propertyId);
    if (!property) throw new Error('Property not found');

    const lines: Invoice['lines'] = [
      { id: makeId('line'), type: 'RENT', label: 'Rent', amount: property.rentAmount, currency: property.rentCurrency },
      { id: makeId('line'), type: 'FIXED_CHARGE', label: 'Internet', amount: 350, currency: 'UAH' },
    ];

    state.meters
      .filter((meter) => meter.propertyId === propertyId)
      .forEach((meter) => {
        meter.registers.forEach((register) => {
          if (register.currentValue === undefined) return;
          const consumption = Math.max(0, register.currentValue - register.previousValue);
          lines.push({
            id: makeId('line'),
            type: 'UTILITY',
            label: `${meter.name} ${register.code}`,
            amount: Number((consumption * register.tariff).toFixed(2)),
            currency: register.tariffCurrency,
            details: `${consumption.toFixed(2)} ${register.unit} × ${register.tariff.toFixed(2)}`,
          });
        });
      });

    const now = new Date();
    const period = now.toISOString().slice(0, 7);
    const due = new Date(now.getFullYear(), now.getMonth() + 1, property.paymentDueDay);
    const invoice: Invoice = {
      id: makeId('inv'),
      propertyId,
      tenantName: property.tenantName ?? 'Tenant',
      period,
      issueDate: now.toISOString().slice(0, 10),
      dueDate: due.toISOString().slice(0, 10),
      status: 'ISSUED',
      lines,
    };
    setState((current) => ({ ...current, invoices: [invoice, ...current.invoices.filter((item) => !(item.propertyId === propertyId && item.period === period))] }));
    return invoice;
  };

  const changeLanguage = async (language: LanguageCode) => {
    await syncRemoteTranslations(language);
    await i18n.changeLanguage(language);
    setState((current) => ({ ...current, settings: { ...current.settings, language } }));
  };

  const setPushEnabled = (enabled: boolean) => {
    setState((current) => ({ ...current, settings: { ...current.settings, pushEnabled: enabled } }));
  };

  const resetDemo = () => {
    const next = cloneInitialState();
    next.isAuthenticated = true;
    setState(next);
    void i18n.changeLanguage(next.settings.language);
  };

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      hydrated,
      supabaseConfigured: isSupabaseConfigured,
      login,
      register,
      loginDemo,
      logout,
      setMode,
      addProperty,
      addMeter,
      saveReading,
      addPayment,
      generateInvoice,
      changeLanguage,
      setPushEnabled,
      resetDemo,
    }),
    [state, hydrated],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}
