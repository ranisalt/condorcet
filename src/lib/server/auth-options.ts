import type { BetterAuthOptions } from "better-auth";

export type AuthConfig = {
  origin: string;
  secret: string;
  googleClientId: string;
  googleClientSecret: string;
};

export function buildAuthOptions(config: AuthConfig) {
  const omitProfile = async () => ({ data: { name: "", image: null } });
  // Google is used only for identity; its tokens (including profile-bearing JWTs) are not needed.
  const omitProviderTokens = async () => ({
    data: { accessToken: null, refreshToken: null, idToken: null },
  });

  const options = {
    baseURL: config.origin,
    secret: config.secret,
    socialProviders: {
      google: {
        clientId: config.googleClientId,
        clientSecret: config.googleClientSecret,
      },
    },
    emailAndPassword: { enabled: false },
    account: { accountLinking: { enabled: false } },
    trustedOrigins: [config.origin],
    rateLimit: { enabled: true, storage: "database", window: 60, max: 60 },
    databaseHooks: {
      user: {
        create: { before: omitProfile },
        update: { before: omitProfile },
      },
      account: {
        create: { before: omitProviderTokens },
        update: { before: omitProviderTokens },
      },
    },
  } satisfies BetterAuthOptions;

  return options;
}
