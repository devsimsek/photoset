Feature: Pasting a photo

  A copied photo joins the roll straight from the clipboard. The roll
  loads JPG photos, so a pasted PNG is re-encoded to JPG through the
  canvas on the way in, and any other format is refused with a toast
  that names the format.

  Background:
    Given the darkroom is open

  Scenario: A pasted JPEG joins the roll in name order
    Given the photographer loaded a folder containing "b.jpg"
    When the photographer pastes a copied JPEG named "a.jpg"
    Then the roll lists "a.jpg", "b.jpg" in that order

  Scenario: A pasted PNG lands in the roll as a JPG
    Given the photographer loaded a folder containing "lake.jpg"
    When the photographer pastes a copied PNG named "shot.png"
    Then the roll lists "lake.jpg", "shot.jpg" in that order
    And "shot.jpg" is a real JPEG the roll can decode

  Scenario: A pasted GIF is refused by name
    Given the photographer loaded a folder containing "lake.jpg"
    When the photographer pastes a copied GIF named "anim.gif"
    Then the paste refuses with a toast naming "GIF"
    And the roll contains exactly "lake.jpg"

  Scenario: A paste with no roll loaded starts a roll called "pasted"
    When the photographer pastes a copied JPEG named "c.jpg"
    Then the roll is "pasted" and lists "c.jpg"

  Scenario: A paste joins a remembered roll once it is restored
    Given a remembered roll "trip" whose shots "lake.jpg" reached "strip_002"
    When the photographer re-picks the folder "trip" with "lake.jpg"
    And the photographer pastes a copied JPEG named "d.jpg"
    Then the roll lists "d.jpg", "lake.jpg" in that order
    And the remembered roll is now "trip"
