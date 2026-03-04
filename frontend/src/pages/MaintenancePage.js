import React from 'react';

export default function MaintenancePage() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      <img
        src="/logo-asomunicipios.png"
        alt="Asomunicipios"
        className="w-48 h-auto mb-8"
      />
      <h1 className="text-3xl font-bold text-slate-900 font-outfit text-center">
        Sitio en Mantenimiento
      </h1>
      <p className="text-slate-500 mt-3 text-center max-w-md">
        Estamos realizando mejoras en el sistema. Por favor, intente nuevamente más tarde.
      </p>
    </div>
  );
}
