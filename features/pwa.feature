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

  Scenario: A waiting service worker shows the update toast
    Given the app has a service worker precaching the shell
    When a new service worker version is waiting
    Then the update toast offers a reload

  Scenario: Clicking reload swaps to the new version
    Given the app has a service worker precaching the shell
    When a new service worker version is waiting
    And the user clicks reload on the update toast
    Then the page boots again controlled by the new service worker version

  Scenario: Without a click, the page never reloads on its own
    Given the app has a service worker precaching the shell
    When a new service worker version is waiting
    Then the page does not reload on its own

  Scenario: The manifest is fetchable and parses
    Given the darkroom is open
    Then the manifest at the app root parses with name "Photoset Darkroom" and display "standalone"

  Scenario: The manifest icons include a 512 maskable icon
    Given the darkroom is open
    Then the icons list contains a 512x512 "any" icon and a 512x512 "maskable" icon

  Scenario: A service worker registration exists after load
    Given the app has a service worker precaching the shell
    Then a service worker registration exists after load

  Scenario: A broken link never poisons the offline shell
    Given the app has a service worker precaching the shell
    When the app navigates to a page that is not found
    And the network is cut
    And the app navigates to the root again
    Then the darkroom still boots from the precache
