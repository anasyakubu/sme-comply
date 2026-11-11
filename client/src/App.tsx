/**
 * Module purpose: Defines the public, business-user, and administrator routes. Guards prevent the wrong user role from opening protected screens, while lazy loading keeps the first page lightweight.
 */
import { lazy, ReactElement, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { BusinessProvider } from './context/BusinessContext';
import { AdminRoute, GuestRoute, ProtectedRoute, SuperAdminRoute } from './components/layout/Guards';
import { AppLayout } from './components/layout/AppLayout';
import { AdminLayout } from './components/layout/AdminLayout';
import { FullPageLoader, Spinner } from './components/ui';
import Landing from './pages/public/Landing';
import Login from './pages/public/Login';
import Register from './pages/public/Register';
import { ForgotPassword, NotFound, ResetPassword, VerifyEmail } from './pages/public/PasswordPages';

// App and admin pages are split into their own chunks so the landing page stays light.
const Dashboard = lazy(() => import('./pages/app/Dashboard'));
const Tasks = lazy(() => import('./pages/app/Tasks'));
const TaskDetails = lazy(() => import('./pages/app/TaskDetails'));
const CalendarPage = lazy(() => import('./pages/app/Calendar'));
const Filings = lazy(() => import('./pages/app/Filings'));
const Documents = lazy(() => import('./pages/app/Documents'));
const Notifications = lazy(() => import('./pages/app/Notifications'));
const Reports = lazy(() => import('./pages/app/Reports'));
const Businesses = lazy(() => import('./pages/app/Businesses'));
const BusinessNew = lazy(() => import('./pages/app/BusinessNew'));
const BusinessDetails = lazy(() => import('./pages/app/BusinessDetails'));
const Profile = lazy(() => import('./pages/app/Profile'));
const Settings = lazy(() => import('./pages/app/Settings'));

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const Agencies = lazy(() => import('./pages/admin/Agencies'));
const Requirements = lazy(() => import('./pages/admin/Requirements'));
const Users = lazy(() => import('./pages/admin/Users'));
const AdminBusinesses = lazy(() => import('./pages/admin/AdminBusinesses'));
const AdminNotifications = lazy(() => import('./pages/admin/AdminNotifications'));
const AdminComposeEmail = lazy(() => import('./pages/admin/AdminComposeEmail'));
const AdminEmailHistory = lazy(() => import('./pages/admin/AdminEmailHistory'));
const AuditLogs = lazy(() => import('./pages/admin/AuditLogs'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));

const page = (el: ReactElement) => <Suspense fallback={<Spinner />}>{el}</Suspense>;

/**
 * Connects URL routes to pages. Business users and administrators have separate layouts, and Super Admin pages have their own guard.
 */
export default function App() {
  // Business routes restore the selected business; email pages add a stricter Super Admin guard.
  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
        <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />

        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <BusinessProvider>
                <AppLayout />
              </BusinessProvider>
            </ProtectedRoute>
          }
        >
          <Route index element={page(<Dashboard />)} />
          <Route path="tasks" element={page(<Tasks />)} />
          <Route path="tasks/:id" element={page(<TaskDetails />)} />
          <Route path="calendar" element={page(<CalendarPage />)} />
          <Route path="filings" element={page(<Filings />)} />
          <Route path="documents" element={page(<Documents />)} />
          <Route path="notifications" element={page(<Notifications />)} />
          <Route path="reports" element={page(<Reports />)} />
          <Route path="businesses" element={page(<Businesses />)} />
          <Route path="businesses/new" element={page(<BusinessNew />)} />
          <Route path="businesses/:id" element={page(<BusinessDetails />)} />
          <Route path="profile" element={page(<Profile />)} />
          <Route path="settings" element={page(<Settings />)} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Route>

        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={page(<AdminDashboard />)} />
          <Route path="agencies" element={page(<Agencies />)} />
          <Route path="requirements" element={page(<Requirements />)} />
          <Route path="users" element={page(<Users />)} />
          <Route path="businesses" element={page(<AdminBusinesses />)} />
          <Route path="notifications" element={page(<AdminNotifications />)} />
          <Route path="emails" element={<SuperAdminRoute>{page(<AdminEmailHistory />)}</SuperAdminRoute>} />
          <Route path="emails/new" element={<SuperAdminRoute>{page(<AdminComposeEmail />)}</SuperAdminRoute>} />
          <Route path="audit-logs" element={page(<AuditLogs />)} />
          <Route path="settings" element={page(<AdminSettings />)} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
