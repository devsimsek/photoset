Feature: Loading a roll of shots

  The photographer starts a develop session by opening a folder of shots.
  The roll keeps only photographs, at the top level, in shooting order.

  Background:
    Given the darkroom is open

  Scenario: Only JPEG shots survive the load
    When the photographer loads a folder containing "frame_01.jpg", "frame_02.jpeg", "readme.txt" and "logo.png"
    Then the roll contains exactly "frame_01.jpg" and "frame_02.jpeg"

  Scenario: Shots inside subfolders are not loaded
    When the photographer loads a folder "trip" where "lake.jpg" is on the top level and "cousin.jpg" sits in a "family" subfolder
    Then the roll contains exactly "lake.jpg"

  Scenario: Shots are ordered by name with numbers read as numbers
    When the photographer loads a folder containing "photo2.jpg", "photo10.jpg" and "photo1.jpg"
    Then the roll lists "photo1.jpg", "photo2.jpg" and "photo10.jpg" in that order
