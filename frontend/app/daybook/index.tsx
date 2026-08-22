import { Redirect } from 'expo-router';

export default function DaybookRedirect() {
  return <Redirect href="/reports/audit-trail?tab=daybook" />;
}
