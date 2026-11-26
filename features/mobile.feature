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

  # --- PS-31: the intake survives a whole phone's folder ---

  Scenario: A very large roll renders lazily
    When the photographer loads a roll of 300 phone shots
    Then only a bounded batch of contact sheet tiles exists before any scrolling
    When the photographer walks to "shot_065.jpg" with the keyboard
    Then the selection is on "shot_065.jpg"
    When the photographer scrolls the contact sheet to the end
    Then tiles have appeared for the shots further down the roll
    When the photographer taps the last tile on the contact sheet
    Then the selection is on "shot_300.jpg"
    When the photographer presses Enter
    Then the result "shot_300.jpg" downloads as a JPG

  Scenario: A progress line shows while a big roll loads
    When the photographer loads a roll of 300 phone shots
    Then a progress line with a count shows while the roll is being prepared
    And the progress line advances while the roll is being prepared
    And the progress line is gone once the roll is ready

  Scenario: An unreadable shot surfaces by name instead of silence
    When the photographer loads "good.jpg" and "broken.jpg" where "broken.jpg" is unreadable
    Then a toast names "broken.jpg" as unreadable
    And "broken.jpg" stays listed with its name and size
    When the photographer develops the whole roll
    Then the toast reports "developed 1, failed 1"
    And the result "good.jpg" downloads as a JPG

  Scenario: A whole phone's folder is read in chunks so the sheet paints early
    When the photographer drops a folder of 300 phone shots
    Then the folder is read in chunks of at most 64 shots with rising counts
    And the contact sheet already shows tiles while the folder is still being prepared
