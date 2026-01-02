import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import DashboardLayout from "@/components/layout/DashboardLayout";

// Pages
import Auth from "./pages/Auth";
import AdminSetup from "./pages/AdminSetup";
import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import PatientDetail from "./pages/PatientDetail";
import Therapists from "./pages/Therapists";
import MedicalOrders from "./pages/MedicalOrders";
import Schedule from "./pages/Schedule";
import MySchedule from "./pages/MySchedule";
import Profile from "./pages/Profile";
import Evolutions from "./pages/Evolutions";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Rutas públicas */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/setup" element={<AdminSetup />} />
            
            {/* Redirigir raíz a dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            {/* Rutas protegidas con layout de dashboard */}
            <Route
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/patients" element={<Patients />} />
              <Route path="/patients/:id" element={<PatientDetail />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/my-schedule" element={<MySchedule />} />
              <Route path="/evolutions" element={<Evolutions />} />
              
              {/* Rutas solo para admin */}
              <Route
                path="/therapists"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <Therapists />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/orders"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <MedicalOrders />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/schedule"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <Schedule />
                  </ProtectedRoute>
                }
              />
            </Route>
            
            {/* Ruta 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;