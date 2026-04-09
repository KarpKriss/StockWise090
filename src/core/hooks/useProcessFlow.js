import { useState, useCallback, useMemo } from "react";

/*
  Hook buduje dynamiczną listę kroków
  na podstawie konfiguracji procesu.
*/

export function useProcessFlow(config = {}) {
  const { processConfig = {}, sessionActive = true } = config;

  // Budujemy dynamicznie listę kroków
  const steps = useMemo(() => {
    return Object.keys(processConfig).filter(
      (key) => processConfig[key].enabled
    );
  }, [processConfig]);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [processData, setProcessData] = useState({});
  const [errors, setErrors] = useState({});

  const currentStep = steps[currentStepIndex];

  const setField = useCallback((key, value) => {
    setProcessData((prev) => ({
      ...prev,
      [key]: value,
    }));

    setErrors((prev) => ({
      ...prev,
      [key]: null,
    }));
  }, []);

  const isStepValid = useCallback(() => {
    if (!sessionActive) return false;

    const stepConfig = processConfig[currentStep];

    if (!stepConfig) return true;

    if (!stepConfig.mandatory) return true;

    const value = processData[currentStep];

    if (!value || value === "") {
      setErrors((prev) => ({
        ...prev,
        [currentStep]: "Pole jest wymagane",
      }));
      return false;
    }

    return true;
  }, [currentStep, processData, processConfig, sessionActive]);

  const nextStep = useCallback(() => {
    if (!isStepValid()) return;

    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  }, [currentStepIndex, steps.length, isStepValid]);

  const previousStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  const resetProcess = useCallback(() => {
    setProcessData({});
    setErrors({});
    setCurrentStepIndex(0);
  }, []);

  const isLastStep = currentStepIndex === steps.length - 1;
  const isFirstStep = currentStepIndex === 0;

  return {
    currentStep,
    currentStepIndex,
    steps,
    processData,
    errors,
    setField,
    nextStep,
    previousStep,
    resetProcess,
    isLastStep,
    isFirstStep,
  };
}
