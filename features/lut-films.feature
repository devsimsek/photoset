Feature: Films carry a LUT

  A schema v2 film is a schema v1 film grown at the root: everything v1 accepts,
  plus an optional lut object holding a name, a lattice size and a base64
  table. v1 films import forever, unchanged. A film carrying a LUT is too heavy
  to share by QR or paste: it travels as a downloaded file only.

  Background:
    Given the darkroom is open

  Scenario: A schema v2 film with a LUT imports and re-exports with the table intact
    Given the photographer loaded a roll with "lake.jpg"
    When the photographer imports the LUT film "Cuba 17" with a 17-point identity table as a file
    Then the imported film is schema 2 named "Cuba 17"
    When the photographer exports the film
    Then the downloaded film carries the same 17-point identity table

  Scenario: An imported LUT film lives in the library like any film
    Given the photographer loaded a roll with "lake.jpg"
    And the photographer imported the LUT film "Cuba 17" with a 17-point identity table as a file
    When the photographer reloads the darkroom
    Then the stocks list still shows "Cuba 17" as a custom film
    And the persisted film "cuba-17" holds the 17-point identity table
    When the photographer renames the film to "Cuba 64"
    And the photographer reloads the darkroom
    Then the persisted film "cuba-17" holds name "Cuba 64"
    And the persisted film "cuba-17" holds the 17-point identity table
    When the photographer deletes the film
    And the photographer reloads the darkroom
    Then the stocks list has no custom films

  Scenario: A LUT size below the accepted range refuses naming the range
    When the photographer imports a LUT film whose table size is 16 as a file
    Then the import refuses naming the LUT size range

  Scenario: A truncated LUT table refuses naming the expected length
    When the photographer imports a LUT film with a truncated table as a file
    Then the import refuses with a message naming the expected table length

  Scenario: A LUT film refuses to share by QR
    Given the photographer loaded a roll with "lake.jpg"
    And the photographer imported the LUT film "Cuba 17" with a 17-point identity table as a file
    When the photographer opens the film dialog of the active LUT film
    Then the QR is refused with a message about the LUT sharing cap

  Scenario: A LUT film refuses to import from pasted JSON
    Given the photographer loaded a roll with "lake.jpg"
    When the photographer pastes a LUT film with a 17-point identity table
    Then the import refuses with a message naming the paste cap
    And the darkroom look is unchanged

  Scenario: A look-only schema v2 film shares by QR like a v1 film
    Given the photographer loaded a roll with "lake.jpg"
    When the photographer pastes a film with schema 2 and no lut
    And the photographer opens the film dialog for the QR
    Then the QR is drawn with the module matrix of the share link
