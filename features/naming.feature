Feature: Developed files never overwrite each other

  Saving a name that is already taken in the batch must produce a new file,
  never a replacement.

  Scenario: A repeated name gets a numbered copy
    When the photographer saves two developed files called "holiday.jpg"
    Then the first file is saved as "holiday.jpg"
    And the second file is saved as "holiday (2).jpg"

  Scenario: Strip files continue to the next free number
    When the photographer saves two developed files called "strip_001.jpg"
    Then the first file is saved as "strip_001.jpg"
    And the second file is saved as "strip_002.jpg"

  Scenario: Strip numbering keeps its zero padding at the rollover
    When the photographer saves two developed files called "strip_009.jpg"
    Then the second file is saved as "strip_010.jpg"
