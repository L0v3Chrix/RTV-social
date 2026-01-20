// Global type declarations for RTV Social Automation Platform

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    DATABASE_URL?: string;
    REDIS_URL?: string;
    // GHL Integration
    GHL_API_KEY?: string;
    GHL_LOCATION_ID?: string;
    // OpenAI
    OPENAI_API_KEY?: string;
    // Social Platform Keys (BYOK)
    META_ACCESS_TOKEN?: string;
    TIKTOK_ACCESS_TOKEN?: string;
    LINKEDIN_ACCESS_TOKEN?: string;
    TWITTER_ACCESS_TOKEN?: string;
  }
}

// Ensure this file is treated as a module
export {};
