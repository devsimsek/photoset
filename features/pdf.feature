Feature: PDF writer
  Contact sheets print through a first-party, zero-dependency PDF writer:
  PDF 1.4, A4 portrait pages, JPEGs embedded with DCTDecode, text in the
  standard Helvetica core fonts, and a correct xref table and trailer. The
  scenarios parse the produced bytes instead of trusting the writer.

  Scenario: The bytes start with %PDF- and end with %%EOF
    Given a one-page PDF with the text "hello world"
    When the writer serialises it
    Then the bytes start with "%PDF-" and end with "%%EOF"

  Scenario: The xref offsets land on their object headers
    Given a one-page PDF with the text "hello world"
    When the writer serialises it
    Then every xref offset lands exactly on its own "N 0 obj"

  Scenario: An embedded JPEG keeps its pixel dimensions
    Given a one-page PDF with a 64x48 JPEG image
    When the writer serialises it
    Then the image object carries the JPEG's dimensions with DCTDecode

  Scenario: Text objects escape parentheses and backslashes
    Given a one-page PDF with the text "special (chars) \ here"
    When the writer serialises it
    Then the text stream carries the escaped string "(special \(chars\) \\ here)"
