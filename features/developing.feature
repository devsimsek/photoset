Feature: Developing photos

  Developing turns a shot on the roll into a finished JPEG.
  A batch run produces one result for every shot in the run.

  Scenario: A developed shot comes out as a JPEG
    Given the photographer loaded a roll with "lake.jpg"
    When the photographer develops the current shot
    Then one result is produced as a JPEG

  Scenario: Developing the whole roll produces a result for every shot
    Given the photographer loaded a roll with "lake.jpg", "dock.jpg" and "forest.jpg"
    When the photographer develops the whole roll
    Then three results are produced
    And every result is a developed JPEG
