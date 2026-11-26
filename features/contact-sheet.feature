Feature: Contact sheet
  The output panel prints the roll as a contact-sheet PDF. The strips compose
  exactly like Film strips output, at most two strips per A4 portrait page,
  with the film name, roll name and print date as text on the first page.
  Nothing picked prints the whole roll; a picked set prints only the picks.

  Scenario: A 4-shot roll prints one strip on one page
    Given the photographer loaded a roll with "a.jpg", "b.jpg", "c.jpg", "d.jpg"
    When the photographer prints the contact sheet
    Then the contact sheet carries 1 strip on 1 page
    And the sheet names the film, the roll and the print date as text

  Scenario: Nine shots spread over three strips on two pages
    Given the photographer loaded a roll with "a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg", "f.jpg", "g.jpg", "h.jpg", "i.jpg"
    When the photographer prints the contact sheet
    Then the contact sheet carries 3 strips on 2 pages

  Scenario: Nothing picked prints the whole roll
    Given the photographer loaded a roll with "a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg", "f.jpg", "g.jpg", "h.jpg"
    When the photographer prints the contact sheet
    Then the contact sheet carries 2 strips on 1 page

  Scenario: A picked set prints only the picks
    Given the photographer loaded a roll with "a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg", "f.jpg", "g.jpg", "h.jpg"
    And the photographer marks "b.jpg", "c.jpg" as picked
    When the photographer prints the contact sheet
    Then the contact sheet carries 1 strip on 1 page

  Scenario: A small roll prints under the stated size bound
    Given the photographer loaded a busy roll of 4 large shots
    When the photographer prints the contact sheet
    Then the contact sheet stays under 8 MB

  Scenario: Embedded strips honor the max size setting
    Given the photographer loaded a busy roll of 4 large shots
    And the photographer sets max size to 1080
    When the photographer prints the contact sheet
    Then the embedded strip image is 4572x1051 pixels
