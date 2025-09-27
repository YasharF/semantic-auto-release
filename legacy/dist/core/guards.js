"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertNoRace = assertNoRace;
const errors_1 = require("../types/errors");
function assertNoRace(_baseSha, _currentSha) {
  if (_baseSha !== _currentSha) {
    throw new errors_1.RaceConditionError(
      "Default branch advanced after calculation",
    );
  }
}
