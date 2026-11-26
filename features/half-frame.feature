Feature: Half-frame 35mm

  The halfframe frame mode holds TWO vertical shots side by side in one
  35mm frame. The edge print numbers advance half a frame per shot: frame 1
  carries shots 1A and 1B, frame 2 carries 2A and 2B, and a trailing odd
  shot composes alone, half filled, with only its A position printed. The
  outputs name themselves strip_NNN and share the roll's strip numbering.

  Background:
    Given the darkroom is open

  Scenario: Two shots compose into one half-frame with both visible
    Given the photographer loaded a two-tone roll with "one.jpg" and "two.jpg"
    And the photographer chose the halfframe frame
    When the photographer develops the whole roll
    Then the run produces one result
    And the result is 251 wide by 117 tall
    And the result shows red at the left and green at the right
    And the half-frame edge print reads "1A/1B"

  Scenario: An odd final shot composes alone, half filled
    Given the photographer loaded a two-tone roll with "one.jpg", "two.jpg" and "three.jpg"
    And the photographer chose the halfframe frame
    When the photographer develops the whole roll
    Then two results are produced
    And the last result is 131 wide by 117 tall
    And the half-frame edge print reads "2A"

  Scenario: Four shots compose pairwise into two half-frames
    Given the photographer loaded a two-tone roll with "one.jpg", "two.jpg", "three.jpg" and "four.jpg"
    And the photographer chose the halfframe frame
    When the photographer develops the whole roll
    Then two results are produced
    And each result is 251 wide by 117 tall
    And the strips are named "strip_001.jpg" and "strip_002.jpg"

  Scenario: The half-frame layout keeps the picture inside the frame bounds
    Given the photographer loaded a two-tone roll with "one.jpg" and "two.jpg"
    And the photographer chose the halfframe frame
    When the photographer develops the whole roll
    Then the result has dark bands above and below the picture
