Feature: A film travels as a link and a QR

  The active look becomes a URL: the film JSON rides in the address hash, and
  opening the link imports the film on boot and clears the hash, so a reload
  does not re-import. The film dialog draws a QR of the same link, and a
  payload that cannot fit one QR leaves the link alone.

  Background:
    Given the darkroom is open

  Scenario: The film link imports the exact look
    Given the photographer loaded a roll with "lake.jpg"
    And the photographer pushes the grain slider to 55
    And the photographer saved the current look as film "KODA 64" iso "64"
    When the photographer develops the current shot
    Then the developed bytes are remembered
    And the photographer opens the film's share link
    And the photographer reloads the darkroom with a roll of "lake.jpg"
    And the photographer develops the current shot again
    Then the developed bytes match the remembered develop

  Scenario: An invalid film payload refuses by name and clears the hash
    When the photographer opens a link whose hash is a broken film
    Then the import refuses with a message about the schema version
    And the address bar carries no film hash

  Scenario: The film dialog draws a QR of the share link
    Given the photographer saved the current look as film "KODA 64" iso "64"
    When the photographer opens the film dialog for the QR
    Then the QR is drawn with the module matrix of the share link

  Scenario: A payload too big for one QR offers the link alone
    When the photographer looks at a film whose link is longer than a QR can hold
    Then the QR is skipped and the link is offered alone
