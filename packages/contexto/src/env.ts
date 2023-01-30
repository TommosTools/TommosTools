export const IS_SSR = (
	typeof window === "undefined"
	|| (window.navigator.userAgent && /ServerSideRendering/.test(window.navigator.userAgent))
);

export const IS_NON_PRODUCTION_ENVIRONMENT = (
	typeof process === "object" && process.env.NODE_ENV !== "production"
);

export const WARN_ABOUT_MISSING_CONTEXT_ID = (
	!IS_SSR && IS_NON_PRODUCTION_ENVIRONMENT
);