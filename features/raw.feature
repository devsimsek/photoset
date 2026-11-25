Feature: RAW decoding
  RAW files decode on-device through the self-hosted FlashRaw decoder.
  The decoder ships with the app, loads lazily, and is cached on first use.
  RAW shots load into the roll beside JPGs and develop through the same
  pipeline.

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

  Scenario: A roll loads JPGs and RAW files together
    When the photographer loads a roll with a JPG and the RAW fixture "b_shot.dng"
    Then the roll holds "a_frame.jpg" then "b_shot.dng"
    And both tiles grow a thumbnail

  Scenario: The RAW tile shows the embedded preview, then the decode
    Given RAW decodes stall
    When the photographer loads a roll with the RAW fixture "b_shot.dng"
    Then the "b_shot.dng" tile shows the embedded preview
    When RAW decodes stop stalling
    And the page waits for the selected RAW decode
    Then the "b_shot.dng" tile shows a decoded thumb

  Scenario: A RAW shot develops through the normal pipeline
    When the photographer loads a roll with the RAW fixture "b_shot.dng"
    And the photographer develops the current shot
    Then one result is produced as a JPEG
    And the result is larger than 10 KB

  Scenario: Changing rolls aborts in-flight RAW decodes
    Given RAW decodes stall
    When the photographer loads a roll with the RAW fixture "b_shot.dng"
    And loads another roll with a JPG
    Then the in-flight RAW decode was aborted

  Scenario: The committed fixture decodes well inside the latency budget
    When the page decodes the RAW fixture
    Then the decode took under 5000ms

