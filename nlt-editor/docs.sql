SELECT verseid, versenumber, chapternumber, book, verse
FROM nlt
WHERE chapternumber=17 and
versenumber=15 
COLLATE NOCASE;

UPDATE nlt
SET verse = REPLACE(verse, 'The 𐤉𐤄𐤅𐤄', '𐤉𐤄𐤅𐤄')
WHERE verse LIKE '%The 𐤉𐤄𐤅𐤄%';