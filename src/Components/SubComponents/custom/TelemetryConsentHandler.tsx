/**
 * TelemetryConsentHandler component for managing telemetry consent modal display
 * This component handles when to show the telemetry consent modal based on user settings
 */

import React, { useEffect } from 'react';
import { useMainStore } from '@/Store/mainStore';
import TelemetryConsentModal from '@/Components/Main/Modal/TelemetryConsentModal';

const TelemetryConsentHandler: React.FC = () => {
  const { 
    settings, 
    isTelemetryConsentModalOpen, 
    setIsTelemetryConsentModalOpen 
  } = useMainStore();

  // Check if we should show the telemetry consent modal
  useEffect(() => {
    // Only show modal if consent hasn't been shown yet
    if (!settings.telemetryConsentShown && !isTelemetryConsentModalOpen) {
      // Notify main process that telemetry consent is required (shows alert icon)
      if (window.telemetryAPI) {
        window.telemetryAPI.consentRequired().catch(console.error);
      }

      // Show modal after a brief delay to allow app to fully load
      const timer = setTimeout(() => {
        setIsTelemetryConsentModalOpen(true);
      }, 2000); // 2 second delay

      return () => clearTimeout(timer);
    }
  }, [settings.telemetryConsentShown, isTelemetryConsentModalOpen, setIsTelemetryConsentModalOpen]);

  const handleClose = () => {
    setIsTelemetryConsentModalOpen(false);
  };

  return (
    <TelemetryConsentModal
      isOpen={isTelemetryConsentModalOpen}
      onClose={handleClose}
    />
  );
};

export default TelemetryConsentHandler;
