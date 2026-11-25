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

  Scenario: The never-overwrite law holds for PNG names
    When the photographer saves two developed files called "holiday.png"
    Then the first file is saved as "holiday.png"
    And the second file is saved as "holiday (2).png"

  Scenario: Strip numbering continues for PNG strips
    When the photographer saves two developed files called "strip_001.png"
    Then the first file is saved as "strip_001.png"
    And the second file is saved as "strip_002.png"

  Scenario: A capped develop stays under the cap when a quality fits
    Given the photographer loaded a busy roll with "lake.jpg"
    And the photographer chose JPG output
    And the photographer pushes quality to 100
    And the photographer sets the cap to 8 KB
    When the photographer develops the current shot
    Then the result downloads within the cap

  Scenario: An impossible cap still produces a file
    Given the photographer loaded a busy roll with "lake.jpg"
    And the photographer chose JPG output
    And the photographer pushes quality to 100
    And the photographer sets the cap to 1 KB
    When the photographer develops the current shot
    Then the result downloads anyway, larger than the cap

  Scenario: The PNG cap path downscales instead of re-encoding
    Given the photographer loaded a busy roll with "lake.jpg"
    And the photographer chose PNG output
    And the photographer sets the cap to 1 KB
    When the photographer develops the current shot
    Then the result is a PNG at half the long edge

  Scenario: The output panel drives format and the cap
    Given the photographer loaded a busy roll with "lake.jpg"
    When the photographer picks WebP, quality 100 and a 20 KB cap in the output panel
    Then the estimate shows a result within the cap
