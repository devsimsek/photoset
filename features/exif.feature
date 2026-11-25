Feature: Keeping EXIF in JPG results

  Developing re-encodes through a canvas, which strips EXIF. A Keep EXIF
  toggle (default off) writes the capture date back into JPG results as a
  minimal EXIF APP1 segment. WebP and PNG skip EXIF.

  Scenario: Keep EXIF off leaves no EXIF in the result
    Given the photographer loaded a roll with "lake.jpg"
    When the photographer develops the current shot
    Then the result JPG carries no EXIF

  Scenario: Keep EXIF on writes the capture date back
    Given the photographer loaded a shot "lake.jpg" taken 2019-07-14
    And the photographer turns Keep EXIF on
    When the photographer develops the current shot
    Then the result JPG's capture date reads 2019-07-14
