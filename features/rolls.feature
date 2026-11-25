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

  Scenario: Re-picking the same folder restores picks
    Given the photographer loaded a roll "trip" with "dock.jpg", "forest.jpg" and "lake.jpg"
    And the photographer marks "dock.jpg" as picked
    When the darkroom is reopened
    And the photographer re-picks the folder "trip" with "dock.jpg", "forest.jpg" and "lake.jpg"
    Then the roll is back with real pixels
    And "dock.jpg" is still picked

  Scenario: Strip numbering continues from the remembered high-water mark
    Given a remembered roll "trip" whose shots "dock.jpg", "fern.jpg", "lake.jpg", "mist.jpg", "pier.jpg" and "reed.jpg" reached "strip_004"
    When the photographer re-picks the folder "trip" with "dock.jpg", "fern.jpg", "lake.jpg", "mist.jpg", "pier.jpg" and "reed.jpg"
    And the photographer develops the whole roll as strips
    Then the strips are named "strip_005.jpg" and "strip_006.jpg"

  Scenario: A partial folder still relinks the present shots
    Given the photographer loaded a roll "trip" with "dock.jpg", "fern.jpg", "lake.jpg" and "mist.jpg"
    And the photographer marks "fern.jpg" and "mist.jpg" as picked
    When the darkroom is reopened
    And the photographer re-picks the folder "trip" with "dock.jpg" and "mist.jpg"
    Then the roll is back with real pixels
    And "mist.jpg" is still picked

  Scenario: A shot missing from the re-picked folder is flagged, not dropped
    Given the photographer loaded a roll "trip" with "dock.jpg", "fern.jpg", "lake.jpg" and "mist.jpg"
    And the photographer marks "fern.jpg" and "mist.jpg" as picked
    When the darkroom is reopened
    And the photographer re-picks the folder "trip" with "dock.jpg" and "mist.jpg"
    Then "fern.jpg" stays listed with the roll
    And "fern.jpg" is flagged as missing from the folder
    And "fern.jpg" is not picked
    And "mist.jpg" is still picked

  Scenario: The batch skips flagged shots
    Given the photographer loaded a roll "trip" with "dock.jpg", "fern.jpg", "lake.jpg" and "mist.jpg"
    When the darkroom is reopened
    And the photographer re-picks the folder "trip" with "dock.jpg" and "mist.jpg"
    Then "fern.jpg" is flagged as missing from the folder
    When the photographer develops the whole roll
    Then two results are produced
    And every result is a developed JPEG

  Scenario: Re-picking a different folder replaces the remembered roll
    Given the photographer loaded a roll "trip" with "dock.jpg", "fern.jpg", "lake.jpg" and "mist.jpg"
    When the darkroom is reopened
    And the photographer re-picks the folder "trip" with "dock.jpg" and "mist.jpg"
    Then "fern.jpg" is flagged as missing from the folder
    When the photographer re-picks the folder "honeymoon" with "beach.jpg" and "party.jpg"
    Then the roll contains exactly "beach.jpg" and "party.jpg"
    And the remembered roll is now "honeymoon"
    And no shot is flagged as missing
