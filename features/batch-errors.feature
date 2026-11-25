Feature: Batch errors are listed

  A develop run finishes what it can and reports what it could not:
  every failed shot is named with a reason at the end of the batch,
  instead of the run stopping at the first failure or swallowing it.

  Background:
    Given the darkroom is open

  Scenario: A shot that cannot be decoded fails by name and the batch completes
    Given the photographer loaded a roll where "bad.jpg" is undecodable garbage
    When the photographer develops the whole roll
    Then the toast reports "developed 2, failed 1"
    And the toast names "bad.jpg" with a reason
    And the zip holds "a.jpg", "c.jpg"

  Scenario: A fully successful batch reports no failures
    Given the photographer loaded a roll with "lake.jpg" and "dock.jpg"
    When the photographer develops the whole roll
    Then the toast reports a batch with no failures
