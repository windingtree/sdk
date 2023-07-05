import { createContext, useContext } from 'react';

export const APP_CONFIG_KEY = 'appConfig';

export interface AppConfig {
  nodeHost?: string;
  login?: string;
}

export interface ConfigContextData extends AppConfig {
  configError?: string;
  setConfig(config: AppConfig): void;
  setAuth(accessToken: string): void;
  resetAuth(): void;
  isAuth: boolean;
}

export const ConfigContext = createContext<ConfigContextData>(
  {} as ConfigContextData,
);

export const useConfig = () => {
  const context = useContext(ConfigContext);

  if (context === undefined) {
    throw new Error('useConfig must be used within a "ConfigContext"');
  }

  return context;
};
