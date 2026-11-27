Feature: The stage bar and the first-run hint

  The stage bar keeps the prev / frame / next navigation on one inline line at
  every width; the mode buttons may drop to a controlled second row on phones
  but never push the navigation apart. A first visit gets a one-line hint on
  the empty state, and it never returns once a roll has been loaded.

  Background:
    Given the darkroom is open

  Scenario: The navigation stays inline on a desktop window
    Given the photographer loaded a roll with "lake.jpg"
    When the window is 1440 wide
    Then prevBtn and nextBtn sit on one line with a bounded gap
    And every stage bar control stays inside the bar

  Scenario: Crop mode never crushes the navigation on a phone
    Given the photographer loaded a roll with "lake.jpg"
    When the window is 375 wide and crop mode is on
    Then prevBtn and nextBtn sit on one line with a bounded gap
    And the frame info keeps at least 120 px
    And every stage bar control stays inside the bar

  Scenario: A first visit shows the hint once
    Then the empty state carries the one-line privacy hint
    Given the photographer loaded a roll with "lake.jpg"
    When the photographer reloads the darkroom
    Then the hint never comes back

  Scenario: The film dialog reads clean on a phone
    Given the photographer loaded a roll with "lake.jpg"
    And the photographer saved the current look as film "KODA 64" iso "64"
    When the phone is 375 wide and the film dialog is open
    Then the QR sits beside the copy link with sane spacing
    And the dialog rows align
