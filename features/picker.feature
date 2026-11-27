Feature: Folder picking
  The load control hands the browser a folder input on desktops. WebKit's
  picker lets a user select files inside the folder and then returns an
  empty list (WebKit bug 284457), so the input must filter files out of the
  picker entirely: only folders stay selectable, and every browser that
  honors accept for directory picking behaves the same way. Phones keep the
  photo filter untouched.

  Scenario: The folder input offers no files to select
    Given the darkroom is open in a browser without the folder API
    When the photographer opens the load picker
    Then the folder input accepts no individual files
    And the folder input still asks for directories

  Scenario: The phone picker keeps its photo filter
    Given the darkroom is open on a phone
    When the photographer opens the load picker
    Then the photo input still filters to photos

  Scenario: The crop control explains itself on a remembered shot
    Given a remembered roll "holiday" whose shots "a.jpg", "b.jpg" reached "strip_003"
    When the photographer selects the remembered shot "a.jpg"
    And the photographer clicks the crop control
    Then a toast names the shot as a placeholder needing a re-pick
