import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useKeycloak } from './hooks/useKeycloak';
import { ProtectedRoute } from './components/ProtectedRoute';

// Layouts
import { ClientLayout } from './layouts/ClientLayout';
import { AdminLayout } from './layouts/AdminLayout';

// Client Pages
import { HomePage } from './pages/client/HomePage';
import { EventDetailPage } from './pages/client/EventDetailPage';
import { SeatSelectionPage } from './pages/client/SeatSelectionPage';
import { CheckoutPage } from './pages/client/CheckoutPage';
import { UserProfile } from './pages/client/UserProfile';
import { PaymentPage } from './pages/client/PaymentPage';

// Admin Pages
import { EventManagementPage } from './pages/admin/EventManagementPage';
import { EventCreationPage } from './pages/admin/EventCreationPage';
import { EventEditPage } from './pages/admin/EventEditPage';
import { StageManagementPage } from './pages/admin/StageManagementPage';
import { PromotionManagementPage } from './pages/admin/PromotionManagementPage';
import { UserManagementPage } from './pages/admin/UserManagementPage';
import { ReservationManagementPage } from './pages/admin/ReservationManagementPage';
import { AdditionalServicesPage } from './pages/admin/AdditionalServicesPage';
import { ComingSoonPage } from './pages/admin/ComingSoonPage';
import CategoryManagementPage from './pages/admin/CategoryManagementPage';
import CategoryEventsPage from './pages/admin/CategoryEventsPage';

export const Router = () => {
    const { isInitializing } = useKeycloak();

    if (isInitializing) {
        return <div className="flex items-center justify-center h-screen"><p className="text-xl">Cargando Plataforma...</p></div>;
    }

    return (
        <Routes>
            {/* Client and Public Routes */}
            <Route path="/" element={<ClientLayout />}>
                <Route index element={<HomePage />} />
                <Route path="evento/:id" element={<EventDetailPage />} />
                
                {/* FIX: Explicitly pass children to ProtectedRoute to fix type error */}
                <Route path="evento/:id/asientos" element={
                    <ProtectedRoute loginRequired children={<SeatSelectionPage />} />
                } />
                 {/* FIX: Explicitly pass children to ProtectedRoute to fix type error */}
                 <Route path="checkout" element={
                    <ProtectedRoute loginRequired children={<CheckoutPage />} />
                } />
                <Route path="payment" element={
                    <ProtectedRoute loginRequired children={<PaymentPage />} />
                } />
                {/* FIX: Explicitly pass children to ProtectedRoute to fix type error */}
                <Route path="perfil" element={
                    <ProtectedRoute loginRequired children={<UserProfile />} />
                } />
            </Route>
            
            {/* Admin Routes */}
            {/* FIX: Explicitly pass children to ProtectedRoute to fix type error */}
            <Route path="/admin" element={
                <ProtectedRoute roles={['organizador', 'administrador']} children={<AdminLayout />} />
            }>
                <Route index element={<Navigate to="eventos" replace />} />
                <Route path="eventos" element={<EventManagementPage />} />
                <Route path="eventos/crear" element={<EventCreationPage />} />
                <Route path="eventos/:id/editar" element={<EventEditPage />} />
                <Route path="usuarios" element={<UserManagementPage />} />
                <Route path="escenarios" element={<StageManagementPage />} />
                <Route path="promociones" element={<PromotionManagementPage />} />
                <Route path="reservaciones" element={<ReservationManagementPage />} />
                <Route path="servicios" element={<AdditionalServicesPage />} />
                <Route path="categorias" element={<CategoryManagementPage />} />
                <Route path="categorias/:id/eventos" element={<CategoryEventsPage />} />
                <Route path="pagos" element={<ComingSoonPage />} />
                <Route path="reportes" element={<ComingSoonPage />} />
                <Route path="foros" element={<ComingSoonPage />} />
            </Route>

            {/* Fallback Route */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}