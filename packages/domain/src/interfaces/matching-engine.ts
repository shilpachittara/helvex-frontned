import type { FillIntentInput, IntentRecord } from "../types.js";

export interface MatchingEngine {
  listOpenIntents(): Promise<IntentRecord[]>;
  acceptFill(input: FillIntentInput): Promise<IntentRecord>;
}
