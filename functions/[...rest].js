// Catch-all route. On Spacefast a [...rest] module outranks the exact function routes, so it
// must hand those paths to their own modules (see _router.js) and only 404 the rest.
// Static files and _redirects rewrites are still answered before any function runs.
import { route } from "./_router.js";

export const GET = route;
export const HEAD = route;
export const POST = route;
export const PUT = route;
export const PATCH = route;
export const DELETE = route;
export const OPTIONS = route;
