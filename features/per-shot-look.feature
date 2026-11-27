Feature: Every shot carries its own look

  Edits land on the selected shot. A shot's effective look is its own
  override over the base look of its stock; shots without an override keep
  the roll's base look. Every render path honours it: the single develop,
  the batch, the strips and the contact sheet each develop every shot with
  its own look, and an override survives a reload and relink by name.

  Background:
    Given the darkroom is open

  Scenario: Rotating shot 2 by 90 leaves shots 1 and 3 unrotated
    Given the photographer loaded a roll of split shots "shot_01.jpg", "shot_02.jpg" and "shot_03.jpg"
    When the photographer selects "shot_02.jpg"
    And the photographer sets the rotation to 90 degrees
    And the photographer develops the current shot
    Then the result is 80 wide by 160 tall
    When the photographer selects "shot_01.jpg"
    And the photographer develops the current shot
    Then the result is 160 wide by 80 tall
    When the photographer selects "shot_03.jpg"
    And the photographer develops the current shot
    Then the result is 160 wide by 80 tall

  Scenario: A slider push on shot 2 changes shot 2 and leaves shot 1 byte-identical
    Given the photographer loaded a roll of split shots "shot_01.jpg" and "shot_02.jpg"
    When the photographer develops the current shot
    Then the developed bytes are remembered for "shot_01.jpg"
    When the photographer selects "shot_02.jpg"
    And the photographer pushes the contrast slider to 40
    And the photographer develops the current shot
    Then the developed bytes are remembered for "shot_02.jpg"
    When the photographer selects "shot_01.jpg"
    And the photographer develops the current shot
    Then the developed bytes of "shot_01.jpg" match the remembered develop
    And the remembered develops of "shot_01.jpg" and "shot_02.jpg" differ

  Scenario: A batch develops each shot with its own look
    Given the photographer loaded a roll of split shots "shot_01.jpg", "shot_02.jpg" and "shot_03.jpg"
    When the photographer selects "shot_02.jpg"
    And the photographer sets the rotation to 90 degrees
    And the photographer develops the whole roll
    Then three results are produced
    And the first result is 160 wide by 80 tall
    And the second result is 80 wide by 160 tall
    And the third result is 160 wide by 80 tall

  Scenario: A per-shot look survives a reload and relink
    Given the photographer loaded a roll of split shots "shot_01.jpg" and "shot_02.jpg" in roll "trip"
    When the photographer selects "shot_02.jpg"
    And the photographer sets the rotation to 90 degrees
    And the photographer develops the current shot
    Then the result is 80 wide by 160 tall
    When the darkroom is reopened
    And the photographer re-picks the split shots "shot_01.jpg" and "shot_02.jpg" in folder "trip"
    And the photographer develops the current shot
    Then the result is 160 wide by 80 tall
    When the photographer selects "shot_02.jpg"
    And the photographer develops the current shot
    Then the result is 80 wide by 160 tall
