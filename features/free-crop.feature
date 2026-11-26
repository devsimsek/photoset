Feature: Free crop on the preview

  The preview offers a crop mode: drag a rectangle on the frame and the
  develop uses exactly that region. Without a crop the develop keeps the
  centered frame as before. The crop is per shot, lives with the roll
  metadata so it survives a reload and re-attaches on relink, and clears
  with the roll. Coordinates are fractions of the rotated frame, so the
  rotation composes: the crop is measured on what the quarter turn produced,
  and any aspect crop then centers inside the freed region.

  Background:
    Given the darkroom is open

  Scenario: A dragged crop develops to exactly the dragged region
    Given the photographer loaded a split shot "split.jpg"
    When the photographer enters crop mode
    And the photographer drags a crop over the left half of the preview
    And the photographer develops the current shot
    Then the result is 80 wide by 80 tall
    And the result shows red at the top and red at the bottom

  Scenario: Without a crop the develop keeps the centered frame
    Given the photographer loaded a busy roll with "lake.jpg"
    And the photographer sets the crop to 3:2
    When the photographer develops the current shot
    Then the result is 256 wide by 171 tall

  Scenario: The crop survives a reload and re-attaches on relink
    Given the photographer loaded a split roll "trip" with "split.jpg"
    And the photographer enters crop mode
    And the photographer drags a crop over the left half of the preview
    When the darkroom is reopened
    And the photographer re-picks the split shot "split.jpg" in folder "trip"
    And the photographer develops the current shot
    Then the result is 80 wide by 80 tall
    And the result shows red at the top and red at the bottom

  Scenario: The crop composes with the rotation in the rotated frame
    Given the photographer loaded a split shot "split.jpg"
    And the photographer sets the rotation to 90 degrees
    When the photographer enters crop mode
    And the photographer drags a crop over the top half of the preview
    And the photographer develops the current shot
    Then the result is 80 wide by 80 tall
    And the result shows red at the left and red at the right

  Scenario: The reset control clears the crop
    Given the photographer loaded a split shot "split.jpg"
    And the photographer enters crop mode
    And the photographer drags a crop over the left half of the preview
    And the photographer resets the crop
    When the photographer develops the current shot
    Then the result is 160 wide by 80 tall
    And the result shows red at the left and blue at the right

  Scenario: A fresh roll starts with no crops
    Given the photographer loaded a split shot "split.jpg"
    And the photographer enters crop mode
    And the photographer drags a crop over the left half of the preview
    When the photographer loads a different roll
    Then no shot carries a crop
