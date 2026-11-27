Feature: The house film pack

  Eight more built-in stocks, tuned in the spirit of classic film
  simulations under house names. Each applies a look that differs
  measurably from Clean Scan and carries its own signature, and films
  saved from them keep every key the look grows.

  Background:
    Given the darkroom is open

  Scenario: The stocks list carries the house pack
    Then the stocks list shows the house stocks

  Scenario Outline: Every house stock carries its signature on a colourful shot
    Given the photographer loaded a palette shot
    And the photographer outputs PNG files
    When the photographer develops the current shot with the "natural" stock
    And the developed palette probes are remembered
    When the photographer develops the current shot with the "<stock>" stock
    Then the develop differs from Clean Scan with the signature "<signature>"

    Examples:
      | stock     | signature      |
      | chrome    | faithful-slide |
      | silk      | soft-portrait  |
      | velvet    | vivid          |
      | archive   | muted-doc      |
      | seventies | blue-shadows   |
      | amber     | warm-shadows   |
      | cineflat  | flat-cine      |
      | micro     | red-mono       |

  Scenario: Films saved from the house stocks carry their halation
    Given the photographer loaded a palette shot
    When the photographer develops the current shot with the "cineflat" stock
    And the photographer exports the film
    Then the exported film carries halation 45
