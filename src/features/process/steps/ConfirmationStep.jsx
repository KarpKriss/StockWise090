import React from "react";

function ConfirmationStep({ data }) {
  return (
    <>
      <div className="confirm-header">Potwierdzenie operacji</div>

      <div className="confirm-card">
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </div>
    </>
  );
}

export default ConfirmationStep;
