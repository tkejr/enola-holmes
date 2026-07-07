import * as Sentry from '@sentry/react-native';
import type { PostHog } from 'posthog-react-native';
import { identifyUser } from './revenuecat';

// One place that ties a user to every system we track them in: RevenueCat
// (purchases), PostHog (analytics), and Sentry (errors). The Supabase auth
// user id is our unique identity — no login UX, but the anonymous device
// account gives every user a stable uid that keys profiles/searches/coins.
// Call this the instant we have a userId (signup) AND on every launch with a
// restored session, so errors are never <anonymous>.
export async function identify(userId: string, posthog: PostHog) {
  await identifyUser(userId);
  posthog.identify(userId);
  Sentry.setUser({ id: userId });
}
