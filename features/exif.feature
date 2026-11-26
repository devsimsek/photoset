Feature: Keeping EXIF in JPG results

  Developing re-encodes through a canvas, which strips EXIF. A Keep EXIF
  toggle (default off) writes the capture date back into JPG results as a
  minimal EXIF APP1 segment. WebP and PNG skip EXIF.

  The source JPG's camera story rides along when the file carries it: camera,
  model, lens, ISO, exposure and aperture. GPS coordinates are a separate,
  explicit toggle (also default off) and never ship without it. Fields the
  source lacks are skipped, not faked.

  Scenario: Keep EXIF off leaves no EXIF in the result
    Given the photographer loaded a roll with "lake.jpg"
    When the photographer develops the current shot
    Then the result JPG carries no EXIF

  Scenario: Keep EXIF on writes the capture date back
    Given the photographer loaded a shot "lake.jpg" taken 2019-07-14
    And the photographer turns Keep EXIF on
    When the photographer develops the current shot
    Then the result JPG's capture date reads 2019-07-14

  Scenario: Keep EXIF on carries the camera's story
    Given the photographer loaded a shot "lake.jpg" shot on a "OM SYSTEM" "OM-1" with a "OM SYSTEM" "25mm F1.8" lens at ISO 200, 1/250 s and f/2.8
    And the photographer turns Keep EXIF on
    When the photographer develops the current shot
    Then the result JPG carries camera "OM SYSTEM" and model "OM-1"
    And the result JPG carries the lens "OM SYSTEM" "25mm F1.8"
    And the result JPG carries ISO 200, exposure 1/250 and f-number 2.8

  Scenario: Fields the source lacks are skipped, not faked
    Given the photographer loaded a shot "lake.jpg" taken 2019-07-14
    And the photographer turns Keep EXIF on
    When the photographer develops the current shot
    Then the result JPG's capture date reads 2019-07-14
    And the result JPG carries no camera information

  Scenario: GPS coordinates never ship without the explicit toggle
    Given the photographer loaded a shot "lake.jpg" taken 2019-07-14 carrying GPS 47.6425 north 9.2917 east
    And the photographer turns Keep EXIF on
    When the photographer develops the current shot
    Then the result JPG's capture date reads 2019-07-14
    And the result JPG carries no GPS coordinates

  Scenario: Turning GPS coordinates on writes them faithfully
    Given the photographer loaded a shot "lake.jpg" taken 2019-07-14 carrying GPS 47.6425 north 9.2917 east
    And the photographer turns Keep EXIF on
    And the photographer turns the GPS coordinates toggle on
    When the photographer develops the current shot
    Then the result JPG carries GPS 47.6425 north 9.2917 east
