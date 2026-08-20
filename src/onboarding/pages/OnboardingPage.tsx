import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSettingStore } from '@/core-app/store/settingsStore';
import OnboardingLayout from '../components/OnboardingLayout';
import TourPickerModal from '../components/TourPickerModal';
import { FEATURE_ORDER, OnboardingFeature } from '../types/onboardingTypes';

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { updateOnboardingShown } = useSettingStore();
  const [selectedFeature, setSelectedFeature] = useState<OnboardingFeature | null>(null);

  // Re-entering the tour (e.g. Help → "Take a Tour") while already on this route
  // re-renders this component instead of remounting it, so the picker has to be
  // re-armed explicitly. location.key changes on every navigation, same-path included.
  useEffect(() => {
    setSelectedFeature(null);
  }, [location.key]);

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
