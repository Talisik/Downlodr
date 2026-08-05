import StoreRehydrationLoader from '@/core-app/components/loader/StoreRehydrationLoader';
import FormatSelectorManager from '@/downlodr/components/download/formatSelector/FormatSelectorManager';
import React from 'react';
import { PluginLoader } from '../PluginLoader';
import PluginModalManager from './PluginModalManager';

export const PluginInitialize: React.FC = () => {
  return (
    <StoreRehydrationLoader>
      <PluginLoader />
      <FormatSelectorManager />
      <PluginModalManager />
    </StoreRehydrationLoader>
  );
};
