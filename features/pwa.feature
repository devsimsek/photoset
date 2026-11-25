Feature: PWA shell
  The app precaches its shell so a visit survives the network going away.

  Scenario: The shell loads from cache when the network is cut
    Given the app has a service worker precaching the shell
    When the network is cut
    And the app is reloaded offline
    Then the darkroom still boots from the precache

  Scenario: Offline navigation falls back to the cached shell page
    Given the app has a service worker precaching the shell
    When the network is cut
    And the app navigates to the root again
    Then the darkroom still boots from the precache

  Scenario: Non-GET requests never touch the service worker
    Given the app has a service worker precaching the shell
    When a POST request is sent to a precached shell file
    Then the service worker does not handle it
