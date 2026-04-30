import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LangProvider } from "@/contexts/LangContext";
import Index from "./pages/Index";
import CoachingPage from "./pages/Coaching";
import ProgrammesPage from "./pages/Programmes";
import AProposPage from "./pages/APropos";
import ContactPage from "./pages/Contact";
import ApplyPage from "./pages/Apply";
import FAQPage from "./pages/FAQ";
import ConsultationPage from "./pages/Consultation";
import HandstandComingSoon from "./pages/HandstandComingSoon";
import MiddleSplitComingSoon from "./pages/MiddleSplitComingSoon";
import NotFound from "./pages/NotFound";
import LegalNoticePage from "./pages/LegalNotice";
import PrivacyPage from "./pages/Privacy";
import OnboardingAssessmentPage from "./pages/OnboardingAssessment";
import { ScrollToTop } from "./components/ScrollToTop";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/layouts/AppLayout";
import AppLogin from "./pages/app/Login";
import AppSignup from "./pages/app/Signup";
import AppHome from "./pages/app/Home";
import AppPrograms from "./pages/app/Programs";
import AppProgramDetail from "./pages/app/ProgramDetail";
import AppProfile from "./pages/app/Profile";
import ClientInbox from "./pages/app/ClientInbox";
import ClientArchived from "./pages/app/ClientArchived";
import ClientArchive from "./pages/app/ClientArchive";
import AdminProgramNew from "./pages/app/admin/AdminProgramNew";
import AdminProgramEdit from "./pages/app/admin/AdminProgramEdit";
import AdminFormChecks from "./pages/app/admin/AdminFormChecks";
import AdminClientIntake from "./pages/app/admin/AdminClientIntake";
import AdminClientDetail from "./pages/app/admin/AdminClientDetail";
import CheckoutSuccess from "./pages/app/CheckoutSuccess";
import OnboardingIntake from "./pages/app/OnboardingIntake";
import OnboardingAssessmentUpload from "./pages/app/OnboardingAssessmentUpload";
import ClientIntakeView from "./pages/app/ClientIntakeView";
import Today from "./pages/app/Today";
import History from "./pages/app/History";
import SetPassword from "./pages/app/SetPassword";

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
                  path="admin/form-checks"
                  element={
                    <ProtectedRoute requireRole="coach">
                      <AdminFormChecks />
                    </ProtectedRoute>
                  }
                />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </LangProvider>
  </QueryClientProvider>
);

export default App;
