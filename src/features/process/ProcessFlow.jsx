import React from 'react';
import { useProcessFlow } from '../../core/hooks/useProcessFlow.js';
import { useSession } from '../../core/session/SessionContext.jsx';
import { saveEntry } from '../../core/api/entriesApi.js'; // ✅ FIX

import { processConfig } from '../../core/config/processConfig.js';
import { productMap } from '../../core/config/productMap.js';
import { useAuth } from '../../core/auth/AuthContext.jsx';

import LocationStep from './steps/LocationStep.jsx';
import EanStep from './steps/EanStep.jsx';
import SkuStep from './steps/SkuStep.jsx';
import LotStep from './steps/LotStep.jsx';
import TypeStep from './steps/TypeStep.jsx';
import QuantityStep from './steps/QuantityStep.jsx';
import ConfirmationStep from './steps/ConfirmationStep.jsx';
import SessionOperationsList from './SessionOperationsList.jsx';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../core/api/supabaseClient';

function ProcessFlow() {
  console.log('ProcessFlow loaded');

  // ✅ defensywnie
  const sessionContext = useSession() || {};
  const { session, isActive } = sessionContext;

  const authContext = useAuth() || {};
  const { user } = authContext;

  const navigate = useNavigate();

  const {
    currentStep,
    nextStep,
    previousStep,
    processData,
    setField,
    errors,
    resetProcess,
    isLastStep,
  } = useProcessFlow({
    sessionActive: isActive,
    processConfig,
  });

  // 🟡 brak sesji
  if (!session) {
    return <div>Brak aktywnej sesji</div>;
  }

  // 🟡 sesja zamknięta
  if (!isActive || closed) {
    return (
      <div className="screen-title">
        Sesja zamknięta – brak możliwości zapisu
      </div>
    );
  }

  // 🔴 FINAL SAVE
  const handleFinalSave = async () => {
    if (!isLastStep) return;

    try {
      const { data: activeSession, error } = await supabase
        .from('sessions')
        .select('id, site_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (error || !activeSession) {
        alert('Brak aktywnej sesji');
        return;
      }

      const payload = {
        session_id: activeSession.id, // 🔥 tylko z DB
        operator: user.email,
        site_id: activeSession.site_id,
        operation_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        ...processData,
      };

      console.log('FINAL PAYLOAD:', payload); // 🔥 debug

      await saveEntry(payload);
      resetProcess();
    } catch (error) {
      console.error('SAVE ERROR:', error);
      alert(error.message || 'Błąd zapisu operacji');
    }
  };

  // 🔵 RENDER KROKÓW (z zabezpieczeniem)
  const renderStep = () => {
    if (!currentStep) {
      return <div>Brak kroku procesu</div>;
    }

    switch (currentStep) {
      case 'location':
        return (
          <LocationStep
            value={processData.location}
            onChange={(val) => setField('location', val)}
            error={errors.location}
          />
        );

      case 'ean':
        return (
          <EanStep
            value={processData.ean}
            onChange={(val) => {
              setField('ean', val);

              if (productMap[val]) {
                setField('sku', productMap[val].sku);
              } else {
                setField('sku', '');
              }
            }}
            error={
              processData.ean && !productMap[processData.ean]
                ? 'EAN nieznany – możesz wpisać SKU ręcznie'
                : errors.ean
            }
          />
        );

      case 'sku':
        return (
          <SkuStep
            value={processData.sku}
            onChange={(val) => setField('sku', val)}
            error={errors.sku}
          />
        );

      case 'lot':
        return (
          <LotStep
            value={processData.lot}
            onChange={(val) => setField('lot', val)}
            error={errors.lot}
          />
        );

      case 'type':
        return (
          <TypeStep
            value={processData.type}
            onChange={(val) => setField('type', val)}
            error={errors.type}
          />
        );

      case 'quantity':
        return (
          <QuantityStep
            value={processData.quantity}
            onChange={(val) => setField('quantity', val)}
            error={errors.quantity}
          />
        );

      case 'confirmation':
        return <ConfirmationStep data={processData} />;

      default:
        return <div>Błąd konfiguracji kroków</div>;
    }
  };

  return (
    <>
      {renderStep()}

      <div style={{ marginTop: 32 }}>
        {currentStep !== 'location' && (
          <button onClick={previousStep}>Wstecz</button>
        )}

        {!isLastStep && <button onClick={nextStep}>Dalej</button>}

        {isLastStep && (
          <>
            <button onClick={handleFinalSave}>Zapisz operację</button>

            <button onClick={() => navigate('/menu')}>Powrót do menu</button>
          </>
        )}
      </div>

      {currentStep === 'confirmation' && <SessionOperationsList />}
    </>
  );
}

export default ProcessFlow;
