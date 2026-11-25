Feature: RAW decoding
  RAW files decode on-device through the self-hosted FlashRaw decoder.
  The decoder ships with the app, loads lazily, and is cached on first use.

  Background:
    Given the darkroom is open

  Scenario: The RAW fixture decodes to a canvas at full resolution
    When the page decodes the RAW fixture
    Then the decoded canvas is 1920x1080

  Scenario: Opening the app never loads the RAW decoder
    Then the page has fetched nothing under "flashraw/"

  Scenario: The decoder loads once and is cached for offline use
    Given the app has a service worker precaching the shell
    When the page decodes the RAW fixture
    Then the decoder assets sit in the decoder cache
    When the network is cut
    And the page decodes the RAW fixture
    Then the decoded canvas is 1920x1080
