import { Switch, Route, Redirect } from "wouter";
import { useAuth } from "@/lib/auth";
import { isMcqStaff, isMcqTaker } from "@/mcq/lib/roles";
import McqLayout from "@/mcq/components/McqLayout";
import McqDashboardPage from "@/mcq/pages/McqDashboardPage";
import McqQuestionsPage from "@/mcq/pages/McqQuestionsPage";
import McqTestsPage from "@/mcq/pages/McqTestsPage";
import McqTestDetailPage from "@/mcq/pages/McqTestDetailPage";
import McqMyTestsPage from "@/mcq/pages/McqMyTestsPage";
import McqTakeTestPage from "@/mcq/pages/McqTakeTestPage";
import McqResultsPage from "@/mcq/pages/McqResultsPage";
import McqResultDetailPage from "@/mcq/pages/McqResultDetailPage";
import McqAnalyticsPage from "@/mcq/pages/McqAnalyticsPage";
import McqExternalResultsPage from "@/mcq/pages/McqExternalResultsPage";
import McqSettingsPage from "@/mcq/pages/McqSettingsPage";

// Mounted by App.tsx as a nested route under /mcq. All paths here are
// relative to that base. Backend authorization is enforced independently.
export default function McqRouter() {
  const { user } = useAuth();
  const staff = isMcqStaff(user);
  const taker = isMcqTaker(user?.role);

  return (
    <McqLayout>
      <Switch>
        <Route path="/" component={McqDashboardPage} />
        {staff && <Route path="/questions" component={McqQuestionsPage} />}
        {staff && <Route path="/tests" component={McqTestsPage} />}
        {staff && <Route path="/tests/:id" component={McqTestDetailPage} />}
        {taker && <Route path="/my-tests" component={McqMyTestsPage} />}
        {taker && <Route path="/take-test/:id" component={McqTakeTestPage} />}
        <Route path="/results" component={McqResultsPage} />
        <Route path="/results/:id" component={McqResultDetailPage} />
        {staff && <Route path="/external-results" component={McqExternalResultsPage} />}
        {staff && <Route path="/analytics" component={McqAnalyticsPage} />}
        {staff && <Route path="/settings" component={McqSettingsPage} />}
        <Route><Redirect to="/" /></Route>
      </Switch>
    </McqLayout>
  );
}
