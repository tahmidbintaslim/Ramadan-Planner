import { createStart } from "@tanstack/react-start";

// Empty for now. Task 3 adds the server-function-scoped CSRF middleware and Clerk here:
// once this file exists, Start no longer adds its default CSRF check.
export const startInstance = createStart(() => ({}));
