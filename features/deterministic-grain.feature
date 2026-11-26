Feature: Deterministic develops

  The seeded look keyed by each file's name covers every stochastic step.
  Developing the same shot twice with the same film produces byte for byte
  the same result, and two shots that differ only by name still grain
  differently.

  Scenario: The same shot develops byte for byte with grain on
    Given the photographer loaded a roll with "lake.jpg"
    And the photographer pushes the grain slider to 55
    When the photographer develops the current shot
    Then the developed bytes are remembered
    And the photographer develops the current shot again
    Then the developed bytes match the remembered develop

  Scenario: Grain varies per shot by file name
    Given the photographer loaded shots "a.jpg" and "b.jpg" with identical pixels
    And the photographer pushes the grain slider to 55
    When the photographer develops the current shot
    Then the developed bytes are remembered
    And the photographer develops the next shot
    Then the developed bytes differ from the remembered develop
