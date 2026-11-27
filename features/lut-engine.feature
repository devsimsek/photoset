Feature: The LUT develops after the grade

  A film that carries a LUT develops through a trilinear pass over its table,
  applied right after the colour grade and before the light leak. The pass is
  pure math over the stored table, so the same shot with the same film
  develops byte for byte, and an identity table changes nothing.

  Background:
    Given the darkroom is open

  Scenario: A tinted LUT shifts pixels
    Given the photographer loaded a shot filled "rgb(0, 0, 128)"
    And the photographer outputs PNG files
    And the photographer imported the LUT film "Blue Lift" that adds 0.25 to blue as a file
    When the photographer develops the current shot
    Then the developed blue channel reads about 192
    And the developed red channel stays near the source

  Scenario: A film with a grade and an identity LUT develops exactly like the grade alone
    Given the photographer loaded a roll with "lake.jpg"
    And the photographer imported a film with exposure 40 and contrast 25 plus a 17-point identity LUT as a file
    When the photographer develops the current shot
    Then the developed bytes are remembered
    When the photographer pastes the same look without the LUT
    And the photographer develops the current shot again
    Then the developed bytes match the remembered develop

  Scenario: The same shot develops byte for byte with a LUT in the chain
    Given the photographer loaded a roll with "lake.jpg"
    And the photographer imported the LUT film "Blue Lift" that adds 0.25 to blue as a file
    When the photographer develops the current shot
    Then the developed bytes are remembered
    And the photographer develops the current shot again
    Then the developed bytes match the remembered develop

  Scenario: A 12-megapixel shot develops with a LUT well inside the latency budget
    When the photographer times a 12-megapixel develop with the identity LUT
    Then the develop completes inside the 10 second budget
