import {
  PropsWithChildren,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { stringify, parse } from 'superjson';
import {
  APP_CONFIG_KEY,
  AppConfig,
  ConfigContext,
} from './ConfigProviderContext';

export const ConfigProvider = ({ children }: PropsWithChildren) => {
  const [config, setConfig] = useState<AppConfig>({});
  const [error, setError] = useState<string | undefined>();

  const isAuth = useMemo(() => Boolean(config.login), [config]);

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
        setConfig(parse<AppConfig>(data));
      }
    } catch (error) {
      setError((error as Error).message || 'Unknown config error');
    }
  }, []);

  useEffect(() => {
    reHydrate();
  }, [reHydrate]);

  useEffect(() => {
    hydrate(config);
  }, [hydrate, config]);

  return (
    <ConfigContext.Provider
      value={{
        ...config,
        setConfig: (data: Partial<AppConfig>) =>
          setConfig({
            ...config,
            ...data,
          }),
        setAuth: (login: string) =>
          setConfig({
            ...config,
            login,
          }),
        resetAuth: () =>
          setConfig({
            ...config,
            login: undefined,
          }),
        isAuth,
        configError: error,
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
};
