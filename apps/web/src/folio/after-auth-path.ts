import { hasStashedDraft } from "../pages/draft-stash";

export function afterAuthPath(): "/write" | "/practice" {
  return hasStashedDraft() ? "/write" : "/practice";
}
