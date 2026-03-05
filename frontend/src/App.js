import React, { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { WebSocketProvider } from "./context/WebSocketContext";
import { Toaster } from "sonner";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import DashboardLayout from "./pages/DashboardLayout";
import DashboardHome from "./pages/DashboardHome";
import MyPetitions from "./pages/MyPetitions";
import CreatePetition from "./pages/CreatePetition";
import PetitionDetail from "./pages/PetitionDetail";
import AllPetitions from "./pages/AllPetitions";
import UserManagement from "./pages/UserManagement";
import EstadisticasUnificadas from "./pages/EstadisticasUnificadas";
import Predios from "./pages/Predios";
import VisorPredios from "./pages/VisorPredios";
import Pendientes from "./pages/Pendientes";
import PermissionsManagement from "./pages/PermissionsManagement";
import ProyectosActualizacion from "./pages/ProyectosActualizacion";
import VisorActualizacion from "./pages/VisorActualizacion";
import GestionPropuestas from "./pages/GestionPropuestas";
import CertificadosGestion from "./pages/CertificadosGestion";
import PrediosEnProceso from "./pages/PrediosEnProceso";
import GestionPrediosActualizacion from "./pages/GestionPrediosActualizacion";
import MaintenancePage from "./pages/MaintenancePage";
import ConfiguracionResoluciones from "./pages/ConfiguracionResoluciones";
import MutacionesResoluciones from "./pages/MutacionesResoluciones";
import LogActividades from "./pages/LogActividades";
import { OfflineIndicator, OnlineIndicator, PWAInstallPrompt } from "./components/OfflineComponents";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

function App() {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check maintenance status
    fetch(`${BACKEND_URL}/api/maintenance/status`)
      .then(res => res.json())
      .then(data => {
        setMaintenanceMode(data.enabled);
      })
      .catch(() => {
        setMaintenanceMode(false);
      })
      .finally(() => {
        setMaintenanceLoading(false);
      });

    // Check if current user is admin from stored token
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.role === 'administrador' || payload.role === 'coordinador') {
          setIsAdmin(true);
        }
      }
    } catch {
      // Invalid token or not logged in
    }
  }, []);

  // Show maintenance page for non-admin users when maintenance is active
  if (!maintenanceLoading && maintenanceMode && !isAdmin) {
    return <MaintenancePage />;
  }

  return (
    <AuthProvider>
      <Toaster
        position="top-center"
        richColors
        expand={true}
        visibleToasts={5}
        toastOptions={{
          style: { zIndex: 2147483647 },
          className: 'toast-above-all'
        }}
        containerStyle={{ zIndex: 2147483647 }}
      />
      <WebSocketProvider>
        <BrowserRouter>
          {maintenanceMode && isAdmin && (
            <div className="bg-amber-500 text-white text-center text-sm py-1 px-4 font-medium">
              Modo mantenimiento activo — Solo visible para administradores
            </div>
          )}
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardHome />} />
            <Route path="peticiones" element={<MyPetitions />} />
            <Route path="peticiones/nueva" element={<CreatePetition />} />
            <Route path="peticiones/:id" element={<PetitionDetail />} />
            <Route path="todas-peticiones" element={<AllPetitions />} />
            <Route path="usuarios" element={<UserManagement />} />
            <Route path="estadisticas" element={<EstadisticasUnificadas />} />
            <Route path="predios" element={<Predios />} />
            <Route path="visor-predios" element={<VisorPredios />} />
            <Route path="pendientes" element={<Pendientes />} />
            <Route path="permisos" element={<PermissionsManagement />} />
            <Route path="proyectos-actualizacion" element={<ProyectosActualizacion />} />
            <Route path="gestion-predios-actualizacion/:proyectoId" element={<GestionPrediosActualizacion />} />
            <Route path="visor-actualizacion/:proyectoId" element={<VisorActualizacion />} />
            <Route path="gestion-propuestas" element={<GestionPropuestas />} />
            <Route path="certificados" element={<CertificadosGestion />} />
            <Route path="predios-en-proceso" element={<PrediosEnProceso />} />
            <Route path="configuracion-resoluciones" element={<ConfiguracionResoluciones />} />
            <Route path="mutaciones-resoluciones" element={<MutacionesResoluciones />} />
            <Route path="log-actividades" element={<LogActividades />} />
          </Route>
        </Routes>
        </BrowserRouter>

        {/* PWA Components */}
        <OfflineIndicator />
        <OnlineIndicator />
        <PWAInstallPrompt />
      </WebSocketProvider>
    </AuthProvider>
  );
}

export default App;
