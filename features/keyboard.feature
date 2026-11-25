Feature: Keyboard navigation

  The roll is drivable without a pointer: the arrows and j/k walk the
  shots, Enter develops the shot in view, Escape closes the film dialog,
  and typing in any field never moves the selection.

  Background:
    Given the darkroom is open
    And the photographer loaded a roll with "shot_01.jpg", "shot_02.jpg" and "shot_03.jpg"

  Scenario: The arrow keys walk the roll
    When the photographer presses the right arrow
    Then the selection is on "shot_02.jpg"
    When the photographer presses the left arrow
    Then the selection is on "shot_01.jpg"
    When the photographer presses the down arrow
    Then the selection is on "shot_02.jpg"
    When the photographer presses the up arrow
    Then the selection is on "shot_01.jpg"

  Scenario: j and k walk the roll
    When the photographer presses j
    Then the selection is on "shot_02.jpg"
    When the photographer presses k
    Then the selection is on "shot_01.jpg"

  Scenario: Typing in the film name never moves the selection
    When the photographer opens the film dialog and types "j" into the film name
    Then the selection is still on "shot_01.jpg"

  Scenario: Typing in the film JSON paste area never moves the selection
    When the photographer opens the import dialog and types "j" into the film JSON
    Then the selection is still on "shot_01.jpg"

  Scenario: Typing in the size cap field never moves the selection
    When the photographer types "j" into the size cap field
    Then the selection is still on "shot_01.jpg"

  Scenario: Escape closes the film dialog
    When the photographer opens the film dialog
    And the photographer presses Escape
    Then the film dialog is closed

  Scenario: Enter develops the shot in view
    When the photographer presses Enter
    Then the result "shot_01.jpg" downloads as a JPG
