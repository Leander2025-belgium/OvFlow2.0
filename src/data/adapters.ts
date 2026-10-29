import { irail } from "./irail";
import { delijn } from "./delijn";
import type { Operator } from "./types";
export function adapterFor(operator: Operator) {
  if (operator === "delijn") return delijn;
  if (operator === "nmbs") return irail;
  throw new Error("Deze vervoerder is nog niet aangesloten.");
}
export function operatorForTrip(id: string): Operator {
  return id.startsWith("delijn:") ? "delijn" : "nmbs";
}
