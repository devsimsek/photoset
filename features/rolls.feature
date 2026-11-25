Feature: Rolls are remembered without pixels

  The darkroom remembers what a roll was: its name, its shots, the picks.
  Pixels never persist; only a tiny metadata entry does. A reload shows the
  roll remembered by name until the folder is re-picked.

  Scenario: Loading a roll remembers its shots
    When the photographer loads a folder containing "lake.jpg", "dock.jpg" and "forest.jpg"
    Then the roll remembers "lake.jpg", "dock.jpg" and "forest.jpg"
    And the remembered file holds only names, sizes and times

  Scenario: Picks are remembered with the roll
    When the photographer loads a folder containing "lake.jpg", "dock.jpg" and "forest.jpg"
    And the photographer marks "dock.jpg" as picked
    Then the remembered roll lists "dock.jpg" as picked

  Scenario: A reload shows the remembered roll with names but no thumbnails
    Given the photographer loaded a roll "trip" with "lake.jpg", "dock.jpg" and "forest.jpg"
    And the photographer marks "dock.jpg" as picked
    When the darkroom is reopened
    Then the roll still lists "dock.jpg", "forest.jpg" and "lake.jpg" from memory
    And no remembered shot carries pixels
    And the contact sheet marks every shot as remembered
    And the stage asks to re-pick the folder to restore the roll

  Scenario: Pixels never reach storage
    Given the photographer loaded a busy roll with "lake.jpg", "dock.jpg" and "forest.jpg"
    And the photographer marks "dock.jpg" and "forest.jpg" as picked
    Then the roll remembers "lake.jpg", "dock.jpg" and "forest.jpg"
    And storage holds no image data and stays tiny
