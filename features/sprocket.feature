Feature: Sprocket-panorama mode

  The sprocket frame mode exposes the film's sprocket holes in the picture:
  the panorama spans the full film width, and the hole rows overlay the top
  and bottom of the picture with the dark film base showing through. The
  look forces a wide panorama ratio (3:1) automatically, and a batch of
  shots develops as separate sprocket frames, one per shot.

  Background:
    Given the darkroom is open

  Scenario: The sprocket panorama forces the wide ratio
    Given the photographer loaded a busy roll with "lake.jpg"
    And the photographer chose the sprocket frame
    When the photographer develops the current shot
    Then the result is 256 wide by 85 tall

  Scenario: The sprocket holes punch through the picture
    Given the photographer loaded a busy roll with "lake.jpg"
    And the photographer chose the sprocket frame
    When the photographer develops the current shot
    Then the hole rows read as film base over the picture
    And the picture between the holes stays visible

  Scenario: A batch of shots produces separate sprocket frames
    Given the photographer loaded a busy roll with "lake.jpg" and "dock.jpg"
    And the photographer chose the sprocket frame
    When the photographer develops the whole roll
    Then two results are produced
    And each result is 256 wide by 85 tall
    And the first result's hole rows read as film base over the picture
