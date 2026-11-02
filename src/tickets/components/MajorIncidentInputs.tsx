import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MAJOR_INCIDENT_TYPES, type MajorIncident } from "@/tickets/lib/types";

export default function MajorIncidentInputs({ value, onChange }: { value: MajorIncident; onChange: (value: MajorIncident) => void }) {
  return (
    <fieldset className="space-y-3 rounded-md border p-3" data-testid="section-major-incident">
      <legend className="px-1 text-sm font-medium">Major Incident</legend>
      <div className="space-y-1">
        <Label>Major incident type</Label>
        <Select value={value.incidentType || ""} onValueChange={(incidentType) => onChange({ ...value, incidentType })}>
          <SelectTrigger data-testid="select-major-type"><SelectValue placeholder="Choose" /></SelectTrigger>
          <SelectContent>{MAJOR_INCIDENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="major-impact">Business impact</Label>
        <Textarea id="major-impact" rows={2} maxLength={2000} value={value.businessImpact || ""} onChange={(e) => onChange({ ...value, businessImpact: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="major-locations">Impacted locations</Label>
        <Input id="major-locations" maxLength={500} value={value.impactedLocations || ""} onChange={(e) => onChange({ ...value, impactedLocations: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="major-customers">No. of customers impacted</Label>
        <Input
          id="major-customers"
          type="number"
          min={0}
          value={value.customersImpacted ?? ""}
          onChange={(e) => onChange({ ...value, customersImpacted: e.target.value === "" ? undefined : Number(e.target.value) })}
        />
      </div>
    </fieldset>
  );
}
