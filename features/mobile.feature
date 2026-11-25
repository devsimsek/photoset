Feature: On a phone

  The darkroom works one-handed. At a phone-sized window the whole loop,
  from loading a roll to developing it, fits on the screen, and every
  control a thumb touches offers at least a 44 by 44 point target.

  Background:
    Given the darkroom is open on a 375 by 667 phone screen

  Scenario: The core loop fits the phone screen without horizontal scrolling
    Then the load control, the contact sheet, the develop button and the save control are all on screen
    And nothing overflows the phone screen horizontally

  Scenario: The develop button is a full touch target
    Then the develop button spans at least 44 by 44 points

  Scenario: Sliders, pick circles and form controls are full touch targets
    Given the photographer loaded a roll with "lake.jpg"
    Then the range sliders, the pick circles and the form controls each span at least 44 by 44 points
