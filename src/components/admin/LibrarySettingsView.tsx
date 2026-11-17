import React from 'react';
import { UnifiedSettingsCenter, SettingsNavTab } from './settings/UnifiedSettingsCenter';

export interface LibrarySettingsViewProps {
  initialTab?: string;
}

export const LibrarySettingsView: React.FC<LibrarySettingsViewProps> = ({
  initialTab = 'overview',
}) => {
  return <UnifiedSettingsCenter initialTab={initialTab} />;
};

export { UnifiedSettingsCenter };
