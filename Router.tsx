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
import { EventForumPage } from './pages/client/EventForumPage';
import SurveyLinkPage from './pages/SurveyLinkPage';

// Admin Pages
import { EventManagementPage } from './pages/admin/EventManagementPage';
import { EventCreationPage } from './pages/admin/EventCreationPage';
import { EventEditPage } from './pages/admin/EventEditPage';
import { StageManagementPage } from './pages/admin/StageManagementPage';
import PromotionManagementPage from './pages/admin/PromotionManagementPage';
import { UserManagementPage } from './pages/admin/UserManagementPage';
import { ReservationManagementPage } from './pages/admin/ReservationManagementPage';
import { AdditionalServicesPage } from './pages/admin/AdditionalServicesPage';
import { ComingSoonPage } from './pages/admin/ComingSoonPage';
import PaymentsAdminPage from './pages/admin/PaymentsAdminPage';
import ReportsAdminPage from './pages/admin/ReportsAdminPage';
import CategoryManagementPage from './pages/admin/CategoryManagementPage';
import CategoryEventsPage from './pages/admin/CategoryEventsPage';
import OrganizerDashboardPage from './pages/admin/OrganizerDashboardPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import SupportDashboardPage from './pages/admin/SupportDashboardPage';
import SupportTicketsPage from './pages/admin/SupportTicketsPage';
import { OrganizerAccountsPage, SupportAccountsPage } from './pages/admin/ManagedAccountsPage';
import SurveyInvitationsPage from './pages/admin/SurveyInvitationsPage';
import ForumMonitorPage from './pages/admin/ForumMonitorPage';
import EventRequestPage from './pages/admin/EventRequestPage';
import EventRequestsAdminPage from './pages/admin/EventRequestsAdminPage';

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
                {/* Ruta pública para responder encuestas vía enlace */}
                <Route path="survey" element={<SurveyLinkPage />} />
                {/* FIX: Explicitly pass children to ProtectedRoute to fix type error */}
                <Route path="evento/:id/asientos" element={
                    <ProtectedRoute loginRequired children={<SeatSelectionPage />} />
                } />
                <Route path="evento/:id/foro" element={
                    <ProtectedRoute loginRequired children={<EventForumPage />} />
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
                <ProtectedRoute
                    roles={['organizador', 'administrador', 'soporte']}
                    privileges={['PLATFORM_VIEW_DASHBOARD', 'EVENT_MANAGE_OWN', 'EVENT_MANAGE_ALL', 'USER_READ_ALL']}
                    children={<AdminLayout />}
                />
            }>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<ProtectedRoute roles={['organizador', 'administrador', 'soporte']} privileges={['PLATFORM_VIEW_DASHBOARD']} children={<AdminDashboardPage />} />} />
                import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
                <Route path="organizador" element={
                    <ProtectedRoute roles={['organizador', 'administrador']} privileges={['EVENT_MANAGE_OWN']} children={<OrganizerDashboardPage />} />
                } />
                <Route path="soporte" element={
                    <ProtectedRoute roles={['soporte', 'administrador', 'organizador']} children={<SupportTicketsPage />} />
                } />
                <Route path="eventos" element={
                    <ProtectedRoute roles={['organizador', 'administrador']} privileges={['EVENT_MANAGE_OWN', 'EVENT_MANAGE_ALL']} children={<EventManagementPage />} />
                } />
                <Route path="eventos/crear" element={
                    <ProtectedRoute roles={['organizador', 'administrador']} privileges={['EVENT_CREATE']} children={<EventCreationPage />} />
                } />
                <Route path="eventos/solicitar" element={
                    <ProtectedRoute roles={['organizador', 'administrador', 'soporte']} privileges={['EVENT_CREATE', 'EVENT_MANAGE_ALL', 'EVENT_MANAGE_OWN']} children={<EventRequestPage />} />
                } />
                <Route path="eventos/solicitudes" element={
                    <ProtectedRoute roles={['administrador', 'soporte']} privileges={['EVENT_MANAGE_ALL']} children={<EventRequestsAdminPage />} />
                } />
                <Route path="eventos/:id/editar" element={
                    <ProtectedRoute roles={['organizador', 'administrador']} privileges={['EVENT_MANAGE_OWN', 'EVENT_MANAGE_ALL']} children={<EventEditPage />} />
                } />
                <Route path="usuarios" element={
                    <ProtectedRoute roles={['administrador']} privileges={['USER_READ_ALL']} children={<UserManagementPage />} />
                } />
                <Route path="organizers" element={
                    <ProtectedRoute roles={['administrador']} privileges={['USER_MANAGE_STATUS']} children={<OrganizerAccountsPage />} />
                } />
                <Route path="support" element={
                    <ProtectedRoute roles={['administrador']} privileges={['USER_MANAGE_STATUS']} children={<SupportAccountsPage />} />
                } />
                <Route path="escenarios" element={
                    <ProtectedRoute roles={['organizador', 'administrador']} privileges={['EVENT_MANAGE_OWN', 'EVENT_MANAGE_ALL']} children={<StageManagementPage />} />
                } />
                <Route path="promociones" element={
                    <ProtectedRoute roles={['organizador', 'administrador']} privileges={['EVENT_MANAGE_ALL', 'EVENT_MANAGE_OWN']} children={<PromotionManagementPage />} />
                } />
                <Route path="reservaciones" element={
                    <ProtectedRoute roles={['administrador', 'organizador', 'soporte']} privileges={['RESERVATION_READ_ALL']} children={<ReservationManagementPage />} />
                } />
                <Route path="encuestas" element={
                    <ProtectedRoute roles={['organizador', 'administrador']} privileges={['EVENT_MANAGE_OWN', 'EVENT_MANAGE_ALL']} children={<SurveyInvitationsPage />} />
                } />
                <Route path="servicios" element={
                    <ProtectedRoute roles={['organizador', 'administrador']} privileges={['EVENT_MANAGE_ALL', 'EVENT_MANAGE_OWN']} children={<AdditionalServicesPage />} />
                } />
                <Route path="categorias" element={
                    <ProtectedRoute roles={['organizador', 'administrador']} privileges={['EVENT_MANAGE_ALL', 'EVENT_MANAGE_OWN']} children={<CategoryManagementPage />} />
                } />
                <Route path="categorias/:id/eventos" element={
                    <ProtectedRoute roles={['organizador', 'administrador']} privileges={['EVENT_MANAGE_ALL', 'EVENT_MANAGE_OWN']} children={<CategoryEventsPage />} />
                } />
                <Route path="pagos" element={
                    <ProtectedRoute
                        roles={['administrador', 'organizador', 'soporte']}
                        children={<PaymentsAdminPage />}
                    />
                } />
                <Route path="reportes" element={
                    <ProtectedRoute
                        roles={['administrador', 'soporte', 'organizador']}
                        children={<ReportsAdminPage />}
                    />
                } />
                <Route path="foros" element={
                    <ProtectedRoute roles={['administrador', 'soporte', 'organizador']} children={<ForumMonitorPage />} />
                } />
            </Route>

            {/* Fallback Route */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}