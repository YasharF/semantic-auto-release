"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnexpectedError =
  exports.RaceConditionError =
  exports.PermissionError =
  exports.ConfigError =
    void 0;
class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigError";
  }
}
exports.ConfigError = ConfigError;
class PermissionError extends Error {
  constructor(message) {
    super(message);
    this.name = "PermissionError";
  }
}
exports.PermissionError = PermissionError;
class RaceConditionError extends Error {
  constructor(message) {
    super(message);
    this.name = "RaceConditionError";
  }
}
exports.RaceConditionError = RaceConditionError;
class UnexpectedError extends Error {
  constructor(message) {
    super(message);
    this.name = "UnexpectedError";
  }
}
exports.UnexpectedError = UnexpectedError;
