import { hasStashedDraft } from "../pages/draft-stash";

export function afterAuthPath(): "/write" | "/writing" {
  return hasStashedDraft() ? "/write" : "/writing";
}
