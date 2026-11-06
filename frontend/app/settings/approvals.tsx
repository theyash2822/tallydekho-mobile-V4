import React from 'react';
import { Redirect } from 'expo-router';
import { requestsHref } from '../../src/hooks/usePendingRequests';

/** Approvals now live in Settings → Requests; old links and notifications still land on them. */
export default function ApprovalsRedirect() {
  return <Redirect href={requestsHref('approvals')} />;
}
