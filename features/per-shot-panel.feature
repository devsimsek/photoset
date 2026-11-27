Feature: The panel follows the selected shot

  The panel is the selected shot's darkroom bench: on every selection change
  the sliders, the selects and the stock label show that shot's effective
  look. APPLY TO ALL is the roll-wide act: it copies the shot in view's look
  onto every shot and clears their overrides, so the roll shares one base
  look again. The per-shot reset clears the shot in view's override, and a
  remembered roll shows the base look and refuses edits with a named toast.

  Background:
    Given the darkroom is open

  Scenario: The panel shows each shot's own look on selection
    Given the photographer loaded a roll of split shots "shot_01.jpg" and "shot_02.jpg"
    When the photographer pushes the contrast slider to 30
    Then the contrast slider reads 30
    When the photographer selects "shot_02.jpg"
    Then the contrast slider reads 0
    When the photographer selects "shot_01.jpg"
    Then the contrast slider reads 30

  Scenario: Apply to all gives every shot the displayed look
    Given the photographer loaded a roll with "lake.jpg" and "dock.jpg"
    When the photographer pushes the contrast slider to 30
    And the photographer applies the look to every shot
    And the photographer develops the whole roll
    Then two results are produced
    And the results are byte-identical
    And no shot carries a look override

  Scenario: A per-shot reset returns the shot to its base
    Given the photographer loaded a roll of split shots "shot_01.jpg"
    And the photographer sets the rotation to 90 degrees
    And the photographer pushes the contrast slider to 30
    When the photographer resets the look
    Then no shot carries a look override
    And the photographer develops the current shot
    And the result is 160 wide by 80 tall

  Scenario: The panel refuses edits on a remembered shot
    Given a remembered roll "trip" whose shots "shot_01.jpg" reached "strip_002"
    When the photographer selects "shot_01.jpg"
    Then the contrast slider reads 0
    When the photographer pushes the contrast slider to 30
    Then a toast names the shot as a placeholder needing a re-pick
    And the contrast slider reads 0
    And the apply-to-all control sits out with a reason
