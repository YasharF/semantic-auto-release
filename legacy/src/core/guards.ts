import { RaceConditionError } from "../types/errors";
export function assertNoRace(_baseSha: string, _currentSha: string) {
  if (_baseSha !== _currentSha) {
    throw new RaceConditionError("Default branch advanced after calculation");
  }
}
