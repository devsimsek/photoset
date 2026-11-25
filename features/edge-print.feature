Feature: Film name on the strip edge print

  Film strips carry an edge print: frame numbers and alternating text. A
  saved custom film puts its name where PHOTOSET 400 prints for built-in
  stocks. The SAFETY FILM alternation and the numbering stay unchanged.

  Background:
    Given the darkroom is open

  Scenario: A saved film puts its name on the strip edge print
    Given the photographer loaded a roll with "lake.jpg"
    And the photographer pushes the contrast slider to 20
    And the photographer saved the current look as film "KODA 64"
    When the photographer develops in strip mode
    Then the strip edge print reads "KODA 64"

  Scenario: Built-in stocks keep the PHOTOSET 400 edge print
    Given the photographer loaded a roll with "lake.jpg"
    When the photographer develops in strip mode with the "disposable" stock
    Then the strip edge print reads "PHOTOSET 400"

  Scenario: A modified built-in stock keeps the default edge print
    Given the photographer loaded a roll with "lake.jpg"
    And the photographer pushes the contrast slider to 20
    When the photographer develops in strip mode
    Then the strip edge print reads "PHOTOSET 400"
