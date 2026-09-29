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

interface AddPropertyInput {
  name: string;
  address: string;
  city: string;

  areaM2: number;

  rentAmount: number;

  rentCurrency:
    CurrencyCode;
}

interface AddMeterInput {
  propertyId: string;

  name: string;

  category:
    Meter['category'];

  dualTariff:
    boolean;
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
  state: AppState;

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
      AddPropertyInput,
  ) => Property;

  addMeter: (
    input:
      AddMeterInput,
  ) => Meter;

  saveReading: (
    meterId: string,
    registerId: string,
    currentValue: number,
    photoUri?: string,
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

    const queryParams =
      new URLSearchParams(
        query,
      );

    queryParams.forEach(
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

    const fragmentParams =
      new URLSearchParams(
        fragment,
      );

    fragmentParams.forEach(
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

  console.log(
    '[Dometra Auth] Processing auth callback...',
  );

  const params =
    getAuthParams(url);

  const error =
    params.get('error');

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
      console.log(
        '[Dometra] Loading user state:',
        userId,
      );

      const stored =
        await AsyncStorage.getItem(
          stateStorageKey(
            userId,
          ),
        );

      if (!stored) {
        console.log(
          '[Dometra] No local user state. Starting empty.',
        );

        const cleanState =
          cloneInitialState();

        setState(
          cleanState,
        );

        await i18n.changeLanguage(
          cleanState
            .settings
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
          parsed
            .settings
            .language,
        );
      } catch (
        error
      ) {
        console.error(
          '[Dometra] Failed to load local state:',
          error,
        );

        const cleanState =
          cloneInitialState();

        setState(
          cleanState,
        );

        await i18n.changeLanguage(
          cleanState
            .settings
            .language,
        );
      }
    };

  const acceptSession =
    async (
      nextSession:
        Session,
    ) => {
      console.log(
        '[Dometra Auth] Accepting session for:',
        nextSession.user.email,
      );

      /*
       * signInWithPassword / setSession /
       * exchangeCodeForSession already
       * returned a real Supabase session.
       *
       * No additional getUser() call
       * is needed here.
       */

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
        nextSession
          .user.id,
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

      console.log(
        '[Dometra Auth] Restoring session...',
      );

      setAuthStatus(
        'loading',
      );

      setAuthError(
        null,
      );

      try {
        /*
         * getSession() loads the persisted
         * session and refreshes it when needed.
         */
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
          console.log(
            '[Dometra Auth] No stored session.',
          );

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

        console.log(
          '[Dometra Auth] Stored session restored:',
          data.session.user.email,
        );

        await acceptSession(
          data.session,
        );
      } catch (
        error
      ) {
        console.error(
          '[Dometra Auth] Session restore failed:',
          error,
        );

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

    /*
     * Listen for Supabase auth changes.
     *
     * IMPORTANT:
     * Keep this callback synchronous.
     */
    const authSubscription =
      supabase?.auth.onAuthStateChange(
        (
          event,
          nextSession,
        ) => {
          console.log(
            '[Dometra Auth] Event:',
            event,
          );

          if (!mounted) {
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

    /*
     * Deep links received while
     * Dometra is already running.
     */
    const linkSubscription =
      Linking.addEventListener(
        'url',
        ({
          url,
        }) => {
          console.log(
            '[Dometra Auth] Deep link received.',
          );

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
                  '[Dometra Auth] Authentication callback failed:',
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
          console.error(
            '[Dometra Auth] Supabase is not configured.',
          );

          setAuthStatus(
            'configuration-error',
          );

          setHydrated(
            true,
          );

          return;
        }

        try {
          /*
           * Check whether app was opened
           * from a confirmation link.
           */
          const initialUrl =
            await Linking.getInitialURL();

          if (
            initialUrl?.startsWith(
              AUTH_CALLBACK_URL,
            )
          ) {
            console.log(
              '[Dometra Auth] Initial auth URL detected.',
            );

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

          /*
           * Otherwise restore an existing
           * persisted Supabase session.
           */
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
          console.error(
            '[Dometra Auth] Initialization failed:',
            error,
          );

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

  /*
   * Save the current user's local
   * app state independently.
   */
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

      console.log(
        '[Dometra Auth] signInWithPassword:',
        email,
      );

      setAuthError(
        null,
      );

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

      console.log(
        '[Dometra Auth] signInWithPassword finished.',
      );

      if (error) {
        console.error(
          '[Dometra Auth] Login error:',
          error.message,
        );

        throw error;
      }

      if (
        !data.session
      ) {
        throw new Error(
          'Supabase did not create a session.',
        );
      }

      console.log(
        '[Dometra Auth] Login successful:',
        data.user?.email,
      );

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

      console.log(
        '[Dometra Auth] signUp:',
        email,
      );

      setAuthError(
        null,
      );

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
        console.error(
          '[Dometra Auth] Registration error:',
          error.message,
        );

        throw error;
      }

      /*
       * Dometra requires Confirm Email.
       *
       * Therefore registration should
       * return user but NO session.
       */
      if (
        data.session
      ) {
        await supabase.auth.signOut();

        throw new Error(
          'Email confirmation is disabled in Supabase. Enable Confirm Email in Authentication settings.',
        );
      }

      console.log(
        '[Dometra Auth] Registration successful. Waiting for email confirmation.',
      );

      return 'CONFIRM_EMAIL';
    };

  const logout =
    async () => {
      if (!supabase) {
        setSession(
          null,
        );

        setState(
          cloneInitialState(),
        );

        setAuthStatus(
          'configuration-error',
        );

        return;
      }

      console.log(
        '[Dometra Auth] Signing out...',
      );

      const {
        error,
      } =
        await supabase.auth.signOut();

      if (error) {
        throw error;
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

  const setMode = (
    mode: AppMode,
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

  const addProperty = (
    input:
      AddPropertyInput,
  ) => {
    const property:
      Property = {
      id:
        makeId(
          'prop',
        ),

      name:
        input.name,

      address:
        input.address,

      city:
        input.city,

      areaM2:
        input.areaM2,

      status:
        'ACTIVE',

      rentAmount:
        input.rentAmount,

      rentCurrency:
        input.rentCurrency,

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

  const addMeter = (
    input:
      AddMeterInput,
  ) => {
    const unit =
      input.category ===
        'WATER' ||
      input.category ===
        'GAS'
        ? 'm³'
        : 'kWh';

    const meter:
      Meter = {
      id:
        makeId(
          'meter',
        ),

      propertyId:
        input.propertyId,

      name:
        input.name,

      category:
        input.category,

      unit,

      registers:
        input.dualTariff
          ? [
              {
                id:
                  makeId(
                    'reg',
                  ),

                code:
                  'T1',

                name:
                  'Day',

                unit,

                tariff:
                  4.32,

                tariffCurrency:
                  'UAH',

                previousValue:
                  0,
              },

              {
                id:
                  makeId(
                    'reg',
                  ),

                code:
                  'T2',

                name:
                  'Night',

                unit,

                tariff:
                  2.16,

                tariffCurrency:
                  'UAH',

                previousValue:
                  0,
              },
            ]
          : [
              {
                id:
                  makeId(
                    'reg',
                  ),

                code:
                  'TOTAL',

                name:
                  'Total',

                unit,

                tariff:
                  input.category ===
                  'WATER'
                    ? 32.6
                    : 4.32,

                tariffCurrency:
                  'UAH',

                previousValue:
                  0,
              },
            ],
    };

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

  const saveReading = (
    meterId: string,
    registerId: string,
    currentValue: number,
    photoUri?: string,
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

  const addPayment = (
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

  const generateInvoice = (
    propertyId: string,
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
      Invoice['lines'] = [
      {
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
      },
    ];

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

  const setPushEnabled = (
    enabled: boolean,
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

        addMeter,

        saveReading,

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
      value={value}
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