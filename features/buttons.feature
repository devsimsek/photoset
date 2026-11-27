Feature: Action buttons explain themselves
  The develop, save, print, compare and crop controls need a roll with real
  pixels. On an empty darkroom they are disabled with a tooltip that says why;
  a remembered roll enables the load control only, and the placeholder cases
  keep their named toasts.

  Scenario: The action controls sit out on an empty darkroom
    Given the darkroom is open
    When the photographer looks at the action controls
    Then develop, save, print, compare and crop are disabled with a reason
    And the load controls are ready

  Scenario: The action controls return when a roll loads
    Given the darkroom is open
    When a roll of "a.jpg", "b.jpg" loads
    Then develop, save, print, compare and crop are enabled again
