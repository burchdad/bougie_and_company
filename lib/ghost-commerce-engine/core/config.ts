export type CommerceEngineConfig = {
  enabled: boolean;
  checkoutEnabled: boolean;
  useFixture: boolean;
  runtime: "development" | "preview" | "production" | string;
};

export function createCommerceEngineConfig(env: NodeJS.ProcessEnv = process.env): CommerceEngineConfig {
  const runtime = env.VERCEL_ENV || env.NODE_ENV || "development";

  return {
    enabled: env.DROPSHIPPING_ENABLED === "true",
    checkoutEnabled: env.DROPSHIPPING_ENABLED === "true" && env.DROPSHIPPING_CHECKOUT_ENABLED === "true",
    useFixture: env.DROPSHIPPING_USE_FIXTURE === "true" && runtime !== "production",
    runtime
  };
}

