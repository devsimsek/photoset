# RAW fixtures

`blackmagic-micro-cinema-camera.dng` (1,283,055 bytes, 1920x1080):

- Source: raw.pixls.us entry 7317, "Blackmagic - Micro Cinema Camera - 12bit
  (16:9).dng", released Creative Commons Zero 1.0 (public domain) by the
  photographer. Original sha256:
  `4c65b8cda205087cfb94d8931811e53e15eb4df538ad67c1b4a3e76c1185b277`
  (https://raw.pixls.us/getfile.php/7317/nice/Blackmagic%20-%20Micro%20Cinema%20Camera%20-%2012bit%20(16:9).dng).
- Derived: the original carries no embedded preview (CinemaDNG video frame), so
  a preview SubIFD was appended: the sensor IFD is byte-identical except that
  its Software entry (tag 305) was replaced by a SubIFDs entry (tag 330)
  pointing at a preview IFD holding a 640px JPEG rendered from the file's own
  decoded pixels. Sensor data is untouched: FlashRaw decodes the original and
  the derived file to identical rgba8 output. Fixture sha256:
  `a739f1ec58fe93706404efec0ac51cabd448ebe328a90f8b4a342c190e2684a2`.
- The build copies this directory into `web-dist/fixtures/` so the BDD suite
  can fetch it through the real HTTP server.
