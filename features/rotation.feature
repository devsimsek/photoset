Feature: Quarter-turn rotation

  The output panel offers a rotation: a quarter turn applied before the
  aspect crop, so the crop rect computes on the rotated frame. A landscape
  shot turned a quarter develops as a portrait, and a 3:2 crop then frames
  the rotated shot 2:3. The rotation is a look setting: it rides in the film
  JSON as an optional key that defaults to 0, so films written before it
  existed import unchanged and v1 films import forever.

  Background:
    Given the darkroom is open

  Scenario: A quarter turn swaps the output dimensions and rotates the content
    Given the photographer loaded a split shot "split.jpg"
    And the photographer sets the rotation to 90 degrees
    When the photographer develops the current shot
    Then the result is 80 wide by 160 tall
    And the result shows red at the top and blue at the bottom

  Scenario: A landscape shot turned a quarter develops portrait under the 3:2 crop
    Given the photographer loaded a split shot "split.jpg"
    And the photographer sets the crop to 3:2
    And the photographer sets the rotation to 90 degrees
    When the photographer develops the current shot
    Then the result is 80 wide by 120 tall

  Scenario: The rotation persists in the look and re-applies after a reload
    Given the photographer loaded a split shot "split.jpg"
    And the photographer sets the rotation to 90 degrees
    When the photographer reloads the darkroom with a split shot "split.jpg"
    Then the rotation is still 90 degrees
    When the photographer develops the current shot
    Then the result is 80 wide by 160 tall

  Scenario: The rotation travels with an exported film
    Given the photographer loaded a split shot "split.jpg"
    And the photographer chose the "disposable" stock and pushed the exposure slider to 35
    And the photographer sets the rotation to 90 degrees
    When the photographer exports the film
    Then the download is a schema v1 film named for the active stock
    And re-importing that film re-applies the exact look

  Scenario: A film written before the rotation key existed still imports
    Given the photographer loaded a split shot "split.jpg"
    When the photographer pastes a film with no rotate key
    Then the film applies with the rotation at 0
