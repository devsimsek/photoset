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

  Scenario: A saved look becomes a film in the stocks list
    Given the photographer loaded a roll with "lake.jpg"
    And the photographer pushes the contrast slider to 30
    And the photographer saved the current look as film "KODA 64" iso "64"
    Then the stocks list shows "KODA 64" as a custom film

  Scenario: The film library survives a reload
    Given the photographer loaded a roll with "lake.jpg"
    And the photographer saved the current look as film "KODA 64" iso "64"
    When the photographer reloads the darkroom
    Then the stocks list still shows "KODA 64" as a custom film

  Scenario: Renaming a saved film renames it in the list and in storage
    Given the photographer loaded a roll with "lake.jpg"
    And the photographer saved the current look as film "KODA 64" iso "64"
    When the photographer renames the film to "KODA 200"
    Then the stocks list shows "KODA 200" as a custom film
    And the persisted film "koda-64" holds name "KODA 200"

  Scenario: Deleting a saved film removes it for good
    Given the photographer loaded a roll with "lake.jpg"
    And the photographer saved the current look as film "KODA 64" iso "64"
    When the photographer deletes the film
    And the photographer reloads the darkroom
    Then the stocks list has no custom films

  Scenario: Saving over a saved film updates it in place with the same id
    Given the photographer loaded a roll with "lake.jpg"
    And the photographer pushes the contrast slider to 30
    And the photographer saved the current look as film "KODA 64" iso "64"
    And the photographer pushes the contrast slider to 48
    When the photographer saves over the film
    And the photographer reloads the darkroom
    Then the persisted film "koda-64" holds contrast 48

  Scenario: An imported film joins the library
    Given the photographer loaded a roll with "lake.jpg"
    When the photographer pastes a film named "Pasted 64"
    And the photographer reloads the darkroom
    Then the stocks list still shows "Pasted 64" as a custom film

  Scenario: Loading a saved film applies its look to develops
    Given the photographer loaded a roll with "lake.jpg"
    And the photographer pushes the exposure slider to 40
    And the photographer saved the current look as film "KODA 64" iso "64"
    When the photographer develops the current shot
    Then the developed bytes are remembered
    When the photographer reloads the darkroom with a roll of "lake.jpg"
    And the photographer develops the current shot
    Then the developed bytes match the remembered develop
