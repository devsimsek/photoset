Feature: Saving results in a browser without folder saving

  This browser has no folder-saving support, so results are handed to the
  photographer as downloads: a single shot as one JPG, a batch as one zip.

  Scenario: A single developed shot downloads as one JPG
    Given the photographer loaded a roll "test-roll" with "lake.jpg"
    When the photographer develops the current shot
    Then the result "lake.jpg" downloads as a JPG

  Scenario: A batch of developed shots downloads as one zip named for the roll
    Given the photographer loaded a roll "test-roll" with "lake.jpg" and "dock.jpg"
    When the photographer develops the whole roll
    Then the results download as one file named "test-roll-developed.zip"
    And the zip holds "lake.jpg" and "dock.jpg"
