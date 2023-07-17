import { Dispatch, createContext, useContext } from 'react';

export const APP_CONFIG_KEY = 'appConfig';

export enum ConfigActions {
  SET_CONFIG,
}

export interface SetConfigAction<T extends AppConfig = AppConfig> {
  type: ConfigActions;
  payload: Partial<T>;
}

export interface AppConfig {
  nodeHost?: string;
  login?: string;
}

export interface ConfigContextData<T extends AppConfig = AppConfig> {
  configError?: string;
  setConfig: Dispatch<SetConfigAction<T>>;
  setAuth(accessToken: string): void;
  resetAuth(): void;
  isAuth: boolean;
}

export const ConfigContext = createContext<any>({});

export const useConfig = <T extends AppConfig = AppConfig>() => {
  const context = useContext<T & ConfigContextData<T>>(ConfigContext);

  if (context === undefined) {
    throw new Error('useConfig must be used within a "ConfigContext"');
  }

  return context;
};
