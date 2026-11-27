Feature: A film leaves the app as a .cube file

  The film studio's export gains a .cube option. A film without a LUT bakes
  its colour grade into a 33-point table by evaluating the grade function at
  every lattice point in engine order; a film with a LUT bakes grade-then-LUT
  in the same pipeline order. The re-imported film develops within 2/255 of
  the original on every channel for a plain grade, and within 4/255 when the
  film also carries a LUT (two stacked 8-bit tables quantise twice). The file
  reads as a proper cube: a TITLE naming the film, explicit DOMAIN lines, N³
  rows, red fastest.

  Background:
    Given the darkroom is open

  Scenario: A grade-only film exports a cube whose re-imported film develops within tolerance
    Given the photographer loaded a busy shot
    And the photographer outputs PNG files
    And the photographer imported a grade-only film with saturation -100, warmth 20, tint -15, fade 10 and split 40 as "Test Grade"
    When the photographer develops the current shot
    Then the developed pixels are remembered
    When the photographer exports the film as a cube
    And the photographer imports the exported cube file
    And the photographer develops the current shot again
    Then the developed pixels stay within 2/255 of the remembered develop

  Scenario: A LUT film exports grade-then-LUT and round-trips
    Given the photographer loaded a busy shot
    And the photographer outputs PNG files
    And the photographer imported a film with exposure 30 and a 17-point blue-lift LUT named "Blue Film" as a file
    When the photographer develops the current shot
    Then the developed pixels are remembered
    When the photographer exports the film as a cube
    And the photographer imports the exported cube file
    And the photographer develops the current shot again
    Then the developed pixels stay within 4/255 of the remembered develop

  Scenario: The exported cube text is a proper 33-point cube in red fastest order
    Given the photographer imported a grade-only film with warmth 15 and tint -10 as "Test Grade"
    When the photographer exports the film as a cube
    Then the cube text names "Test Grade" and declares the 0 to 1 domain
    And the cube carries 35937 rows with red changing on every row
