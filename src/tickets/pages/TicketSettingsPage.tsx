import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GeneralSettings from "@/tickets/components/settings/GeneralSettings";
import CategorySettings from "@/tickets/components/settings/CategorySettings";
import GroupSettings from "@/tickets/components/settings/GroupSettings";
import SlaSettings from "@/tickets/components/settings/SlaSettings";
import AutomationSettings from "@/tickets/components/settings/AutomationSettings";
import CannedSettings from "@/tickets/components/settings/CannedSettings";
import ClosureSettings from "@/tickets/components/settings/ClosureSettings";
import FieldSettings from "@/tickets/components/settings/FieldSettings";
import ScenarioSettings from "@/tickets/components/settings/ScenarioSettings";

const TABS = [
  { value: "general", label: "General", Component: GeneralSettings },
  { value: "categories", label: "Categories", Component: CategorySettings },
  { value: "groups", label: "Groups", Component: GroupSettings },
  { value: "sla", label: "SLA", Component: SlaSettings },
  { value: "automation", label: "Automation", Component: AutomationSettings },
  { value: "scenarios", label: "Scenarios", Component: ScenarioSettings },
  { value: "closure", label: "Closure Rules", Component: ClosureSettings },
  { value: "fields", label: "Ticket Fields", Component: FieldSettings },
  { value: "canned", label: "Canned Replies", Component: CannedSettings },
];

export default function TicketSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ticket Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure how tickets work in your organization</p>
      </div>
      <Tabs defaultValue="general">
        <TabsList className="flex w-full flex-wrap justify-start h-auto">
          {TABS.map((tab) => <TabsTrigger key={tab.value} value={tab.value} data-testid={`tab-ticket-settings-${tab.value}`}>{tab.label}</TabsTrigger>)}
        </TabsList>
        {TABS.map(({ value, Component }) => <TabsContent key={value} value={value} className="mt-4"><Component /></TabsContent>)}
      </Tabs>
    </div>
  );
}
