Feature: Sharing photos into Photoset

  An installed Photoset shows up in the system share sheet. Shared photos
  take the same intake path as a paste, and a share launch that carries no
  usable photos is answered with a toast that names the problem, never
  silence.

  Scenario: Shared photos join the roll
    Given the darkroom is open and handles share launches
    When the OS shares "shot.jpg" into Photoset
    Then the roll contains exactly "shot.jpg"
    And "shot.jpg" is a real JPEG the roll can decode

  Scenario: A share launch with no photos lands a named toast
    Given the darkroom is open and handles share launches
    When the OS shares nothing into Photoset
    Then the share refuses with a toast naming the share
    And the roll stays empty

  Scenario: The manifest offers Photoset as a share target
    Given the darkroom is open
    Then the manifest declares a share target whose action resolves inside the app path

  Scenario: A shared file POST lands in the roll through the service worker
    Given the app has a service worker precaching the shell
    When a share POST with "shot.jpg" arrives at the share target
    Then the roll holds exactly "shot.jpg"
