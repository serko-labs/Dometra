import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  Session,
} from '@supabase/supabase-js';

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Linking,
} from 'react-native';

import {
  AUTH_CALLBACK_URL,
} from '../config/auth';

import {
  initialState,
} from '../data/initialState';

import i18n from '../i18n';

import {
  isSupabaseConfigured,
  supabase,
} from '../lib/supabase';

import {
  syncRemoteTranslations,
} from '../services/remoteTranslations';

import {
  AppMode,
  AppState,
  CurrencyCode,
  Invoice,
  LanguageCode,
  Meter,
  MeterBillingMode,
  Payment,
  PaymentMethod,
  Property,
} from '../types';

const STATE_KEY_PREFIX =
  'dometra.user.state.v1';

export type AuthStatus =
  | 'loading'
  | 'unauthenticated'
  | 'authenticated'
  | 'configuration-error'
  | 'connection-error';

export type RegisterResult =
  'CONFIRM_EMAIL';

interface PropertyInput {
  city: string;

  address: string;

  name?: string;

  areaM2?: number;
}

interface MeterInput {
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

interface AddPaymentInput {
  propertyId: string;

  amount: number;

  currency:
    CurrencyCode;

  method:
    PaymentMethod;

  note?: string;
}

interface AppContextValue {
  state:
    AppState;

  hydrated:
    boolean;

  session:
    Session | null;

  authStatus:
    AuthStatus;

  authError:
    string | null;

  login: (
    email: string,
    password: string,
  ) => Promise<void>;

  register: (
    email: string,
    password: string,
  ) => Promise<RegisterResult>;

  logout:
    () => Promise<void>;

  refreshAuth:
    () => Promise<void>;

  setMode:
    (mode: AppMode) => void;

  addProperty: (
    input:
      PropertyInput,
  ) => Property;

  editProperty: (
    propertyId: string,
    input:
      PropertyInput,
  ) => Property;

  removeProperty: (
    propertyId: string,
  ) => void;

  addMeter: (
    input:
      MeterInput,
  ) => Meter;

  editMeter: (
    meterId: string,
    input:
      MeterInput,
  ) => Meter;

  removeMeter: (
    meterId: string,
  ) => void;

  saveReading: (
    meterId: string,
    registerId: string,
    currentValue: number,
    photoUri?: string,
  ) => void;

  saveVariableAmount: (
    meterId: string,
    amount: number,
  ) => void;

  addPayment: (
    input:
      AddPaymentInput,
  ) => Payment;

  generateInvoice: (
    propertyId: string,
  ) => Invoice;

  changeLanguage: (
    language:
      LanguageCode,
  ) => Promise<void>;

  setPushEnabled: (
    enabled: boolean,
  ) => void;
}

const AppContext =
  createContext<
    AppContextValue | undefined
  >(undefined);

function cloneInitialState():
  AppState {
  return JSON.parse(
    JSON.stringify(
      initialState,
    ),
  ) as AppState;
}

function stateStorageKey(
  userId: string,
) {
  return `${STATE_KEY_PREFIX}.${userId}`;
}

function makeId(
  prefix: string,
) {
  return `${prefix}-${Date.now().toString(
    36,
  )}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

function getAuthParams(
  url: string,
) {
  const params =
    new URLSearchParams();

  const questionIndex =
    url.indexOf('?');

  const hashIndex =
    url.indexOf('#');

  if (
    questionIndex >= 0
  ) {
    const queryEnd =
      hashIndex >
      questionIndex
        ? hashIndex
        : url.length;

    const query =
      url.slice(
        questionIndex + 1,
        queryEnd,
      );

    new URLSearchParams(
      query,
    ).forEach(
      (
        value,
        key,
      ) => {
        params.set(
          key,
          value,
        );
      },
    );
  }

  if (
    hashIndex >= 0
  ) {
    const fragment =
      url.slice(
        hashIndex + 1,
      );

    new URLSearchParams(
      fragment,
    ).forEach(
      (
        value,
        key,
      ) => {
        params.set(
          key,
          value,
        );
      },
    );
  }

  return params;
}

async function createSessionFromAuthUrl(
  url: string,
) {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured.',
    );
  }

  if (
    !url.startsWith(
      AUTH_CALLBACK_URL,
    )
  ) {
    return null;
  }

  const params =
    getAuthParams(url);

  const error =
    params.get(
      'error',
    );

  const errorCode =
    params.get(
      'error_code',
    );

  const errorDescription =
    params.get(
      'error_description',
    );

  if (
    error ||
    errorCode ||
    errorDescription
  ) {
    throw new Error(
      errorDescription ??
        errorCode ??
        error ??
        'Authentication failed.',
    );
  }

  const accessToken =
    params.get(
      'access_token',
    );

  const refreshToken =
    params.get(
      'refresh_token',
    );

  if (
    accessToken &&
    refreshToken
  ) {
    const {
      data,
      error:
        sessionError,
    } =
      await supabase.auth.setSession(
        {
          access_token:
            accessToken,

          refresh_token:
            refreshToken,
        },
      );

    if (
      sessionError
    ) {
      throw sessionError;
    }

    return data.session;
  }

  const code =
    params.get(
      'code',
    );

  if (code) {
    const {
      data,
      error:
        exchangeError,
    } =
      await supabase.auth.exchangeCodeForSession(
        code,
      );

    if (
      exchangeError
    ) {
      throw exchangeError;
    }

    return data.session;
  }

  return null;
}

function buildMeter(
  input:
    MeterInput,

  existing?:
    Meter,
): Meter {
  const tariffCurrency =
    input.tariffCurrency ??
    existing?.registers[0]
      ?.tariffCurrency ??
    'UAH';

  const preserveRegister =
    (
      code:
        string,
    ) =>
      existing?.registers.find(
        (
          register,
        ) =>
          register.code ===
          code,
      );

  const createRegister =
    (
      code:
        string,

      name:
        string,

      unit:
        string,

      tariff:
        number,
    ): Meter['registers'][number] => {
      const previous =
        preserveRegister(
          code,
        );

      return {
        id:
          previous?.id ??
          makeId(
            'reg',
          ),

        code,

        name,

        unit,

        tariff,

        tariffCurrency,

        previousValue:
          previous?.previousValue ??
          0,

        currentValue:
          previous?.currentValue,

        photoUri:
          previous?.photoUri,
      };
    };

  let name =
    input.name?.trim() ??
    '';

  let unit = '';

  let billingMode =
    input.billingMode;

  let registers:
    Meter['registers'] =
    [];

  if (
    input.category ===
    'ELECTRICITY'
  ) {
    name =
      'Electricity';

    unit =
      'kWh';

    billingMode =
      'METERED';

    if (
      input.dualTariff
    ) {
      registers = [
        createRegister(
          'T1',
          'Day',
          'kWh',
          input.tariffT1 ??
            0,
        ),

        createRegister(
          'T2',
          'Night',
          'kWh',
          input.tariffT2 ??
            0,
        ),
      ];
    } else {
      registers = [
        createRegister(
          'TOTAL',
          'Total',
          'kWh',
          input.tariff ??
            0,
        ),
      ];
    }
  }

  if (
    input.category ===
    'WATER'
  ) {
    name =
      'Water';

    unit =
      'm³';

    billingMode =
      'METERED';

    registers = [
      createRegister(
        'TOTAL',
        'Total',
        'm³',
        input.tariff ??
          0,
      ),
    ];
  }

  if (
    input.category ===
    'GAS'
  ) {
    name =
      'Gas';

    unit =
      'm³';

    billingMode =
      'METERED';

    registers = [
      createRegister(
        'TOTAL',
        'Total',
        'm³',
        input.tariff ??
          0,
      ),
    ];
  }

  if (
    input.category ===
    'CUSTOM'
  ) {
    name =
      input.name?.trim() ||
      'Custom';

    unit = '';

    registers = [];
  }

  return {
    id:
      existing?.id ??
      makeId(
        'meter',
      ),

    propertyId:
      input.propertyId,

    name,

    category:
      input.category,

    billingMode,

    unit,

    registers,

    fixedAmount:
      billingMode ===
      'FIXED'
        ? input.fixedAmount
        : undefined,

    currentAmount:
      billingMode ===
      'VARIABLE'
        ? existing?.currentAmount
        : undefined,

    billingCurrency:
      input.billingCurrency ??
      tariffCurrency,
  };
}

export function AppProvider({
  children,
}: {
  children:
    React.ReactNode;
}) {
  const [
    state,
    setState,
  ] =
    useState<AppState>(
      cloneInitialState(),
    );

  const [
    session,
    setSession,
  ] =
    useState<
      Session | null
    >(null);

  const [
    hydrated,
    setHydrated,
  ] =
    useState(false);

  const [
    authStatus,
    setAuthStatus,
  ] =
    useState<AuthStatus>(
      isSupabaseConfigured
        ? 'loading'
        : 'configuration-error',
    );

  const [
    authError,
    setAuthError,
  ] =
    useState<
      string | null
    >(
      isSupabaseConfigured
        ? null
        : 'Supabase configuration is missing.',
    );

  const loadUserState =
    async (
      userId: string,
    ) => {
      const stored =
        await AsyncStorage.getItem(
          stateStorageKey(
            userId,
          ),
        );

      if (!stored) {
        const cleanState =
          cloneInitialState();

        setState(
          cleanState,
        );

        await i18n.changeLanguage(
          cleanState.settings
            .language,
        );

        return;
      }

      try {
        const parsed =
          JSON.parse(
            stored,
          ) as AppState;

        setState(
          parsed,
        );

        await i18n.changeLanguage(
          parsed.settings
            .language,
        );
      } catch {
        const cleanState =
          cloneInitialState();

        setState(
          cleanState,
        );

        await i18n.changeLanguage(
          cleanState.settings
            .language,
        );
      }
    };

  const acceptSession =
    async (
      nextSession:
        Session,
    ) => {
      setSession(
        nextSession,
      );

      setAuthStatus(
        'authenticated',
      );

      setAuthError(
        null,
      );

      await loadUserState(
        nextSession.user.id,
      );
    };

  const refreshAuth =
    async () => {
      if (!supabase) {
        setSession(
          null,
        );

        setAuthStatus(
          'configuration-error',
        );

        setAuthError(
          'Supabase configuration is missing.',
        );

        return;
      }

      setAuthStatus(
        'loading',
      );

      setAuthError(
        null,
      );

      try {
        const {
          data,
          error,
        } =
          await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (
          !data.session
        ) {
          setSession(
            null,
          );

          setState(
            cloneInitialState(),
          );

          setAuthStatus(
            'unauthenticated',
          );

          return;
        }

        await acceptSession(
          data.session,
        );
      } catch (
        error
      ) {
        setSession(
          null,
        );

        setAuthStatus(
          'connection-error',
        );

        setAuthError(
          error instanceof
          Error
            ? error.message
            : 'Unable to connect to Supabase.',
        );
      }
    };

  useEffect(() => {
    let mounted =
      true;

    const authSubscription =
      supabase?.auth.onAuthStateChange(
        (
          event,
          nextSession,
        ) => {
          if (
            !mounted
          ) {
            return;
          }

          if (
            event ===
            'SIGNED_OUT'
          ) {
            setSession(
              null,
            );

            setState(
              cloneInitialState(),
            );

            setAuthStatus(
              'unauthenticated',
            );

            setAuthError(
              null,
            );

            return;
          }

          if (
            nextSession
          ) {
            setSession(
              nextSession,
            );

            setAuthStatus(
              'authenticated',
            );

            setAuthError(
              null,
            );
          }
        },
      ).data.subscription;

    const linkSubscription =
      Linking.addEventListener(
        'url',
        ({
          url,
        }) => {
          void (
            async () => {
              try {
                const nextSession =
                  await createSessionFromAuthUrl(
                    url,
                  );

                if (
                  nextSession &&
                  mounted
                ) {
                  await acceptSession(
                    nextSession,
                  );
                }
              } catch (
                error
              ) {
                console.error(
                  'Authentication callback failed:',
                  error,
                );

                if (
                  mounted
                ) {
                  setSession(
                    null,
                  );

                  setAuthStatus(
                    'unauthenticated',
                  );

                  setAuthError(
                    error instanceof
                    Error
                      ? error.message
                      : 'Authentication callback failed.',
                  );
                }
              }
            }
          )();
        },
      );

    const initialize =
      async () => {
        if (!supabase) {
          setAuthStatus(
            'configuration-error',
          );

          setHydrated(
            true,
          );

          return;
        }

        try {
          const initialUrl =
            await Linking.getInitialURL();

          if (
            initialUrl?.startsWith(
              AUTH_CALLBACK_URL,
            )
          ) {
            const nextSession =
              await createSessionFromAuthUrl(
                initialUrl,
              );

            if (
              nextSession
            ) {
              await acceptSession(
                nextSession,
              );

              if (
                mounted
              ) {
                setHydrated(
                  true,
                );
              }

              return;
            }
          }

          if (
            mounted
          ) {
            await refreshAuth();

            setHydrated(
              true,
            );
          }
        } catch (
          error
        ) {
          if (
            mounted
          ) {
            setSession(
              null,
            );

            setAuthStatus(
              'connection-error',
            );

            setAuthError(
              error instanceof
              Error
                ? error.message
                : 'Initialization failed.',
            );

            setHydrated(
              true,
            );
          }
        }
      };

    void initialize();

    return () => {
      mounted =
        false;

      linkSubscription.remove();

      authSubscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (
      !hydrated ||
      !session
    ) {
      return;
    }

    void AsyncStorage.setItem(
      stateStorageKey(
        session.user.id,
      ),

      JSON.stringify(
        state,
      ),
    );
  }, [
    state,
    hydrated,
    session,
  ]);

  const login =
    async (
      email: string,
      password: string,
    ) => {
      if (!supabase) {
        throw new Error(
          'Supabase is not configured.',
        );
      }

      const {
        data,
        error,
      } =
        await supabase.auth.signInWithPassword(
          {
            email:
              email
                .trim()
                .toLowerCase(),

            password,
          },
        );

      if (error) {
        throw error;
      }

      if (
        !data.session
      ) {
        throw new Error(
          'Supabase did not create a session.',
        );
      }

      await acceptSession(
        data.session,
      );
    };

  const register =
    async (
      email: string,
      password: string,
    ): Promise<RegisterResult> => {
      if (!supabase) {
        throw new Error(
          'Supabase is not configured.',
        );
      }

      const {
        data,
        error,
      } =
        await supabase.auth.signUp(
          {
            email:
              email
                .trim()
                .toLowerCase(),

            password,

            options: {
              emailRedirectTo:
                AUTH_CALLBACK_URL,
            },
          },
        );

      if (error) {
        throw error;
      }

      if (
        data.session
      ) {
        await supabase.auth.signOut();

        throw new Error(
          'Email confirmation is disabled in Supabase.',
        );
      }

      return 'CONFIRM_EMAIL';
    };

  const logout =
    async () => {
      if (
        supabase
      ) {
        const {
          error,
        } =
          await supabase.auth.signOut();

        if (error) {
          throw error;
        }
      }

      setSession(
        null,
      );

      setState(
        cloneInitialState(),
      );

      setAuthStatus(
        'unauthenticated',
      );

      setAuthError(
        null,
      );
    };

  const setMode =
    (
      mode:
        AppMode,
    ) => {
      setState(
        (
          current,
        ) => ({
          ...current,

          settings: {
            ...current.settings,

            activeMode:
              mode,
          },
        }),
      );
    };

  const addProperty =
    (
      input:
        PropertyInput,
    ) => {
      const cleanAddress =
        input.address.trim();

      const property:
        Property = {
        id:
          makeId(
            'prop',
          ),

        name:
          input.name?.trim() ||
          cleanAddress,

        address:
          cleanAddress,

        city:
          input.city.trim(),

        areaM2:
          input.areaM2 ??
          0,

        status:
          'ACTIVE',

        rentAmount:
          0,

        rentCurrency:
          'UAH',

        utilitiesCurrency:
          'UAH',

        paymentDueDay:
          5,
      };

      setState(
        (
          current,
        ) => ({
          ...current,

          properties: [
            property,
            ...current.properties,
          ],
        }),
      );

      return property;
    };

  const editProperty =
    (
      propertyId:
        string,

      input:
        PropertyInput,
    ) => {
      const existing =
        state.properties.find(
          (
            property,
          ) =>
            property.id ===
            propertyId,
        );

      if (!existing) {
        throw new Error(
          'Property not found.',
        );
      }

      const updated:
        Property = {
        ...existing,

        name:
          input.name?.trim() ||
          input.address.trim(),

        city:
          input.city.trim(),

        address:
          input.address.trim(),

        areaM2:
          input.areaM2 ??
          0,
      };

      setState(
        (
          current,
        ) => ({
          ...current,

          properties:
            current.properties.map(
              (
                property,
              ) =>
                property.id ===
                propertyId
                  ? {
                      ...property,

                      name:
                        updated.name,

                      city:
                        updated.city,

                      address:
                        updated.address,

                      areaM2:
                        updated.areaM2,
                    }
                  : property,
            ),
        }),
      );

      return updated;
    };

  const removeProperty =
    (
      propertyId:
        string,
    ) => {
      setState(
        (
          current,
        ) => ({
          ...current,

          properties:
            current.properties.filter(
              (
                property,
              ) =>
                property.id !==
                propertyId,
            ),

          meters:
            current.meters.filter(
              (
                meter,
              ) =>
                meter.propertyId !==
                propertyId,
            ),

          invoices:
            current.invoices.filter(
              (
                invoice,
              ) =>
                invoice.propertyId !==
                propertyId,
            ),

          payments:
            current.payments.filter(
              (
                payment,
              ) =>
                payment.propertyId !==
                propertyId,
            ),

          reminders:
            current.reminders.filter(
              (
                reminder,
              ) =>
                reminder.propertyId !==
                propertyId,
            ),
        }),
      );
    };

  const addMeter =
    (
      input:
        MeterInput,
    ) => {
      const meter =
        buildMeter(
          input,
        );

      setState(
        (
          current,
        ) => ({
          ...current,

          meters: [
            meter,
            ...current.meters,
          ],
        }),
      );

      return meter;
    };

  const editMeter =
    (
      meterId:
        string,

      input:
        MeterInput,
    ) => {
      const existing =
        state.meters.find(
          (
            meter,
          ) =>
            meter.id ===
            meterId,
        );

      if (!existing) {
        throw new Error(
          'Meter not found.',
        );
      }

      const updated =
        buildMeter(
          input,
          existing,
        );

      setState(
        (
          current,
        ) => ({
          ...current,

          meters:
            current.meters.map(
              (
                meter,
              ) =>
                meter.id ===
                meterId
                  ? updated
                  : meter,
            ),
        }),
      );

      return updated;
    };

  const removeMeter =
    (
      meterId:
        string,
    ) => {
      setState(
        (
          current,
        ) => ({
          ...current,

          meters:
            current.meters.filter(
              (
                meter,
              ) =>
                meter.id !==
                meterId,
            ),
        }),
      );
    };

  const saveReading =
    (
      meterId:
        string,

      registerId:
        string,

      currentValue:
        number,

      photoUri?:
        string,
    ) => {
      setState(
        (
          current,
        ) => ({
          ...current,

          meters:
            current.meters.map(
              (
                meter,
              ) =>
                meter.id !==
                meterId
                  ? meter
                  : {
                      ...meter,

                      registers:
                        meter.registers.map(
                          (
                            register,
                          ) =>
                            register.id !==
                            registerId
                              ? register
                              : {
                                  ...register,

                                  currentValue,

                                  photoUri:
                                    photoUri ??
                                    register.photoUri,
                                },
                        ),
                    },
            ),
        }),
      );
    };

  const saveVariableAmount =
    (
      meterId:
        string,

      amount:
        number,
    ) => {
      setState(
        (
          current,
        ) => ({
          ...current,

          meters:
            current.meters.map(
              (
                meter,
              ) =>
                meter.id ===
                meterId
                  ? {
                      ...meter,

                      currentAmount:
                        amount,
                    }
                  : meter,
            ),
        }),
      );
    };

  const addPayment =
    (
      input:
        AddPaymentInput,
    ) => {
      const property =
        state.properties.find(
          (
            item,
          ) =>
            item.id ===
            input.propertyId,
        );

      const payment:
        Payment = {
        id:
          makeId(
            'pay',
          ),

        propertyId:
          input.propertyId,

        tenantName:
          property?.tenantName ??
          'Tenant',

        amount:
          input.amount,

        currency:
          input.currency,

        date:
          new Date()
            .toISOString()
            .slice(
              0,
              10,
            ),

        method:
          input.method,

        allocated:
          false,

        note:
          input.note,
      };

      setState(
        (
          current,
        ) => ({
          ...current,

          payments: [
            payment,
            ...current.payments,
          ],
        }),
      );

      return payment;
    };

  const generateInvoice =
    (
      propertyId:
        string,
    ) => {
      const property =
        state.properties.find(
          (
            item,
          ) =>
            item.id ===
            propertyId,
        );

      if (
        !property
      ) {
        throw new Error(
          'Property not found.',
        );
      }

      const lines:
        Invoice['lines'] =
        [];

      if (
        property.rentAmount >
        0
      ) {
        lines.push({
          id:
            makeId(
              'line',
            ),

          type:
            'RENT',

          label:
            'Rent',

          amount:
            property.rentAmount,

          currency:
            property.rentCurrency,
        });
      }

      state.meters
        .filter(
          (
            meter,
          ) =>
            meter.propertyId ===
            propertyId,
        )
        .forEach(
          (
            meter,
          ) => {
            if (
              meter.billingMode ===
                'FIXED' &&
              meter.fixedAmount !==
                undefined
            ) {
              lines.push({
                id:
                  makeId(
                    'line',
                  ),

                type:
                  'FIXED_CHARGE',

                label:
                  meter.name,

                amount:
                  meter.fixedAmount,

                currency:
                  meter.billingCurrency ??
                  'UAH',
              });

              return;
            }

            if (
              meter.billingMode ===
                'VARIABLE' &&
              meter.currentAmount !==
                undefined
            ) {
              lines.push({
                id:
                  makeId(
                    'line',
                  ),

                type:
                  'CUSTOM_CHARGE',

                label:
                  meter.name,

                amount:
                  meter.currentAmount,

                currency:
                  meter.billingCurrency ??
                  'UAH',
              });

              return;
            }

            if (
              meter.billingMode !==
              'METERED'
            ) {
              return;
            }

            meter.registers.forEach(
              (
                register,
              ) => {
                if (
                  register.currentValue ===
                  undefined
                ) {
                  return;
                }

                const consumption =
                  Math.max(
                    0,

                    register.currentValue -
                      register.previousValue,
                  );

                lines.push({
                  id:
                    makeId(
                      'line',
                    ),

                  type:
                    'UTILITY',

                  label:
                    `${meter.name} ${register.code}`,

                  amount:
                    Number(
                      (
                        consumption *
                        register.tariff
                      ).toFixed(
                        2,
                      ),
                    ),

                  currency:
                    register.tariffCurrency,

                  details:
                    `${consumption.toFixed(
                      2,
                    )} ${register.unit} × ${register.tariff.toFixed(
                      2,
                    )}`,
                });
              },
            );
          },
        );

      const now =
        new Date();

      const period =
        now
          .toISOString()
          .slice(
            0,
            7,
          );

      const due =
        new Date(
          now.getFullYear(),

          now.getMonth() +
            1,

          property.paymentDueDay,
        );

      const invoice:
        Invoice = {
        id:
          makeId(
            'inv',
          ),

        propertyId,

        tenantName:
          property.tenantName ??
          'Tenant',

        period,

        issueDate:
          now
            .toISOString()
            .slice(
              0,
              10,
            ),

        dueDate:
          due
            .toISOString()
            .slice(
              0,
              10,
            ),

        status:
          'ISSUED',

        lines,
      };

      setState(
        (
          current,
        ) => ({
          ...current,

          invoices: [
            invoice,

            ...current.invoices.filter(
              (
                item,
              ) =>
                !(
                  item.propertyId ===
                    propertyId &&
                  item.period ===
                    period
                ),
            ),
          ],
        }),
      );

      return invoice;
    };

  const changeLanguage =
    async (
      language:
        LanguageCode,
    ) => {
      await syncRemoteTranslations(
        language,
      );

      await i18n.changeLanguage(
        language,
      );

      setState(
        (
          current,
        ) => ({
          ...current,

          settings: {
            ...current.settings,

            language,
          },
        }),
      );
    };

  const setPushEnabled =
    (
      enabled:
        boolean,
    ) => {
      setState(
        (
          current,
        ) => ({
          ...current,

          settings: {
            ...current.settings,

            pushEnabled:
              enabled,
          },
        }),
      );
    };

  const value =
    useMemo<
      AppContextValue
    >(
      () => ({
        state,

        hydrated,

        session,

        authStatus,

        authError,

        login,

        register,

        logout,

        refreshAuth,

        setMode,

        addProperty,

        editProperty,

        removeProperty,

        addMeter,

        editMeter,

        removeMeter,

        saveReading,

        saveVariableAmount,

        addPayment,

        generateInvoice,

        changeLanguage,

        setPushEnabled,
      }),

      [
        state,
        hydrated,
        session,
        authStatus,
        authError,
      ],
    );

  return (
    <AppContext.Provider
      value={
        value
      }
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const value =
    useContext(
      AppContext,
    );

  if (!value) {
    throw new Error(
      'useApp must be used inside AppProvider.',
    );
  }

  return value;
}