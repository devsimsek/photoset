Feature: The stocks list keeps its colour swatches

  Every stock button carries its two-colour swatch (the film's own look), and
  loading a roll never turns the list into live previews. The owner reverted
  the PS-54 thumbnails: the button is the film's identity, not a preview.

  Background:
    Given the darkroom is open
    And the photographer loaded a palette shot

  Scenario: Loading a roll does not turn stock buttons into previews
    Then no stock button carries a preview canvas

  Scenario: Every stock keeps its swatch
    Then every stock button keeps its two-colour swatch
