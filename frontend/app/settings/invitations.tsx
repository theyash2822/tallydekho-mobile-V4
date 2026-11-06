import React from 'react';
import { Redirect } from 'expo-router';
import { requestsHref } from '../../src/hooks/usePendingRequests';

/** Invitations now live in Settings → Requests; old links still land on them. */
export default function InvitationsRedirect() {
  return <Redirect href={requestsHref('invitations')} />;
}
