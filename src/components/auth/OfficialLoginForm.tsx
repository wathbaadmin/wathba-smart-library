import React from 'react';
import { LandingAndAuthView } from './LandingAndAuthView';

interface OfficialLoginFormProps {
  initialTab?: 'student' | 'staff';
  onTabChange?: (tab: 'student' | 'staff') => void;
}

export const OfficialLoginForm: React.FC<OfficialLoginFormProps> = () => {
  return <LandingAndAuthView />;
};
