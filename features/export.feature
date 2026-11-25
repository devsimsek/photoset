Feature: Export formats

  Developed shots leave the engine as JPG, WebP or PNG. The file extension
  follows the chosen format, and the never-overwrite law holds for every
  extension.

  Scenario: A shot developed as WebP comes out as a WebP file
    Given the photographer loaded a roll with "lake.jpg"
    And the photographer chose WebP output
    When the photographer develops the current shot
    Then the result "lake.webp" downloads as a WebP file

  Scenario: A shot developed as PNG comes out as a PNG file
    Given the photographer loaded a roll with "lake.jpg"
    And the photographer chose PNG output
    When the photographer develops the current shot
    Then the result "lake.png" downloads as a PNG file

  Scenario: The never-overwrite law holds for WebP names
    When the photographer saves two developed files called "holiday.webp"
    Then the first file is saved as "holiday.webp"
    And the second file is saved as "holiday (2).webp"

  Scenario: Strip numbering continues for WebP strips
    When the photographer saves two developed files called "strip_001.webp"
    Then the first file is saved as "strip_001.webp"
    And the second file is saved as "strip_002.webp"
