import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
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
import { OfflineIndicator, OnlineIndicator, PWAInstallPrompt } from "./components/OfflineComponents";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
      
      {/* PWA Components */}
      <OfflineIndicator />
      <OnlineIndicator />
      <PWAInstallPrompt />
    </AuthProvider>
  );
}

export default App;
