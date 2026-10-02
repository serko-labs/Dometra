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
  getDeviceLanguage,
  normalizeLanguageCode,
} from '../i18n/language';

import {
  isSupabaseConfigured,
  supabase,
} from '../lib/supabase';

import {
  archiveProperty,
  archivePropertyService,
  createProperty,
  loadCoreData,
  saveMeterReadings as saveMeterReadingsToSupabase,
  savePropertyService,
  saveVariableServiceValue,
  updateProperty,
  updateUserSettings,
} from '../services/supabaseRepository';

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
  MeterInput,
  MeterReadingInput,
  Payment,
  PaymentMethod,
  Property,
  PropertyInput,
} from '../types';

export type AuthStatus =
  | 'loading'
  | 'unauthenticated'
  | 'authenticated'
  | 'configuration-error'
  | 'connection-error';

export type RegisterResult =
  'CONFIRM_EMAIL';

interface AddPaymentInput {
  propertyId:
    string;

  amount:
    number;

  currency:
    CurrencyCode;

  method:
    PaymentMethod;

  note?:
    string;
}

interface AppContextValue {
  state:
    AppState;

  hydrated:
    boolean;

  dataLoading:
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

  refreshData:
    () => Promise<void>;

  setMode: (
    mode:
      AppMode,
  ) => Promise<void>;

  addProperty: (
    input:
      PropertyInput,
  ) => Promise<Property>;

  editProperty: (
    propertyId:
      string,

    input:
      PropertyInput,
  ) => Promise<Property>;

  removeProperty: (
    propertyId:
      string,
  ) => Promise<void>;

  addMeter: (
    input:
      MeterInput,
  ) => Promise<Meter>;

  editMeter: (
    meterId:
      string,

    input:
      MeterInput,
  ) => Promise<Meter>;

  removeMeter: (
    meterId:
      string,
  ) => Promise<void>;

  saveReading: (
    meterId:
      string,

    registerId:
      string,

    currentValue:
      number,

    photoUri?:
      string,
  ) => Promise<void>;

  saveMeterReadings: (
    meterId:
      string,

    readings:
      MeterReadingInput[],
  ) => Promise<void>;

  saveVariableAmount: (
    meterId:
      string,

    amount:
      number,
  ) => Promise<void>;

  addPayment: (
    input:
      AddPaymentInput,
  ) => Payment;

  generateInvoice: (
    propertyId:
      string,
  ) => Invoice;

  changeLanguage: (
    language:
      LanguageCode,
  ) => Promise<void>;

  setPushEnabled: (
    enabled:
      boolean,
  ) => Promise<void>;
}

const AppContext =
  createContext<
    AppContextValue | undefined
  >(
    undefined,
  );

function cloneInitialState():
AppState {
  return JSON.parse(
    JSON.stringify(
      initialState,
    ),
  ) as AppState;
}

function getAuthParams(
  url:
    string,
) {
  const params =
    new URLSearchParams();

  const questionIndex =
    url.indexOf(
      '?',
    );

  const hashIndex =
    url.indexOf(
      '#',
    );

  if (
    questionIndex >=
    0
  ) {
    const queryEnd =
      hashIndex >
      questionIndex
        ? hashIndex
        : url.length;

    const query =
      url.slice(
        questionIndex +
          1,

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
    hashIndex >=
    0
  ) {
    const fragment =
      url.slice(
        hashIndex +
          1,
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
  url:
    string,
) {
  if (
    !supabase
  ) {
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
    getAuthParams(
      url,
    );

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
      await supabase.auth
        .setSession({
          access_token:
            accessToken,

          refresh_token:
            refreshToken,
        });

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

  if (
    code
  ) {
    const {
      data,
      error:
        exchangeError,
    } =
      await supabase.auth
        .exchangeCodeForSession(
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

async function resolveLanguageForUser(
  userId:
    string,
): Promise<LanguageCode> {
  const detectedLanguage =
    getDeviceLanguage();

  if (
    !supabase
  ) {
    return detectedLanguage;
  }

  const {
    data,
    error,
  } =
    await supabase
      .from(
        'user_settings',
      )
      .select(
        'language_code,language_initialized',
      )
      .eq(
        'user_id',
        userId,
      )
      .maybeSingle();

  if (
    error
  ) {
    throw error;
  }

  if (
    data?.language_initialized
  ) {
    return normalizeLanguageCode(
      data.language_code,
    );
  }

  if (
    data
  ) {
    const {
      error:
        updateError,
    } =
      await supabase
        .from(
          'user_settings',
        )
        .update({
          language_code:
            detectedLanguage,

          language_initialized:
            true,
        })
        .eq(
          'user_id',
          userId,
        );

    if (
      updateError
    ) {
      throw updateError;
    }

    return detectedLanguage;
  }

  const {
    error:
      insertError,
  } =
    await supabase
      .from(
        'user_settings',
      )
      .insert({
        user_id:
          userId,

        language_code:
          detectedLanguage,

        language_initialized:
          true,
      });

  if (
    insertError
  ) {
    throw insertError;
  }

  return detectedLanguage;
}

async function markLanguageInitialized(
  userId:
    string,
) {
  if (
    !supabase
  ) {
    return;
  }

  const {
    error,
  } =
    await supabase
      .from(
        'user_settings',
      )
      .update({
        language_initialized:
          true,
      })
      .eq(
        'user_id',
        userId,
      );

  if (
    error
  ) {
    throw error;
  }
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
    >(
      null,
    );

  const [
    hydrated,
    setHydrated,
  ] =
    useState(
      false,
    );

  const [
    dataLoading,
    setDataLoading,
  ] =
    useState(
      false,
    );

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

  const loadDataForUser =
    async (
      userId:
        string,
    ) => {
      setDataLoading(
        true,
      );

      try {
        const core =
          await loadCoreData(
            userId,
          );

        const language =
          await resolveLanguageForUser(
            userId,
          );

        setState({
          workspace:
            core.workspace,

          settings: {
            ...core.settings,

            language,
          },

          properties:
            core.properties,

          meters:
            core.meters,

          invoices:
            [],

          payments:
            [],

          reminders:
            [],
        });

        try {
          await syncRemoteTranslations(
            language,
          );
        } catch (
          error
        ) {
          console.warn(
            '[Dometra] Remote translations sync failed:',
            error,
          );
        }

        await i18n.changeLanguage(
          language,
        );
      } finally {
        setDataLoading(
          false,
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

      setAuthError(
        null,
      );

      await loadDataForUser(
        nextSession.user.id,
      );

      setAuthStatus(
        'authenticated',
      );
    };

  const refreshData =
    async () => {
      if (
        !session
      ) {
        return;
      }

      await loadDataForUser(
        session.user.id,
      );
    };

  const refreshAuth =
    async () => {
      if (
        !supabase
      ) {
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
          await supabase.auth
            .getSession();

        if (
          error
        ) {
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
        console.error(
          '[Dometra] Session restore failed:',
          error,
        );

        setSession(
          null,
        );

        setState(
          cloneInitialState(),
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

  useEffect(
    () => {
      let mounted =
        true;

      const authSubscription =
        supabase?.auth
          .onAuthStateChange(
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
                event ===
                  'TOKEN_REFRESHED' &&
                nextSession
              ) {
                setSession(
                  nextSession,
                );
              }
            },
          )
          .data
          .subscription;

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
                    '[Dometra] Authentication callback failed:',
                    error,
                  );

                  if (
                    mounted
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
          if (
            !supabase
          ) {
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
            console.error(
              '[Dometra] Initialization failed:',
              error,
            );

            if (
              mounted
            ) {
              setSession(
                null,
              );

              setState(
                cloneInitialState(),
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

        authSubscription
          ?.unsubscribe();
      };
    },
    [],
  );

  const requireUser =
    () => {
      if (
        !session
      ) {
        throw new Error(
          'Authentication is required.',
        );
      }

      return session.user;
    };

  const requireWorkspace =
    () => {
      if (
        !state.workspace
      ) {
        throw new Error(
          'Workspace is not loaded.',
        );
      }

      return state.workspace;
    };

  const setMode =
    async (
      mode:
        AppMode,
    ) => {
      const user =
        requireUser();

      await updateUserSettings(
        user.id,
        {
          activeMode:
            mode,
        },
      );

      setState(
        current => ({
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
    async (
      input:
        PropertyInput,
    ) => {
      const user =
        requireUser();

      const workspace =
        requireWorkspace();

      const property =
        await createProperty(
          workspace.id,
          user.id,
          input,
        );

      setState(
        current => ({
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
    async (
      propertyId:
        string,

      input:
        PropertyInput,
    ) => {
      const property =
        await updateProperty(
          propertyId,
          input,
        );

      setState(
        current => ({
          ...current,

          properties:
            current.properties.map(
              item =>
                item.id ===
                propertyId
                  ? property
                  : item,
            ),
        }),
      );

      return property;
    };

  const removeProperty =
    async (
      propertyId:
        string,
    ) => {
      await archiveProperty(
        propertyId,
      );

      await refreshData();
    };

  const addMeter =
    async (
      input:
        MeterInput,
    ) => {
      const serviceId =
        await savePropertyService(
          input,
        );

      await refreshData();

      const created =
        state.meters.find(
          meter =>
            meter.serviceId ===
            serviceId,
        );

      const user =
        requireUser();

      const core =
        await loadCoreData(
          user.id,
        );

      setState(
        current => ({
          ...current,

          workspace:
            core.workspace,

          settings:
            core.settings,

          properties:
            core.properties,

          meters:
            core.meters,
        }),
      );

      const result =
        core.meters.find(
          meter =>
            meter.serviceId ===
            serviceId,
        );

      if (
        !result
      ) {
        if (
          created
        ) {
          return created;
        }

        throw new Error(
          'Created meter/service could not be loaded.',
        );
      }

      return result;
    };

  const editMeter =
    async (
      meterId:
        string,

      input:
        MeterInput,
    ) => {
      const existing =
        state.meters.find(
          meter =>
            meter.id ===
            meterId,
        );

      if (
        !existing
      ) {
        throw new Error(
          'Meter/service not found.',
        );
      }

      const serviceId =
        await savePropertyService(
          input,
          existing.serviceId,
        );

      const user =
        requireUser();

      const core =
        await loadCoreData(
          user.id,
        );

      setState(
        current => ({
          ...current,

          workspace:
            core.workspace,

          settings:
            core.settings,

          properties:
            core.properties,

          meters:
            core.meters,
        }),
      );

      const result =
        core.meters.find(
          meter =>
            meter.serviceId ===
            serviceId,
        );

      if (
        !result
      ) {
        throw new Error(
          'Updated meter/service could not be loaded.',
        );
      }

      return result;
    };

  const removeMeter =
    async (
      meterId:
        string,
    ) => {
      const meter =
        state.meters.find(
          item =>
            item.id ===
            meterId,
        );

      if (
        !meter
      ) {
        throw new Error(
          'Meter/service not found.',
        );
      }

      await archivePropertyService(
        meter.serviceId,
      );

      await refreshData();
    };

  const saveMeterReadings =
    async (
      meterId:
        string,

      readings:
        MeterReadingInput[],
    ) => {
      const workspace =
        requireWorkspace();

      const meter =
        state.meters.find(
          item =>
            item.id ===
            meterId,
        );

      if (
        !meter
      ) {
        throw new Error(
          'Meter not found.',
        );
      }

      if (
        meter.billingMode !==
        'METERED'
      ) {
        throw new Error(
          'This service does not use meter readings.',
        );
      }

      await saveMeterReadingsToSupabase(
        workspace.id,
        meter,
        readings,
      );

      await refreshData();
    };

  const saveReading =
    async (
      meterId:
        string,

      registerId:
        string,

      currentValue:
        number,

      photoUri?:
        string,
    ) => {
      await saveMeterReadings(
        meterId,
        [
          {
            registerId,
            currentValue,
            photoUri,
          },
        ],
      );
    };

  const saveVariableAmount =
    async (
      meterId:
        string,

      amount:
        number,
    ) => {
      const meter =
        state.meters.find(
          item =>
            item.id ===
            meterId,
        );

      if (
        !meter
      ) {
        throw new Error(
          'Service not found.',
        );
      }

      if (
        meter.billingMode !==
        'VARIABLE'
      ) {
        throw new Error(
          'This is not a variable service.',
        );
      }

      await saveVariableServiceValue(
        meter.serviceId,
        amount,
      );

      await refreshData();
    };

  const changeLanguage =
    async (
      language:
        LanguageCode,
    ) => {
      const user =
        requireUser();

      await updateUserSettings(
        user.id,
        {
          language,
        },
      );

      await markLanguageInitialized(
        user.id,
      );

      try {
        await syncRemoteTranslations(
          language,
        );
      } catch (
        error
      ) {
        console.warn(
          '[Dometra] Remote translations sync failed:',
          error,
        );
      }

      await i18n.changeLanguage(
        language,
      );

      setState(
        current => ({
          ...current,

          settings: {
            ...current.settings,

            language,
          },
        }),
      );
    };

  const setPushEnabled =
    async (
      enabled:
        boolean,
    ) => {
      const user =
        requireUser();

      await updateUserSettings(
        user.id,
        {
          pushEnabled:
            enabled,
        },
      );

      setState(
        current => ({
          ...current,

          settings: {
            ...current.settings,

            pushEnabled:
              enabled,
          },
        }),
      );
    };

  const addPayment =
    (
      _input:
        AddPaymentInput,
    ): Payment => {
      throw new Error(
        'Payments are not connected to Supabase yet.',
      );
    };

  const generateInvoice =
    (
      _propertyId:
        string,
    ): Invoice => {
      throw new Error(
        'Invoices are not connected to Supabase yet.',
      );
    };

  const login =
    async (
      email:
        string,

      password:
        string,
    ) => {
      if (
        !supabase
      ) {
        throw new Error(
          'Supabase is not configured.',
        );
      }

      const {
        data,
        error,
      } =
        await supabase.auth
          .signInWithPassword({
            email:
              email
                .trim()
                .toLowerCase(),

            password,
          });

      if (
        error
      ) {
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
      email:
        string,

      password:
        string,
    ): Promise<RegisterResult> => {
      if (
        !supabase
      ) {
        throw new Error(
          'Supabase is not configured.',
        );
      }

      const {
        data,
        error,
      } =
        await supabase.auth
          .signUp({
            email:
              email
                .trim()
                .toLowerCase(),

            password,

            options: {
              emailRedirectTo:
                AUTH_CALLBACK_URL,
            },
          });

      if (
        error
      ) {
        throw error;
      }

      if (
        data.session
      ) {
        await supabase.auth
          .signOut();

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
          await supabase.auth
            .signOut();

        if (
          error
        ) {
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

  const value =
    useMemo<
      AppContextValue
    >(
      () => ({
        state,
        hydrated,
        dataLoading,
        session,
        authStatus,
        authError,
        login,
        register,
        logout,
        refreshAuth,
        refreshData,
        setMode,
        addProperty,
        editProperty,
        removeProperty,
        addMeter,
        editMeter,
        removeMeter,
        saveReading,
        saveMeterReadings,
        saveVariableAmount,
        addPayment,
        generateInvoice,
        changeLanguage,
        setPushEnabled,
      }),
      [
        state,
        hydrated,
        dataLoading,
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

  if (
    !value
  ) {
    throw new Error(
      'useApp must be used inside AppProvider.',
    );
  }

  return value;
}