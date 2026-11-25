// Scenario-local handoff between steps. A scenario runs alone inside its
// worker, and every producing step resets what it owns before filling it.
export const results = {
  downloads: [], // Playwright Download objects from the latest develop run
  names: [],     // names returned by api.writeFile in the naming scenarios
  capKB: 0,      // the size cap the current scenario set, in KB
  film: {},      // film studio handoff: export download, parsed JSON, stashed look
};
