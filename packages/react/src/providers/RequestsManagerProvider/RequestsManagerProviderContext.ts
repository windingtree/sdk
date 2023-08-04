import { createContext, useContext } from 'react';
import { ClientRequestsManager } from '@windingtree/sdk-client';

export interface RequestsManagerProviderContextData {
  requestManager?: ClientRequestsManager;
}

export const RequestsManagerContext =
  createContext<RequestsManagerProviderContextData>(
    {} as RequestsManagerProviderContextData,
  );

export const useRequestsManager = () => {
  const context = useContext(RequestsManagerContext);

  if (context === undefined) {
    throw new Error(
      'useRequestsManager must be used within a "RequestsManagerContext"',
    );
  }

  return context;
};
