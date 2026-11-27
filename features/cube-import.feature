Feature: .cube files import as films

  A .cube LUT file parses on the device into a schema v2 film: the table
  becomes the film's lut, the look sliders stay neutral, and the TITLE (or the
  file name) names the film. A 17-point identity lattice develops byte for
  byte like no LUT at all, so the import ordering and the interpolation are
  pinned in one go.

  Background:
    Given the darkroom is open

  Scenario: A 17-point identity cube develops exactly like no LUT
    Given the photographer loaded a roll with "lake.jpg"
    When the photographer develops the current shot
    Then the developed bytes are remembered
    And the photographer imports the generated "identity" cube titled "Identity"
    Then the stocks list shows "Identity" as a custom film
    And the photographer develops the current shot again
    Then the developed bytes match the remembered develop

  Scenario: A tint cube shifts colours per its table
    Given the photographer loaded a shot filled "rgb(0, 0, 128)"
    And the photographer outputs PNG files
    And the photographer imports the generated "blue lift" cube
    When the photographer develops the current shot
    Then the developed blue channel reads about 192
    And the developed red channel stays near the source

  Scenario: The cube's TITLE names the film
    When the photographer imports the generated "identity" cube titled "Studio Tint"
    Then the stocks list shows "Studio Tint" as a custom film

  Scenario: A 1D cube file refuses
    When the photographer imports the generated "1d" cube
    Then the import refuses naming the 1D cut

  Scenario: A cube smaller than 17 points refuses naming the range
    When the photographer imports the generated "size-16" cube
    Then the import refuses naming the LUT size range

  Scenario: A cube larger than 65 points refuses naming the range
    When the photographer imports the generated "size-66" cube
    Then the import refuses naming the LUT size range

  Scenario: A non-default input domain refuses
    When the photographer imports the generated "log-domain" cube
    Then the import refuses naming the non-default domain

  Scenario: A short table refuses naming expected and found rows
    When the photographer imports the generated "short" cube
    Then the import refuses naming the expected and found row counts

  Scenario: A non-finite value refuses
    When the photographer imports the generated "nan" cube
    Then the import refuses naming the non-finite value
