Feature: Film-shaped colour

  Contrast is a smooth S-curve: highlights roll off a shoulder instead of
  slamming to white, shadows settle, and at zero contrast the develop is the
  identity. An optional halation key glows red-orange around the frame's
  bright regions, content-aware: a dark frame barely glows. Grain layers per
  emulsion channel and thins out in the deep shadows and highlights. The
  seeded reproducibility law holds through all of it.

  Background:
    Given the darkroom is open

  Scenario Outline: A zero look keeps the tones where they are
    Given the photographer loaded a shot filled "<tone>"
    And the photographer outputs PNG files
    When the photographer develops the current shot
    Then the developed pixel reads <lo> to <hi> on every channel

    Examples:
      | tone               | lo  | hi  |
      | rgb(128, 128, 128) | 124 | 132 |
      | rgb(8, 8, 8)       | 0   | 12  |
      | rgb(242, 242, 242) | 236 | 248 |

  Scenario: High contrast rolls highlights off instead of slamming them
    Given the photographer loaded a shot filled "rgb(242, 242, 242)"
    And the photographer outputs PNG files
    And the photographer pushes the contrast slider to 60
    When the photographer develops the current shot
    Then the developed pixel reads 235 to 253 on every channel

  Scenario: Halation glows red-orange around a bright light
    Given the photographer loaded a shot with a bright disk on dark ground
    And the photographer outputs PNG files
    And the photographer imported the film "Halo 45" with halation 45 as a file
    When the photographer develops the current shot
    Then the rim of the disk glows red-orange
    And the dark corner stays dark

  Scenario: Halation is nothing at zero and content-aware without it
    Given the photographer loaded a shot with a bright disk on dark ground
    And the photographer outputs PNG files
    And the photographer imported the film "No Halo" without halation as a file
    When the photographer develops the current shot
    Then the developed rim stays untouched
    And the developed bytes are remembered
    When the photographer imports the film "Halo Zero" with halation 0 as a file
    And the photographer develops the current shot again
    Then the developed bytes match the remembered develop
