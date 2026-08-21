import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LangProvider } from "@/contexts/LangContext";
import { ScrollToTop } from "./components/ScrollToTop";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/layouts/AppLayout";
import RouteFallback from "@/components/RouteFallback";

// Every page is lazy-loaded so Vite splits the bundle per route. A
// client on a phone opening /app/home only downloads the shared core +
// that page, instead of the whole site (public pages with framer-motion,
// every admin editor, ...) in one 1MB+ file.
const Index = lazy(() => import("./pages/Index"));
const CoachingPage = lazy(() => import("./pages/Coaching"));
const ProgrammesPage = lazy(() => import("./pages/Programmes"));
const AProposPage = lazy(() => import("./pages/APropos"));
const ContactPage = lazy(() => import("./pages/Contact"));
const ApplyPage = lazy(() => import("./pages/Apply"));
const FAQPage = lazy(() => import("./pages/FAQ"));
const ConsultationPage = lazy(() => import("./pages/Consultation"));
const HandstandComingSoon = lazy(() => import("./pages/HandstandComingSoon"));
const MiddleSplitComingSoon = lazy(() => import("./pages/MiddleSplitComingSoon"));
const NotFound = lazy(() => import("./pages/NotFound"));
const LegalNoticePage = lazy(() => import("./pages/LegalNotice"));
const PrivacyPage = lazy(() => import("./pages/Privacy"));
const OnboardingAssessmentPage = lazy(() => import("./pages/OnboardingAssessment"));
const AppLogin = lazy(() => import("./pages/app/Login"));
const AppSignup = lazy(() => import("./pages/app/Signup"));
const AppHome = lazy(() => import("./pages/app/Home"));
const AppPrograms = lazy(() => import("./pages/app/Programs"));
const AppProgramDetail = lazy(() => import("./pages/app/ProgramDetail"));
const AppProfile = lazy(() => import("./pages/app/Profile"));
const ClientInbox = lazy(() => import("./pages/app/ClientInbox"));
const ClientArchived = lazy(() => import("./pages/app/ClientArchived"));
const ClientArchive = lazy(() => import("./pages/app/ClientArchive"));
const AdminProgramNew = lazy(() => import("./pages/app/admin/AdminProgramNew"));
const AdminProgramEdit = lazy(() => import("./pages/app/admin/AdminProgramEdit"));
const AdminTemplates = lazy(() => import("./pages/app/admin/AdminTemplates"));
const AdminTemplateEdit = lazy(() => import("./pages/app/admin/AdminTemplateEdit"));
const AdminFormChecks = lazy(() => import("./pages/app/admin/AdminFormChecks"));
const AdminClientIntake = lazy(() => import("./pages/app/admin/AdminClientIntake"));
const AdminClientDetail = lazy(() => import("./pages/app/admin/AdminClientDetail"));
const AdminClientDashboard = lazy(() => import("./pages/app/admin/AdminClientDashboard"));
const AdminSessions = lazy(() => import("./pages/app/admin/AdminSessions"));
const CheckoutSuccess = lazy(() => import("./pages/app/CheckoutSuccess"));
const OnboardingIntake = lazy(() => import("./pages/app/OnboardingIntake"));
const OnboardingAssessmentUpload = lazy(() => import("./pages/app/OnboardingAssessmentUpload"));
const ClientIntakeView = lazy(() => import("./pages/app/ClientIntakeView"));
const Today = lazy(() => import("./pages/app/Today"));
const History = lazy(() => import("./pages/app/History"));
const SetPassword = lazy(() => import("./pages/app/SetPassword"));

import NativeAppRedirect from "./components/NativeAppRedirect";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LangProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <NativeAppRedirect />
            <Suspense fallback={<RouteFallback fullScreen />}>
              <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/coaching" element={<CoachingPage />} />
              <Route path="/programmes" element={<ProgrammesPage />} />
              <Route path="/a-propos" element={<AProposPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/apply" element={<ApplyPage />} />
              <Route path="/faq" element={<FAQPage />} />
              <Route path="/programmes/handstand-coming-soon" element={<HandstandComingSoon />} />
              <Route path="/programmes/middle-split-coming-soon" element={<MiddleSplitComingSoon />} />
              <Route path="/consultation" element={<ConsultationPage />} />
              <Route path="/legal" element={<LegalNoticePage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/onboarding-assessment" element={<OnboardingAssessmentPage />} />

              {/* Espace connecté */}
              <Route path="/app/login" element={<AppLogin />} />
              <Route path="/app/signup" element={<AppSignup />} />
              <Route path="/app/welcome" element={<SetPassword mode="welcome" />} />
              <Route path="/app/reset-password" element={<SetPassword mode="reset" />} />
              <Route
                path="/app"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<AppHome />} />
                <Route path="home" element={<AppHome />} />
                <Route path="programs" element={<AppPrograms />} />
                <Route path="programs/:slug" element={<AppProgramDetail />} />
                <Route path="profile" element={<AppProfile />} />
                <Route path="inbox" element={<ClientInbox />} />
                <Route path="archived" element={<ClientArchived />} />
                <Route path="archive" element={<ClientArchive />} />
                <Route path="checkout-success" element={<CheckoutSuccess />} />
                <Route path="onboarding/intake" element={<OnboardingIntake />} />
                <Route path="onboarding/assessment" element={<OnboardingAssessmentUpload />} />
                <Route path="intake" element={<ClientIntakeView />} />
                <Route path="today" element={<Today />} />
                <Route path="history" element={<History />} />

                {/* Admin (coach) */}
                {/* Old programs library page is gone; coach manages
                    programs from each client's detail page now. */}
                <Route
                  path="admin/programs"
                  element={<Navigate to="/app/home" replace />}
                />
                <Route
                  path="admin/programs/new"
                  element={
                    <ProtectedRoute requireRole="coach">
                      <AdminProgramNew />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/programs/:id/edit"
                  element={
                    <ProtectedRoute requireRole="coach">
                      <AdminProgramEdit />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/templates"
                  element={
                    <ProtectedRoute requireRole="coach">
                      <AdminTemplates />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/templates/:id/edit"
                  element={
                    <ProtectedRoute requireRole="coach">
                      <AdminTemplateEdit />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/clients"
                  element={<Navigate to="/app/home" replace />}
                />
                <Route
                  path="admin/clients/:id/intake"
                  element={
                    <ProtectedRoute requireRole="coach">
                      <AdminClientIntake />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/clients/:id"
                  element={
                    <ProtectedRoute requireRole="coach">
                      <AdminClientDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/clients/:id/dashboard"
                  element={
                    <ProtectedRoute requireRole="coach">
                      <AdminClientDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/form-checks"
                  element={
                    <ProtectedRoute requireRole="coach">
                      <AdminFormChecks />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/sessions"
                  element={
                    <ProtectedRoute requireRole="coach">
                      <AdminSessions />
                    </ProtectedRoute>
                  }
                />
              </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </LangProvider>
  </QueryClientProvider>
);

export default App;
