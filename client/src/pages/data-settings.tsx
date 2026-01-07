import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/queryClient';

export default function DataSettings() {
  const [retentionEnabled, setRetentionEnabled] = useState(false);
  const [retentionDays, setRetentionDays] = useState(365);
  const [riskAlertAt, setRiskAlertAt] = useState('high');
  const [riskTrendWindow, setRiskTrendWindow] = useState(3);
  const [retentionReport, setRetentionReport] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const retention = await apiRequest('/api/settings/retention');
      setRetentionEnabled(Boolean(retention.enabled));
      setRetentionDays(retention.retentionDays || 365);

      const risk = await apiRequest('/api/settings/risk-thresholds');
      setRiskAlertAt(risk.alertAt || 'high');
      setRiskTrendWindow(risk.trendWindow || 3);
    };
    loadSettings().catch(() => undefined);
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await apiRequest('/api/settings/retention', {
        method: 'PUT',
        body: JSON.stringify({ enabled: retentionEnabled, retentionDays }),
        headers: { 'Content-Type': 'application/json' }
      });
      await apiRequest('/api/settings/risk-thresholds', {
        method: 'PUT',
        body: JSON.stringify({ alertAt: riskAlertAt, trendWindow: riskTrendWindow }),
        headers: { 'Content-Type': 'application/json' }
      });
    } finally {
      setSaving(false);
    }
  };

  const runRetentionReport = async () => {
    const report = await apiRequest(`/api/settings/retention/report?retentionDays=${retentionDays}`);
    setRetentionReport(report);
  };

  const applyRetention = async () => {
    const result = await apiRequest('/api/settings/retention/apply', {
      method: 'POST',
      body: JSON.stringify({ retentionDays }),
      headers: { 'Content-Type': 'application/json' }
    });
    setRetentionReport(result);
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-evergreen">Data & Risk Settings</h1>
        <p className="text-muted-foreground mt-1">Configure retention policies and risk alert thresholds.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Retention Policy</CardTitle>
          <CardDescription>Control how long system logs and extracted text versions are kept.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={retentionEnabled}
              onChange={(event) => setRetentionEnabled(event.target.checked)}
            />
            Enable retention policy
          </label>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <Input
              type="number"
              value={retentionDays}
              onChange={(event) => setRetentionDays(Number(event.target.value))}
              className="md:w-48"
            />
            <span className="text-sm text-muted-foreground">days</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={runRetentionReport}>
              Preview Retention Impact
            </Button>
            <Button variant="outline" onClick={applyRetention} disabled={!retentionEnabled}>
              Apply Retention Cleanup
            </Button>
          </div>
          {retentionReport && (
            <div className="text-sm text-muted-foreground space-y-1">
              <div>Audit logs: {retentionReport.auditLogs ?? retentionReport.auditDeleted}</div>
              <div>Job runs: {retentionReport.jobRuns ?? retentionReport.jobsDeleted}</div>
              <div>Document text versions: {retentionReport.documentTextVersions ?? retentionReport.versionsDeleted}</div>
              <Badge variant="outline">Cutoff: {new Date(retentionReport.cutoffDate).toLocaleDateString()}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Risk Thresholds</CardTitle>
          <CardDescription>Define when risk alerts should trigger.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <Select value={riskAlertAt} onValueChange={setRiskAlertAt}>
              <SelectTrigger className="md:w-48">
                <SelectValue placeholder="Alert at..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              value={riskTrendWindow}
              onChange={(event) => setRiskTrendWindow(Number(event.target.value))}
              className="md:w-32"
            />
            <span className="text-sm text-muted-foreground">notes window</span>
          </div>
          <Button onClick={saveSettings} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
