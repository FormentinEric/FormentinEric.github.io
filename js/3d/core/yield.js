// Lets the browser breathe between heavy setup steps (keeps every main-thread task short).
// Set globalThis.__yieldLog = [] in the console to record step boundaries (debug).
export const nextTask = () => {
    globalThis.__yieldLog?.push(performance.now());
    return new Promise((resolve) => setTimeout(resolve, 0));
};
