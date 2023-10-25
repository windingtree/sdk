import {
  PropsWithChildren,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useReducer,
} from 'react';
import { stringify, parse } from 'superjson';
import {
  APP_CONFIG_KEY,
  ConfigActions,
  SetConfigAction,
  AppConfig,
  ConfigContext,
} from './ConfigProviderContext.js';

const configReducer = (state: AppConfig, action: SetConfigAction) => {
  switch (action.type) {
    case ConfigActions.SET_CONFIG:
      return {
        ...state,
        ...action.payload,
      };
    default:
      return state;
  }
};

export const ConfigProvider = ({ children }: PropsWithChildren) => {
  const [state, setConfig] = useReducer(configReducer, {});
  const [error, setError] = useState<string | undefined>();

  const isAuth = useMemo(() => Boolean(state.login), [state]);

  const hydrate = useCallback((config: AppConfig) => {
    try {
      window.localStorage.setItem(APP_CONFIG_KEY, stringify(config));
    } catch (error) {
      setError((error as Error).message || 'Unknown config error');
    }
  }, []);

  const reHydrate = useCallback(() => {
    try {
      const data = window.localStorage.getItem(APP_CONFIG_KEY);

      if (data) {
        setConfig({
          type: ConfigActions.SET_CONFIG,
          payload: parse<AppConfig>(data),
        });
      }
    } catch (error) {
      setError((error as Error).message || 'Unknown config error');
    }
  }, []);

  const setAuth = useCallback((login: string) => {
    setConfig({
      type: ConfigActions.SET_CONFIG,
      payload: { login },
    });
  }, []);

  const resetAuth = useCallback(() => {
    setConfig({
      type: ConfigActions.SET_CONFIG,
      payload: { login: undefined },
    });
  }, []);

  useEffect(() => {
    reHydrate();
  }, [reHydrate]);

  useEffect(() => {
    hydrate(state);
  }, [hydrate, state]);

  return (
    <ConfigContext.Provider
      value={{
        ...state,
        isAuth,
        configError: error,
        setConfig,
        setAuth,
        resetAuth,
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
};
