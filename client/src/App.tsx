import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { MedicareGuideChat } from "@/features/medicare-guide-chat";
import VoiceWidget from "./components/VoiceWidget";
import { ThemeProvider } from "./contexts/ThemeContext";
import { QuoteHandoffProvider } from "./contexts/QuoteHandoffContext";
import Home from "./pages/Home";
import Plans from "./pages/Plans";
import AICompare from "./pages/AICompare";
import PlanLookup from "./pages/PlanLookup";
import PlanRecommender from "./pages/PlanRecommender";
import VerifyCoverage from "./pages/VerifyCoverage";
import FindBestPlan from "./pages/FindBestPlan";
import AdminDashboard from "./pages/AdminDashboard";

// Medicare Advantage sub-pages
import MAHMOPlans from "./pages/ma/MAHMOPlans";
import MAPPOPlans from "./pages/ma/MAPPOPlans";
import MASNPlans from "./pages/ma/MASNPlans";
import MADrugCoverage from "./pages/ma/MADrugCoverage";

// Medicare Supplement sub-pages
import {
  MedigapPlanF,
  MedigapPlanG,
  MedigapPlanN,
  CompareSupplementPlans,
} from "./pages/supplement/SupplementPages";

// Part D sub-pages
import {
  CompareDrugPlans,
  DrugFormularySearch,
  ExtraHelpPrograms,
  PartDEnrollment,
} from "./pages/partd/PartDPages";

// Resources sub-pages
import {
  Medicare101,
  EnrollmentPeriods,
  StarRatingsGuide,
  FAQ,
} from "./pages/resources/ResourcePages";
import MedicareGuide from "./pages/resources/MedicareGuide";

// Company pages
import {
  AboutUs,
  LicensedAgents,
  ContactUs,
  PrivacyPolicy,
  DualEligible,
} from "./pages/company/CompanyPages";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      {/* Core */}
      <Route path="/" component={Home} />
      <Route path="/plans" component={Plans} />
      <Route path="/ai-compare" component={AICompare} />
      <Route path="/plan-lookup" component={PlanLookup} />
      <Route path="/plan-recommender" component={PlanRecommender} />
      <Route path="/verify-coverage" component={VerifyCoverage} />
      <Route path="/find-best-plan" component={FindBestPlan} />
      <Route path="/admin" component={AdminDashboard} />

      {/* Medicare Advantage */}
      <Route path="/medicare-advantage/hmo-plans" component={MAHMOPlans} />
      <Route path="/medicare-advantage/ppo-plans" component={MAPPOPlans} />
      <Route path="/medicare-advantage/special-needs-plans" component={MASNPlans} />
      <Route path="/medicare-advantage/drug-coverage" component={MADrugCoverage} />

      {/* Medicare Supplement */}
      <Route path="/medicare-supplement/plan-f" component={MedigapPlanF} />
      <Route path="/medicare-supplement/plan-g" component={MedigapPlanG} />
      <Route path="/medicare-supplement/plan-n" component={MedigapPlanN} />
      <Route path="/medicare-supplement/compare" component={CompareSupplementPlans} />

      {/* Part D */}
      <Route path="/part-d/compare" component={CompareDrugPlans} />
      <Route path="/part-d/formulary-search" component={DrugFormularySearch} />
      <Route path="/part-d/extra-help" component={ExtraHelpPrograms} />
      <Route path="/part-d/enrollment" component={PartDEnrollment} />

      {/* Resources */}
      <Route path="/resources/medicare-guide" component={MedicareGuide} />
      <Route path="/resources/medicare-101" component={Medicare101} />
      <Route path="/resources/enrollment-periods" component={EnrollmentPeriods} />
      <Route path="/resources/star-ratings" component={StarRatingsGuide} />
      <Route path="/resources/faq" component={FAQ} />

      {/* Company */}
      <Route path="/about" component={AboutUs} />
      <Route path="/agents" component={LicensedAgents} />
      <Route path="/contact" component={ContactUs} />
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route path="/dual-eligible" component={DualEligible} />

      {/* Fallback */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <QuoteHandoffProvider>
        <TooltipProvider>
          <Toaster position="top-right" richColors />
          <main id="main-content" tabIndex={-1} style={{ outline: "none" }}><Router /></main>
          <MedicareGuideChat />
                      <VoiceWidget />
        </TooltipProvider>
        </QuoteHandoffProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
          
}

export default App;
