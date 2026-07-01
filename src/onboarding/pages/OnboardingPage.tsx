import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettingStore } from '@/core-app/store/settingsStore';
import OnboardingLayout from '../components/OnboardingLayout';
import TourPickerModal from '../components/TourPickerModal';
import { FEATURE_ORDER, OnboardingFeature } from '../types/onboardingTypes';

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { updateOnboardingShown } = useSettingStore();
  const [selectedFeature, setSelectedFeature] = useState<OnboardingFeature | null>(null);

  const handleExit = () => {
    updateOnboardingShown(true);
    navigate('/status/all');
  };

  return (
    <>
      <OnboardingLayout
        key={selectedFeature ?? 'picker'}
        initialFeature={selectedFeature ?? FEATURE_ORDER[0]}
        tourEnabled={selectedFeature !== null}
        onExit={handleExit}
      />
      {selectedFeature === null && (
        <TourPickerModal onSelect={setSelectedFeature} onSkip={handleExit} />
      )}
    </>
  );
};

export default OnboardingPage;
