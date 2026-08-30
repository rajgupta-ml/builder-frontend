export const SYSTEM_CONFIG = {
    JWT_SECRET: process.env.JWT_SECRET || "default_secret",
    APP_URL: process.env.APP_URL || "http://localhost:3100",
    SURVEY_URL: process.env.SURVEY_URL || "http://localhost:3101",
    INTERNAL_API_SECRET: process.env.INTERNAL_API_SECRET || "internal_secret_key",
};
