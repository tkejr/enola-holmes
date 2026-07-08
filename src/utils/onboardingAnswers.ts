// Onboarding questions are answered before the account exists (created at the
// end, in welcome.tsx). Hold the selections in this module-level object until
// then; welcome.tsx flushes them onto the new profile as JSON.
// ponytail: in-memory only — fine because it's one continuous session; add
// AsyncStorage if onboarding ever needs to survive an app restart.
export const onboardingAnswers: {
  howFound?: string;
  beneficialResults?: string[];
} = {};
