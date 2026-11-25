Feature: Film studio

  A look becomes a film: a schema v1 JSON that can be exported, shared and
  imported back. Nothing imports until it validates against the slider
  ranges and the format lists.

  Background:
    Given the darkroom is open

  Scenario: Exporting the active look produces schema v1 JSON that re-imports exactly
    Given the photographer loaded a roll with "lake.jpg"
    And the photographer chose the "disposable" stock and pushed the exposure slider to 35
    When the photographer exports the film
    Then the download is a schema v1 film named for the active stock
    And re-importing that film re-applies the exact look

  Scenario: A film JSON file imports and applies
    Given the photographer loaded a roll with "lake.jpg"
    When the photographer imports the film file "koda.json"
    Then the imported look applies with exposure 25

  Scenario: An unknown schema version refuses to import
    When the photographer pastes a film with schema 2
    Then the import refuses with a message about the schema version
    And the darkroom look is unchanged

  Scenario: An out-of-range slider value refuses to import
    Given the photographer loaded a roll with "lake.jpg"
    When the photographer pastes a film with exposure 500
    Then the import refuses with a message about the range

  Scenario: A non-hex split-tone colour refuses to import
    Given the photographer loaded a roll with "lake.jpg"
    When the photographer pastes a film with a shadow colour of "orange"
    Then the import refuses with a message about the colour
