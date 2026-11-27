Feature: Stock previews

  Every stock button carries a live thumbnail of the current shot developed
  through that stock, built off the click path so selection never waits.
  With no shot loaded the buttons keep their two-colour swatch look.

  Background:
    Given the darkroom is open

  Scenario: Loading a roll gives every stock its own thumbnail
    Given the photographer loaded a palette shot
    Then every stock button shows a preview canvas
    And the stock previews differ from each other

  Scenario: A stock preview matches the develop pipeline at thumbnail scale
    Given the photographer loaded a palette shot
    When the photographer chose the "velvet" stock
    Then the active stock's preview matches a thumbnail-size develop

  Scenario: With no roll there are no previews and no errors
    Then no stock button carries a preview canvas
